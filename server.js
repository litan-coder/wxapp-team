require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const { Pool } = require('pg');
const { parseHobbies, buildAgeGroups } = require('./lib/stats');
const { buildOwnerFilter, canAccessEntry } = require('./lib/user-access');
const { isValidPhone } = require('./lib/validation');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const WECHAT_APPID = process.env.WECHAT_APPID || '';
const WECHAT_SECRET = process.env.WECHAT_SECRET || '';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

if (!process.env.ADMIN_PASSWORD || ADMIN_PASSWORD === 'admin123') {
  console.warn('⚠️  管理员密码为默认值，请设置 ADMIN_PASSWORD 环境变量更换强密码');
}
if (ADMIN_PASSWORD.length < 6) {
  console.warn('⚠️  管理员密码过短（少于6位），建议使用更复杂的密码');
}

if (!process.env.DATABASE_URL) {
  console.error('❌ 缺少 DATABASE_URL 环境变量，请在 .env 文件中配置');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));
app.use(express.static(path.join(__dirname, 'public')));

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.length > 0) {
    if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
      res.header('Access-Control-Allow-Origin', origin || '*');
    }
  } else {
    res.header('Access-Control-Allow-Origin', origin || '');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS reg_team_info (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        open_id VARCHAR(64),
        phone VARCHAR(20) DEFAULT '',
        age INTEGER NOT NULL,
        gender VARCHAR(10) NOT NULL,
        hobby VARCHAR(200) DEFAULT '',
        remark TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      ALTER TABLE reg_team_info ADD COLUMN IF NOT EXISTS open_id VARCHAR(64);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        token VARCHAR(64) PRIMARY KEY,
        role VARCHAR(10) NOT NULL,
        name VARCHAR(50) NOT NULL,
        open_id VARCHAR(64),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reg_team_info_open_id ON reg_team_info(open_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reg_team_info_created_at ON reg_team_info(created_at DESC);
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_reg_team_open_id_phone
      ON reg_team_info (open_id, phone) WHERE open_id IS NOT NULL;
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_reg_team_name_phone_legacy
      ON reg_team_info (name, phone) WHERE open_id IS NULL;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
    `);
    console.log('✅ 数据表已就绪');

    const result = await client.query('SELECT COUNT(*) FROM reg_team_info');
    if (parseInt(result.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO reg_team_info (id, name, phone, age, gender, hobby, remark)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [crypto.randomUUID(), '测试用户', '13800000000', 28, '男', '篮球, 阅读', '这是一条测试数据']);
      console.log('✅ 已插入测试数据');
    }
  } catch (err) {
    console.error('❌ 数据库初始化失败:', err.message);
    await pool.end().catch(() => {});
    process.exit(1);
  } finally {
    client.release();
  }
}

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

async function createSession(data) {
  const token = generateToken();
  await pool.query(
    'INSERT INTO sessions (token, role, name, open_id) VALUES ($1, $2, $3, $4)',
    [token, data.role, data.name, data.openId || null]
  );
  return token;
}

async function getSession(token) {
  const result = await pool.query(
    `SELECT role, name, open_id, created_at
     FROM sessions
     WHERE token = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
    [token]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    role: row.role,
    name: row.name,
    openId: row.open_id,
    createdAt: new Date(row.created_at).getTime()
  };
}

async function deleteSession(token) {
  await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
}

setInterval(async () => {
  try {
    const result = await pool.query(
      `DELETE FROM sessions WHERE created_at < NOW() - INTERVAL '24 hours' RETURNING token`
    );
    if (result.rowCount > 0) {
      console.log(`🧹 已清理 ${result.rowCount} 个过期会话`);
    }
  } catch (err) {
    console.error('清理过期会话失败:', err.message);
  }
}, 30 * 60 * 1000);

async function authMiddleware(req, res, next) {
  try {
    const token = req.headers['x-auth-token'];
    if (!token) {
      return res.status(401).json({ error: '未登录' });
    }
    const session = await getSession(token);
    if (!session) {
      return res.status(401).json({ error: '登录已过期，请重新登录' });
    }
    req.session = session;
    req.token = token;
    next();
  } catch (err) {
    console.error('鉴权失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
}

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

async function fetchBasicStats() {
  const result = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE gender = '男')::int AS male_count,
      COUNT(*) FILTER (WHERE gender = '女')::int AS female_count
    FROM reg_team_info
  `);
  const row = result.rows[0];
  return {
    total: row.total,
    maleCount: row.male_count,
    femaleCount: row.female_count
  };
}

async function fetchAdminStats() {
  const [basic, ageResult, hobbyResult, entriesResult] = await Promise.all([
    fetchBasicStats(),
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE age < 18)::int AS u18,
        COUNT(*) FILTER (WHERE age >= 18 AND age <= 25)::int AS a18_25,
        COUNT(*) FILTER (WHERE age >= 26 AND age <= 35)::int AS a26_35,
        COUNT(*) FILTER (WHERE age >= 36 AND age <= 45)::int AS a36_45,
        COUNT(*) FILTER (WHERE age >= 46)::int AS a46_plus
      FROM reg_team_info
    `),
    pool.query(`SELECT hobby FROM reg_team_info WHERE hobby <> ''`),
    pool.query('SELECT * FROM reg_team_info ORDER BY created_at DESC')
  ]);

  return {
    ...basic,
    ageGroups: buildAgeGroups(ageResult.rows[0]),
    hobbies: parseHobbies(hobbyResult.rows),
    entries: entriesResult.rows.map(formatEntry)
  };
}

