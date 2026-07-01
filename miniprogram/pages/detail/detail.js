const swipeBack = require('../../utils/swipe-back');

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

    // 计算年龄段
    const age = entry.age;
    let ageGroup = '';
    if (age < 18) ageGroup = '18岁以下';
    else if (age <= 25) ageGroup = '18-25岁';
    else if (age <= 35) ageGroup = '26-35岁';
    else if (age <= 45) ageGroup = '36-45岁';
    else ageGroup = '46岁以上';

    this.setData({ entry, ageGroup });

    // 清除全局数据
    app.globalData.viewEntry = null;
  },

  /** 格式化时间 */
  formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
});