const auth = require('../../utils/auth');

Page({
  data: {
    name: '',
    password: '',
    tab: 'user',       // 'user' | 'admin'
    loading: false
  },

  onLoad() {
    // 已登录则根据角色跳转
    if (auth.isLoggedIn()) {
      // 使用 reLaunch 确保跳转成功，redirectTo 在 onLoad 中可能不稳定
      if (auth.isAdmin()) {
        wx.reLaunch({ url: '/pages/admin/admin' });
      } else {
        wx.reLaunch({ url: '/pages/register/register' });
      }
    }
  },

  /** 切换登录 Tab */
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ tab, name: '', password: '' });
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  /** 用户登录 */
  async onUserLogin() {
    const name = this.data.name.trim();

    if (!name) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    try {
      await auth.doLogin(name);
      wx.reLaunch({ url: '/pages/register/register' });
    } catch (e) {
      wx.showToast({ title: e.message || '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /** 管理员登录 */
  async onAdminLogin() {
    const password = this.data.password;

    if (!password) {
      wx.showToast({ title: '请输入管理员密码', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    try {
      await auth.doAdminLogin(password);
      wx.reLaunch({ url: '/pages/admin/admin' });
    } catch (e) {
      wx.showToast({ title: e.message || '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  }
});