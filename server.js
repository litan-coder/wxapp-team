require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const WECHAT_APPID = process.env.WECHAT_APPID || '';
const WECHAT_SECRET = process.env.WECHAT_SECRET || '';

// ========== 数据库连接 ==========
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_64xvCoVdEmwj@ep-shy-forest-aog32ggz-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== CORS ==========
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ========== 初始化数据库 ==========
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS reg_team_info (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        phone VARCHAR(20) DEFAULT '',
        age INTEGER NOT NULL,
        gender VARCHAR(10) NOT NULL,
        hobby VARCHAR(200) DEFAULT '',
        remark TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ 数据表 reg_team_info 已就绪');

    const result = await client.query('SELECT COUNT(*) FROM reg_team_info');
    if (parseInt(result.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO reg_team_info (id, name, phone, age, gender, hobby, remark)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [crypto.randomUUID(), '测试用户', '13800000000', 28, '男', '篮球, 阅读', '这是一条测试数据']);
      console.log('✅ 已插入测试数据');
    }
  } catch (err) {
    console.error('❌ 数据库初始化失败:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

// ========== Token 会话 ==========
const sessions = {};

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

function authMiddleware(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token || !sessions[token]) {
    return res.status(401).json({ error: '未登录' });
  }
  req.session = sessions[token];
  req.token = token;
  next();
}

// ========== 手机号校验 ==========
const PHONE_REGEX = /^1[3-9]\d{9}$/;
function isValidPhone(phone) {
  return PHONE_REGEX.test(phone);
}

// ========== 格式化记录 ==========
function formatEntry(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    age: row.age,
    gender: row.gender,
    hobby: row.hobby,
    remark: row.remark,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ==================== 接口 ====================

// ---------- 微信小程序登录 ----------
app.post('/api/wx/login', async (req, res) => {
  const { code, name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: '请输入姓名' });
  }
  if (!code) {
    return res.status(400).json({ error: '缺少微信登录凭证' });
  }
  if (!WECHAT_APPID || !WECHAT_SECRET) {
    return res.status(500).json({ error: '微信登录未配置' });
  }

  try {
    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${WECHAT_APPID}&secret=${WECHAT_SECRET}&js_code=${code}&grant_type=authorization_code`;
    const wxRes = await fetch(wxUrl);
    const wxData = await wxRes.json();

    if (wxData.errcode) {
      return res.status(400).json({ error: '微信登录失败: ' + (wxData.errmsg || '未知错误') });
    }

    const token = generateToken();
    sessions[token] = { role: 'user', name: name.trim(), openId: wxData.openid };
    res.json({ token, role: 'user', name: name.trim() });
  } catch (err) {
    res.status(500).json({ error: '微信登录服务异常' });
  }
});

// ---------- 普通登录（Web 端兼容） ----------
app.post('/api/login', (req, res) => {
  const { name, password } = req.body;

  if (password !== undefined && password !== '') {
    if (password === ADMIN_PASSWORD) {
      const token = generateToken();
      sessions[token] = { role: 'admin', name: '管理员' };
      return res.json({ token, role: 'admin', name: '管理员' });
    }
    return res.status(400).json({ error: '密码错误' });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: '请输入姓名' });
  }

  const token = generateToken();
  sessions[token] = { role: 'user', name: name.trim() };
  res.json({ token, role: 'user', name: name.trim() });
});

// ---------- 退出登录 ----------
app.post('/api/logout', authMiddleware, (req, res) => {
  delete sessions[req.token];
  res.json({ ok: true });
});

// ---------- 用户：新增登记 ----------
app.post('/api/entries', authMiddleware, async (req, res) => {
  if (req.session.role !== 'user') {
    return res.status(403).json({ error: '管理员无需登记' });
  }

  const { name } = req.session;
  const { phone, age, gender, hobby, remark } = req.body;

  if (!phone || !age || !gender) {
    return res.status(400).json({ error: '手机号、年龄和性别为必填项' });
  }
  if (!isValidPhone(phone)) {
    return res.status(400).json({ error: '请输入正确的11位手机号' });
  }

  try {
    const dup = await pool.query(
      'SELECT id FROM reg_team_info WHERE name = $1 AND phone = $2',
      [name, phone]
    );
    if (dup.rows.length > 0) {
      return res.status(400).json({ error: '该姓名下已存在相同手机号，不允许重复提交！' });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO reg_team_info (id, name, phone, age, gender, hobby, remark, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, name, phone, Number(age), gender, hobby || '', remark || '', now, now]
    );
    res.json({ ok: true, entry: { id, name, phone, age: Number(age), gender, hobby: hobby || '', remark: remark || '', createdAt: now, updatedAt: now } });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ---------- 用户：查看自己的登记 ----------
app.get('/api/my-entries', authMiddleware, async (req, res) => {
  if (req.session.role !== 'user') {
    return res.status(403).json({ error: '无权限' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM reg_team_info WHERE name = $1 ORDER BY created_at DESC',
      [req.session.name]
    );
    res.json({ entries: result.rows.map(formatEntry) });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ---------- 用户：修改自己的登记 ----------
app.put('/api/entries/:id', authMiddleware, async (req, res) => {
  if (req.session.role !== 'user') {
    return res.status(403).json({ error: '管理员无需修改' });
  }

  const { name } = req.session;
  const { phone, age, gender, hobby, remark } = req.body;

  if (phone && !isValidPhone(phone)) {
    return res.status(400).json({ error: '请输入正确的11位手机号' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM reg_team_info WHERE id = $1 AND name = $2',
      [req.params.id, name]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '记录不存在或无权修改' });
    }

    const entry = result.rows[0];

    if (phone && phone !== entry.phone) {
      const dup = await pool.query(
        'SELECT id FROM reg_team_info WHERE name = $1 AND phone = $2 AND id != $3',
        [name, phone, req.params.id]
      );
      if (dup.rows.length > 0) {
        return res.status(400).json({ error: '该姓名下已存在相同手机号，不允许重复提交！' });
      }
    }

    const updated = await pool.query(
      `UPDATE reg_team_info SET phone = $1, age = $2, gender = $3, hobby = $4, remark = $5, updated_at = $6
       WHERE id = $7 RETURNING *`,
      [
        phone || entry.phone,
        age ? Number(age) : entry.age,
        gender || entry.gender,
        hobby !== undefined ? hobby : entry.hobby,
        remark !== undefined ? remark : entry.remark,
        new Date().toISOString(),
        req.params.id
      ]
    );
    res.json({ ok: true, entry: formatEntry(updated.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ---------- 用户：删除自己的登记 ----------
app.delete('/api/entries/:id', authMiddleware, async (req, res) => {
  if (req.session.role !== 'user') {
    return res.status(403).json({ error: '管理员无需删除' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM reg_team_info WHERE id = $1 AND name = $2 RETURNING id',
      [req.params.id, req.session.name]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '记录不存在或无权删除' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ---------- 管理员：查看所有登记 ----------
app.get('/api/entries', authMiddleware, async (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: '无权限' });
  }
  try {
    const result = await pool.query('SELECT * FROM reg_team_info ORDER BY created_at DESC');
    res.json({ entries: result.rows.map(formatEntry) });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ---------- 管理员：删除任意记录 ----------
app.delete('/api/admin/entries/:id', authMiddleware, async (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: '无权限' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM reg_team_info WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ---------- 统计接口 ----------
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const all = await pool.query('SELECT * FROM reg_team_info');
    const entries = all.rows;

    const total = entries.length;
    const maleCount = entries.filter(e => e.gender === '男').length;
    const femaleCount = entries.filter(e => e.gender === '女').length;

    const ageGroups = { '18以下': 0, '18-25': 0, '26-35': 0, '36-45': 0, '46以上': 0 };
    entries.forEach(e => {
      const age = e.age;
      if (age < 18) ageGroups['18以下']++;
      else if (age <= 25) ageGroups['18-25']++;
      else if (age <= 35) ageGroups['26-35']++;
      else if (age <= 45) ageGroups['36-45']++;
      else ageGroups['46以上']++;
    });

    const hobbyMap = {};
    entries.forEach(e => {
      if (e.hobby) {
        e.hobby.split(/[,，、\s]+/).forEach(h => {
          h = h.trim();
          if (h) hobbyMap[h] = (hobbyMap[h] || 0) + 1;
        });
      }
    });

    const basicStats = { total, maleCount, femaleCount };

    if (req.session.role === 'admin') {
      return res.json({
        ...basicStats,
        ageGroups,
        hobbies: hobbyMap,
        entries: entries.map(formatEntry)
      });
    }

    res.json(basicStats);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ---------- 管理员：导出 Excel ----------
app.get('/api/export', authMiddleware, async (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: '无权限' });
  }

  try {
    const result = await pool.query('SELECT * FROM reg_team_info ORDER BY created_at DESC');
    const entries = result.rows;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '团队登记工具';
    const sheet = workbook.addWorksheet('登记记录');

    sheet.columns = [
      { header: '序号', key: 'index', width: 8 },
      { header: '姓名', key: 'name', width: 14 },
      { header: '手机号', key: 'phone', width: 16 },
      { header: '年龄', key: 'age', width: 8 },
      { header: '性别', key: 'gender', width: 8 },
      { header: '爱好', key: 'hobby', width: 24 },
      { header: '备注', key: 'remark', width: 30 },
      { header: '登记时间', key: 'createdAt', width: 22 }
    ];

    sheet.getRow(1).eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F6EF7' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' }
      };
    });
    sheet.getRow(1).height = 26;

    entries.forEach((e, i) => {
      const row = sheet.addRow({
        index: i + 1,
        name: e.name,
        phone: e.phone,
        age: e.age,
        gender: e.gender,
        hobby: e.hobby,
        remark: e.remark,
        createdAt: new Date(e.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
      });
      row.eachCell(cell => {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' }, bottom: { style: 'thin' },
          left: { style: 'thin' }, right: { style: 'thin' }
        };
      });
      row.getCell('remark').alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell('hobby').alignment = { vertical: 'middle', horizontal: 'left' };
    });

    const filename = encodeURIComponent(`团队登记_${new Date().toLocaleDateString('zh-CN')}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: '导出失败' });
  }
});

// ========== 健康检查 ==========
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', source: 'miniprogram' });
});

// ========== 启动 ==========
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 小程序后端已启动: http://localhost:${PORT}`);
    console.log(`📡 微信登录: ${process.env.WECHAT_APPID? '已配置' : '❌ 未配置 WECHAT_APPID'}`);
  });
});
