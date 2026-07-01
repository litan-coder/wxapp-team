const api = require('./api');

/**
 * 获取存储的 token
 */
function getToken() {
  return wx.getStorageSync('auth_token') || '';
}

/**
 * 获取存储的用户名
 */
function getName() {
  return wx.getStorageSync('auth_name') || '';
}

/**
 * 获取存储的角色
 */
function getRole() {
  return wx.getStorageSync('auth_role') || '';
}

/**
 * 是否已登录
 */
function isLoggedIn() {
  return !!getToken();
}

/**
 * 是否为管理员
 */
function isAdmin() {
  return getRole() === 'admin';
}

/**
 * 执行微信登录流程
 * 1. 调用 wx.login() 获取 code
 * 2. 发送 code + name 到后端换 token
 * 3. 存储 token 和用户名
 */
function doLogin(name) {
  return new Promise((resolve, reject) => {
    wx.login({
      success(loginRes) {
        if (!loginRes.code) {
          // 无 code 时降级为普通登录
          fallbackLogin(name, resolve, reject);
          return;
        }

        api.wxLogin(loginRes.code, name)
          .then(data => {
            saveAuth(data);
            resolve(data);
          })
          .catch(wxErr => {
            console.warn('微信登录失败，降级为普通登录:', wxErr.message);
            fallbackLogin(name, resolve, reject);
          });
      },
      fail() {
        // wx.login 失败时降级为普通登录
        console.warn('wx.login 失败，降级为普通登录');
        fallbackLogin(name, resolve, reject);
      }
    });
  });
}

/** 降级为普通用户名登录 */
function fallbackLogin(name, resolve, reject) {
  api.login({ name })
    .then(data => {
      saveAuth(data);
      resolve(data);
    })
    .catch(reject);
}

/** 保存登录状态到本地存储和 globalData */
function saveAuth(data) {
  wx.setStorageSync('auth_token', data.token);
  wx.setStorageSync('auth_name', data.name);
  wx.setStorageSync('auth_role', data.role || 'user');

  const app = getApp();
  app.globalData.token = data.token;
  app.globalData.name = data.name;
  app.globalData.role = data.role || 'user';
}

/**
 * 管理员密码登录
 * 发送密码到后端 /api/login 换 token
 */
function doAdminLogin(password) {
  return new Promise((resolve, reject) => {
    api.login({ password })
      .then(data => {
        saveAuth(data);
        resolve(data);
      })
      .catch(reject);
  });
}

/**
 * 清除登录状态
 */
function clearAuth() {
  wx.removeStorageSync('auth_token');
  wx.removeStorageSync('auth_name');
  wx.removeStorageSync('auth_role');
  const app = getApp();
  app.globalData.token = '';
  app.globalData.name = '';
  app.globalData.role = '';
}

module.exports = {
  getToken,
  getName,
  getRole,
  isLoggedIn,
  isAdmin,
  doLogin,
  doAdminLogin,
  clearAuth
};