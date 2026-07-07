# 团队信息登记 - 微信小程序

> 纯原生微信小程序 + Node.js 后端，可直接导入微信开发者工具编译运行，满足正式上线审核要求。

## 项目简介

团队信息登记工具，支持用户登录后提交个人信息（姓名、手机号、年龄、性别、爱好等），管理员可查看全部登记记录、统计分析并导出 Excel。

### 功能一览

| 角色 | 功能 |
|------|------|
| 用户 | 微信登录、提交登记、查看/编辑/删除自己的记录 |
| 管理员 | 密码登录、查看全部记录、统计分析（年龄分布、爱好排行）、删除任意记录、导出 Excel |

## 目录结构

```
team-register-mini/
├── miniprogram/                  # 小程序源码
│   ├── app.js                    # 全局逻辑
│   ├── app.json                  # 路由 & 全局配置
│   ├── app.wxss                  # 全局样式变量 & 通用样式
│   ├── sitemap.json
│   ├── project.config.json       # 项目配置（含 appid）
│   ├── utils/
│   │   ├── api.js                # 统一 wx.request 封装 & 全部接口
│   │   ├── auth.js               # 登录/退出/角色管理
│   │   ├── config.js             # 后端地址配置
│   │   └── validate.js           # 表单校验 & 本地统计计算
│   ├── components/
│   │   ├── entry-item/           # 登记记录条目组件
│   │   └── stats-panel/          # 统计面板组件
│   └── pages/
│       ├── index/                # 登录页（用户 + 管理员）
│       ├── register/             # 用户主页
│       ├── edit/                 # 编辑登记
│       └── admin/                # 管理员后台
├── lib/                          # 后端公共模块
│   ├── stats.js                  # 统计聚合辅助
│   ├── user-access.js            # openId 权限过滤
│   └── validation.js             # 手机号校验
├── test/                         # 单元测试（npm test）
├── server.js                     # 后端服务（Express + PostgreSQL）
├── package.json
├── .env                          # 环境变量（数据库、微信配置）
└── .env.example
```

## 快速开始

### 1. 启动后端

```bash
cd team-register-mini
npm install
cp .env.example .env        # 编辑 .env 填入真实配置
npm start
npm test        # 运行单元测试
```

`.env` 配置项：

```
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
ADMIN_PASSWORD=admin123
WECHAT_APPID=wx99b82c0a847c284b
WECHAT_SECRET=your_secret_here
```

### 2. 导入小程序

1. 打开 **微信开发者工具**
2. 导入项目，选择 `team-register-mini/` 目录
3. 填入你的小程序 AppID（或使用测试号）
4. 开发阶段勾选「详情 → 本地设置 → **不校验合法域名**」
5. 编译运行

### 3. 生产上线配置

#### 3.1 切换后端地址

修改 [miniprogram/utils/config.js](miniprogram/utils/config.js)：

```js
module.exports = {
  BASE_URL: 'https://api.your-domain.com'   // 替换为你的 HTTPS 域名
};
```

#### 3.2 配置微信小程序域名白名单

1. 登录 [微信公众平台](https://mp.weixin.qq.com)
2. 进入 **开发 → 开发管理 → 开发设置 → 服务器域名**
3. 点击「修改」，分别添加：

   | 类型 | 域名 |
   |------|------|
   | request 合法域名 | `https://api.your-domain.com` |
   | downloadFile 合法域名 | `https://api.your-domain.com` |

4. 保存（约 2-4 小时生效，每月最多修改 5 次）

#### 3.3 后端 HTTPS

- 微信小程序 **强制要求 HTTPS**，不支持 IP 和 HTTP
- 域名需已备案，SSL 证书需有效
- 建议使用 Let's Encrypt 或云服务商免费证书

## 后端接口清单

| 方法 | 路径 | 角色 | 说明 |
|------|------|------|------|
| POST | `/api/wx/login` | 用户 | 微信登录（code + name） |
| POST | `/api/login` | 用户/管理员 | 密码登录 / 姓名登录 |
| POST | `/api/logout` | 已登录 | 退出登录 |
| GET | `/api/stats` | 已登录 | 统计（管理员额外获得分布数据） |
| GET | `/api/my-entries` | 用户 | 查看自己的记录 |
| POST | `/api/entries` | 用户 | 新增登记 |
| PUT | `/api/entries/:id` | 用户 | 修改自己的记录 |
| DELETE | `/api/entries/:id` | 用户 | 删除自己的记录 |
| GET | `/api/entries` | 管理员 | 查看全部记录 |
| DELETE | `/api/admin/entries/:id` | 管理员 | 删除任意记录 |
| GET | `/api/export` | 管理员 | 导出 Excel |
| GET | `/api/health` | 无 | 健康检查 |

## 技术栈

- **前端**：微信小程序原生（WXML + WXSS + JavaScript），无第三方框架
- **后端**：Node.js + Express + PostgreSQL（Neon）
- **认证**：Token 会话机制（X-Auth-Token），Session 持久化到 PostgreSQL
- **数据隔离**：微信登录用户按 `openId` 隔离登记数据，单条记录有权限校验
- **统计性能**：`/api/stats` 使用 SQL 聚合，避免全表加载
- **不使用** web-view 套壳，可满足微信审核要求

## 测试

```bash
npm test
```

覆盖表单校验、权限过滤、统计聚合等核心逻辑（10 项单元测试）。

## sessions 表的作用

`sessions` 表用于**持久化用户登录会话**，替代原先保存在内存中的 Token 方案。

### 为什么需要它

| 对比项 | 内存 Session（旧） | PostgreSQL sessions 表（现） |
|--------|-------------------|------------------------------|
| 服务重启 | 所有用户需重新登录 | 登录态保留（24 小时内有效） |
| 多实例部署 | 各实例 Session 不共享 | 共用同一张表，可水平扩展 |
| 退出登录 | 从内存删除 | 从数据库删除对应记录 |

### 工作流程

1. **登录**（`/api/wx/login` 或 `/api/login`）：后端生成随机 `token`，写入 `sessions` 表，返回给小程序
2. **鉴权**：后续请求在请求头携带 `X-Auth-Token`，后端查表验证 token 是否有效
3. **退出**（`/api/logout`）：删除该 token 对应的记录
4. **过期清理**：会话有效期 **24 小时**，超时后自动失效；后端每 30 分钟清理一次过期记录

### 表结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `token` | VARCHAR(64) | 主键，登录凭证，对应请求头 `X-Auth-Token` |
| `role` | VARCHAR(10) | 角色：`user`（普通用户）或 `admin`（管理员） |
| `name` | VARCHAR(50) | 显示名称（用户姓名或「管理员」） |
| `open_id` | VARCHAR(64) | 微信 openId，微信登录时有值，用于数据隔离 |
| `created_at` | TIMESTAMPTZ | 创建时间，用于判断 24 小时有效期 |

小程序端将 `token` 保存在本地存储（`auth_token`），与 `sessions` 表中的记录一一对应。

## 升级说明

若从旧版本升级，重启后端后会自动迁移数据库（新增 `open_id` 字段和 `sessions` 表）。已有旧数据的 `open_id` 为空，用户需**重新微信登录**后，新登记才会绑定 openId 并正确隔离。
