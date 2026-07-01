/**
 * 后端地址配置
 *
 * 开发阶段：使用本地地址（需在开发者工具中勾选"不校验合法域名"）
 * 生产上线：改为 Render 部署的 HTTPS 域名，并在微信公众平台配置 request 合法域名
 *
 * 域名白名单配置步骤（生产上线必做）：
 * 1. 登录微信公众平台 → 开发 → 开发管理 → 开发设置
 * 2. 在「服务器域名」中配置 request 合法域名
 * 3. 将你的 Render HTTPS 域名添加进去（如 https://team-register-mini.onrender.com）
 * 4. 注意：只支持 HTTPS，不支持 IP 地址和 HTTP
 * 5. 配置后约 2-4 小时生效（每月最多修改 5 次）
 */

// 切换环境：开发用 'dev'，发布用 'prod'
const ENV = 'prod';

const URLS = {
  dev: 'http://localhost:3000',
  prod: 'https://wxapp-reg.onrender.com'  // 替换为你的 Render 实际域名
};

module.exports = {
  BASE_URL: URLS[ENV]
};