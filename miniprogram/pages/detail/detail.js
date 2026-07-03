const swipeBack = require('../../utils/swipe-back');
const { getAgeGroupDisplay } = require('../../utils/validate');

Page({
  behaviors: [swipeBack],

  data: {
    entry: null,
    ageGroup: ''
  },

  onLoad() {
    const app = getApp();
    const entry = app.globalData.viewEntry;

    if (!entry) {
      wx.showToast({ title: '数据加载失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    this.setData({
      entry,
      ageGroup: getAgeGroupDisplay(entry.age)
    });

    app.globalData.viewEntry = null;
  },

  formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
});