async function checkDuplicatePhone(session, phone, excludeId) {
  if (session.openId) {
    const sql = excludeId
      ? 'SELECT id FROM reg_team_info WHERE open_id = $1 AND phone = $2 AND id != $3'
      : 'SELECT id FROM reg_team_info WHERE open_id = $1 AND phone = $2';
    const params = excludeId ? [session.openId, phone, excludeId] : [session.openId, phone];
    return pool.query(sql, params);
  }

  const sql = excludeId
    ? 'SELECT id FROM reg_team_info WHERE name = $1 AND phone = $2 AND open_id IS NULL AND id != $3'
    : 'SELECT id FROM reg_team_info WHERE name = $1 AND phone = $2 AND open_id IS NULL';
  const params = excludeId ? [session.name, phone, excludeId] : [session.name, phone];
  return pool.query(sql, params);
}

// ==================== 接口 ====================

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

    const token = await createSession({
      role: 'user',
      name: name.trim(),
      openId: wxData.openid
    });
    res.json({ token, role: 'user', name: name.trim() });
  } catch (err) {
    console.error('微信登录异常:', err);
    res.status(500).json({ error: '微信登录服务异常' });
  }
});

app.post('/api/login', async (req, res) => {
  const { name, password } = req.body;

  try {
    if (password !== undefined && password !== '') {
      if (password === ADMIN_PASSWORD) {
        const token = await createSession({ role: 'admin', name: '管理员' });
        return res.json({ token, role: 'admin', name: '管理员' });
      }
      return res.status(400).json({ error: '密码错误' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: '请输入姓名' });
    }

    const token = await createSession({ role: 'user', name: name.trim() });
    res.json({ token, role: 'user', name: name.trim() });
  } catch (err) {
    console.error('登录失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.post('/api/logout', authMiddleware, async (req, res) => {
  try {
    await deleteSession(req.token);
    res.json({ ok: true });
  } catch (err) {
    console.error('退出登录失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.post('/api/entries', authMiddleware, async (req, res) => {
  if (req.session.role !== 'user') {
    return res.status(403).json({ error: '管理员无需登记' });
  }

  const { name, openId } = req.session;
  const { phone, age, gender, hobby, remark } = req.body;

  if (!phone || !age || !gender) {
    return res.status(400).json({ error: '手机号、年龄和性别为必填项' });
  }
  if (!isValidPhone(phone)) {
    return res.status(400).json({ error: '请输入正确的11位手机号' });
  }

  try {
    const dup = await checkDuplicatePhone(req.session, phone);
    if (dup.rows.length > 0) {
      return res.status(400).json({ error: '该账号下已存在相同手机号，不允许重复提交！' });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO reg_team_info (id, name, open_id, phone, age, gender, hobby, remark, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, name, openId || null, phone, Number(age), gender, hobby || '', remark || '', now, now]
    );
    res.json({
      ok: true,
      entry: {
        id,
        name,
        phone,
        age: Number(age),
        gender,
        hobby: hobby || '',
        remark: remark || '',
        createdAt: now,
        updatedAt: now
      }
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: '该账号下已存在相同手机号，不允许重复提交！' });
    }
    console.error('新增登记失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.get('/api/my-entries', authMiddleware, async (req, res) => {
  if (req.session.role !== 'user') {
    return res.status(403).json({ error: '无权限' });
  }

  try {
    const owner = buildOwnerFilter(req.session);
    const result = await pool.query(
      `SELECT * FROM reg_team_info WHERE ${owner.clause} ORDER BY created_at DESC`,
      owner.params
    );
    res.json({ entries: result.rows.map(formatEntry) });
  } catch (err) {
    console.error('查询我的登记失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.get('/api/entries/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM reg_team_info WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }

    const entry = result.rows[0];
    if (!canAccessEntry(req.session, entry)) {
      return res.status(403).json({ error: '无权查看该记录' });
    }

    res.json({ entry: formatEntry(entry) });
  } catch (err) {
    console.error('查询记录详情失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.put('/api/entries/:id', authMiddleware, async (req, res) => {
  if (req.session.role !== 'user') {
    return res.status(403).json({ error: '管理员无需修改' });
  }

  const { phone, age, gender, hobby, remark } = req.body;

  if (phone && !isValidPhone(phone)) {
    return res.status(400).json({ error: '请输入正确的11位手机号' });
  }

  try {
    const owner = buildOwnerFilter(req.session);
    const result = await pool.query(
      `SELECT * FROM reg_team_info WHERE id = $1 AND ${owner.clause}`,
      [req.params.id, ...owner.params]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '记录不存在或无权修改' });
    }

    const entry = result.rows[0];

    if (phone && phone !== entry.phone) {
      const dup = await checkDuplicatePhone(req.session, phone, req.params.id);
      if (dup.rows.length > 0) {
        return res.status(400).json({ error: '该账号下已存在相同手机号，不允许重复提交！' });
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
    if (err.code === '23505') {
      return res.status(400).json({ error: '该账号下已存在相同手机号，不允许重复提交！' });
    }
    console.error('修改登记失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.delete('/api/entries/:id', authMiddleware, async (req, res) => {
  if (req.session.role !== 'user') {
    return res.status(403).json({ error: '管理员无需删除' });
  }

  try {
    const owner = buildOwnerFilter(req.session);
    const result = await pool.query(
      `DELETE FROM reg_team_info WHERE id = $1 AND ${owner.clause} RETURNING id`,
      [req.params.id, ...owner.params]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '记录不存在或无权删除' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('删除登记失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.get('/api/entries', authMiddleware, async (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: '无权限' });
  }
  try {
    const result = await pool.query('SELECT * FROM reg_team_info ORDER BY created_at DESC');
    res.json({ entries: result.rows.map(formatEntry) });
  } catch (err) {
    console.error('管理员查询登记失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

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
    console.error('管理员删除记录失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    if (req.session.role === 'admin') {
      return res.json(await fetchAdminStats());
    }
    res.json(await fetchBasicStats());
  } catch (err) {
    console.error('统计查询失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

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
      cell.font = { bold: true, color: { argb: 'FF333333' }, size: 12 };
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
    console.error('Excel 导出失败:', err);
    res.status(500).json({ error: '导出失败' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', source: 'miniprogram' });
});

async function startServer() {
  await initDB();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 小程序后端已启动: http://localhost:${PORT}`);
    console.log(`📡 微信登录: ${process.env.WECHAT_APPID ? '已配置' : '❌ 未配置 WECHAT_APPID'}`);
  });
}

if (require.main === module) {
  startServer().catch(err => {
    console.error('启动失败:', err);
    process.exit(1);
  });
}

module.exports = {
  app,
  pool,
  initDB,
  startServer,
  isValidPhone,
  formatEntry,
  SESSION_TTL_MS
};
