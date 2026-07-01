const api = require('../../utils/api');
const auth = require('../../utils/auth');

Page({
  data: {
    total: 0,
    maleCount: 0,
    femaleCount: 0,
    ageGroups: [],
    hobbies: [],
    entries: []
  },

  onShow() {
    // 非管理员则跳转登录页
    if (!auth.isAdmin()) {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }
    this.loadData();
  },

  /** 加载所有统计数据 */
  async loadData() {
    try {
      const stats = await api.getStats();
      const ageKeys = ['18以下', '18-25', '26-35', '36-45', '46以上'];

      // 处理年龄分布百分比
      const ageGroups = stats.ageGroups || {};
      const maxAge = Math.max(...Object.values(ageGroups), 1);
      const ageList = ageKeys.map(label => ({
        label,
        count: ageGroups[label] || 0,
        percent: maxAge > 0 ? Math.round((ageGroups[label] || 0) / maxAge * 100) : 0
      }));

      // 处理爱好排行
      const hobbies = Object.entries(stats.hobbies || {})
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }));

      // 处理登记列表（按时间倒序）
      const entries = (stats.entries || []).sort((a, b) => {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      this.setData({
        total: stats.total || 0,
        maleCount: stats.maleCount || 0,
        femaleCount: stats.femaleCount || 0,
        ageGroups: ageList,
        hobbies,
        entries
      });
    } catch (e) {
      wx.showToast({ title: e.message || '加载数据失败', icon: 'none' });
    }
  },

  /** 删除记录 */
  onDelete(e) {
    const id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条登记记录吗？此操作不可恢复。',
      confirmColor: '#e74c3c',
      success: async (res) => {
        if (!res.confirm) return;

        try {
          await api.adminDeleteEntry(id);
          wx.showToast({ title: '已删除', icon: 'success' });
          this.loadData();
        } catch (e) {
          wx.showToast({ title: e.message || '删除失败', icon: 'none' });
        }
      }
    });
  },

  /** 导出 Excel */
  async onExport() {
    wx.showModal({
      title: '导出 Excel',
      content: '确定要导出全部登记记录为 Excel 文件吗？',
      confirmColor: '#4f6ef7',
      success: async (res) => {
        if (!res.confirm) return;

        wx.showLoading({ title: '导出中...' });

        try {
          await api.exportExcel();
          wx.hideLoading();
          wx.showToast({ title: '导出成功', icon: 'success' });
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: e.message || '导出失败', icon: 'none' });
        }
      }
    });
  },

  /** 退出登录 */
  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出管理后台吗？',
      success: async (res) => {
        if (!res.confirm) return;

        try {
          await api.logout();
        } catch (e) {
          // 忽略退出接口错误
        }

        auth.clearAuth();
        wx.reLaunch({ url: '/pages/index/index' });
      }
    });
  }
});