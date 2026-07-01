App({
  globalData: {
    token: '',
    name: '',
    role: '',
    editEntry: null  // 传递编辑数据到编辑页
  },

  onLaunch() {
    // 检查本地存储的 token
    const token = wx.getStorageSync('auth_token');
    const name = wx.getStorageSync('auth_name');
    const role = wx.getStorageSync('auth_role');
    if (token && name) {
      this.globalData.token = token;
      this.globalData.name = name;
      this.globalData.role = role || 'user';
    }
  }
});