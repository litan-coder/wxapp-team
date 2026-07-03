const config = require('./config');

/** 防重复跳转：多个请求同时返回 401 时只跳转一次 */
let _relaunching = false;

function handle401() {
  if (_relaunching) return;
  _relaunching = true;
  wx.removeStorageSync('auth_token');
  wx.removeStorageSync('auth_name');
  wx.removeStorageSync('auth_role');
  wx.reLaunch({
    url: '/pages/index/index',
    complete() {
      _relaunching = false;
    }
  });
}

function getAuthToken() {
  return wx.getStorageSync('auth_token') || '';
}

/**
 * 底层请求封装
 * @param {object} options
 * @param {boolean} options.raw - 为 true 时返回完整 response，否则返回 res.data
 */
function doRequest(options) {
  return new Promise((resolve, reject) => {
    const isBinary = options.responseType === 'arraybuffer';
    const header = {
      'X-Auth-Token': getAuthToken()
    };
    if (!isBinary) {
      header['Content-Type'] = 'application/json';
    }

    wx.request({
      url: config.BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      responseType: options.responseType || 'text',
      header,
      success(res) {
        if (res.statusCode === 401) {
          handle401();
          reject(new Error('登录已过期，请重新登录'));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(options.raw ? res : res.data);
        } else {
          const msg = (res.data && res.data.error) || '请求失败';
          reject(new Error(msg));
        }
      },
      fail() {
        reject(new Error('网络请求失败，请检查网络'));
      }
    });
  });
}

function request(options) {
  return doRequest(options);
}

function rawRequest(options) {
  return doRequest({ ...options, raw: true });
}

function wxLogin(code, name) {
  return request({
    url: '/api/wx/login',
    method: 'POST',
    data: { code, name }
  });
}

function login(data) {
  return request({
    url: '/api/login',
    method: 'POST',
    data
  });
}

function logout() {
  return request({
    url: '/api/logout',
    method: 'POST'
  });
}

function getStats() {
  return request({
    url: '/api/stats',
    method: 'GET'
  });
}

function getMyEntries() {
  return request({
    url: '/api/my-entries',
    method: 'GET'
  });
}

function createEntry(data) {
  return request({
    url: '/api/entries',
    method: 'POST',
    data
  });
}

function getEntry(id) {
  return request({
    url: '/api/entries/' + id,
    method: 'GET'
  });
}

function updateEntry(id, data) {
  return request({
    url: '/api/entries/' + id,
    method: 'PUT',
    data
  });
}

function deleteEntry(id) {
  return request({
    url: '/api/entries/' + id,
    method: 'DELETE'
  });
}

function getAllEntries() {
  return request({
    url: '/api/entries',
    method: 'GET'
  });
}

function adminDeleteEntry(id) {
  return request({
    url: '/api/admin/entries/' + id,
    method: 'DELETE'
  });
}

function exportExcel() {
  return new Promise((resolve, reject) => {
    rawRequest({
      url: '/api/export',
      method: 'GET',
      responseType: 'arraybuffer'
    })
      .then(res => {
        const fs = wx.getFileSystemManager();
        const fileName = '团队登记_' + new Date().toLocaleDateString('zh-CN').replace(/\//g, '-') + '.xlsx';
        const filePath = wx.env.USER_DATA_PATH + '/' + fileName;

        fs.writeFile({
          filePath,
          data: res.data,
          success() {
            wx.openDocument({
              filePath,
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
      })
      .catch(reject);
  });
}

module.exports = {
  wxLogin,
  login,
  logout,
  getStats,
  getMyEntries,
  createEntry,
  getEntry,
  updateEntry,
  deleteEntry,
  getAllEntries,
  adminDeleteEntry,
  exportExcel
};
