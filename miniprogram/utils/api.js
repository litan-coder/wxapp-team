const config = require('./config');

/**
 * 封装 wx.request 为 Promise
 */
function request(options) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('auth_token');

    wx.request({
      url: config.BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token || ''
      },
      success(res) {
        if (res.statusCode === 401) {
          wx.removeStorageSync('auth_token');
          wx.removeStorageSync('auth_name');
          wx.removeStorageSync('auth_role');
          wx.reLaunch({ url: '/pages/index/index' });
          reject(new Error('登录已过期，请重新登录'));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          const msg = (res.data && res.data.error) || '请求失败';
          reject(new Error(msg));
        }
      },
      fail(err) {
        reject(new Error('网络请求失败，请检查网络'));
      }
    });
  });
}

/**
 * 原始请求（用于下载二进制文件等场景）
 */
function rawRequest(options) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('auth_token');

    wx.request({
      url: config.BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      responseType: options.responseType || 'text',
      header: {
        'X-Auth-Token': token || ''
      },
      success(res) {
        if (res.statusCode === 401) {
          wx.removeStorageSync('auth_token');
          wx.removeStorageSync('auth_name');
          wx.removeStorageSync('auth_role');
          wx.reLaunch({ url: '/pages/index/index' });
          reject(new Error('登录已过期，请重新登录'));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res);
        } else {
          const msg = (res.data && res.data.error) || '请求失败';
          reject(new Error(msg));
        }
      },
      fail(err) {
        reject(new Error('网络请求失败，请检查网络'));
      }
    });
  });
}

// ========== API 方法 ==========

/** 微信登录 */
function wxLogin(code, name) {
  return request({
    url: '/api/wx/login',
    method: 'POST',
    data: { code, name }
  });
}

/** 普通登录（用户/管理员） */
function login(data) {
  return request({
    url: '/api/login',
    method: 'POST',
    data
  });
}

/** 退出登录 */
function logout() {
  return request({
    url: '/api/logout',
    method: 'POST'
  });
}

/** 获取统计数据 */
function getStats() {
  return request({
    url: '/api/stats',
    method: 'GET'
  });
}

/** 获取我的登记记录 */
function getMyEntries() {
  return request({
    url: '/api/my-entries',
    method: 'GET'
  });
}

/** 新增登记 */
function createEntry(data) {
  return request({
    url: '/api/entries',
    method: 'POST',
    data
  });
}

/** 修改登记 */
function updateEntry(id, data) {
  return request({
    url: '/api/entries/' + id,
    method: 'PUT',
    data
  });
}

/** 删除登记 */
function deleteEntry(id) {
  return request({
    url: '/api/entries/' + id,
    method: 'DELETE'
  });
}

// ========== 管理员接口 ==========

/** 管理员：获取所有登记记录 */
function getAllEntries() {
  return request({
    url: '/api/entries',
    method: 'GET'
  });
}

/** 管理员：删除任意记录 */
function adminDeleteEntry(id) {
  return request({
    url: '/api/admin/entries/' + id,
    method: 'DELETE'
  });
}

/**
 * 管理员：导出 Excel
 * 微信小程序中需要先下载文件再打开
 */
function exportExcel() {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('auth_token');

    wx.request({
      url: config.BASE_URL + '/api/export',
      method: 'GET',
      responseType: 'arraybuffer',
      header: {
        'X-Auth-Token': token || ''
      },
      success(res) {
        if (res.statusCode === 401) {
          wx.removeStorageSync('auth_token');
          wx.removeStorageSync('auth_name');
          wx.removeStorageSync('auth_role');
          wx.reLaunch({ url: '/pages/index/index' });
          reject(new Error('登录已过期，请重新登录'));
          return;
        }
        if (res.statusCode === 200) {
          // 写入临时文件
          const fs = wx.getFileSystemManager();
          const fileName = '团队登记_' + new Date().toLocaleDateString('zh-CN').replace(/\//g, '-') + '.xlsx';
          const filePath = wx.env.USER_DATA_PATH + '/' + fileName;

          fs.writeFile({
            filePath: filePath,
            data: res.data,
            success() {
              // 打开文件
              wx.openDocument({
                filePath: filePath,
                fileType: 'xlsx',
                showMenu: true,
                success() {
                  resolve({ ok: true });
                },
                fail(err) {
                  reject(new Error('打开文件失败: ' + (err.errMsg || '')));
                }
              });
            },
            fail(err) {
              reject(new Error('文件保存失败: ' + (err.errMsg || '')));
            }
          });
        } else {
          reject(new Error('导出失败'));
        }
      },
      fail(err) {
        reject(new Error('网络请求失败，请检查网络'));
      }
    });
  });
}

module.exports = {
  wxLogin,
  login,
  logout,
  getStats,
  getMyEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  getAllEntries,
  adminDeleteEntry,
  exportExcel
};