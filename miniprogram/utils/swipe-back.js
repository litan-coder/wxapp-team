/**
 * 滑动返回 Behavior
 *
 * 在页面左边缘向右滑动时触发返回上一页。
 * 给页面引入后，在 wxml 根元素上绑定 data-swipe-back 即可。
 *
 * 使用方式：
 * 1. 页面 js 中：const swipeBack = require('../../utils/swipe-back')
 * 2. Page({ behaviors: [swipeBack], ... })
 * 3. 页面 wxml 根元素上：bindtouchstart="onSwipeStart" bindtouchmove="onSwipeMove" bindtouchend="onSwipeEnd"
 */
const EDGE_WIDTH = 30;       // 左边缘检测宽度（px）
const MIN_DISTANCE = 60;     // 最小滑动距离（px）
const MAX_VERTICAL = 40;     // 最大垂直偏移（防止与滚动冲突）

module.exports = Behavior({
  data: {
    __swipeStartX: 0,
    __swipeStartY: 0,
    __swipeEnabled: false
  },

  methods: {
    onSwipeStart(e) {
      const touch = e.touches[0];
      // 只在左边缘区域才能触发
      if (touch.clientX <= EDGE_WIDTH) {
        this.setData({
          __swipeStartX: touch.clientX,
          __swipeStartY: touch.clientY,
          __swipeEnabled: true
        });
      } else {
        this.setData({ __swipeEnabled: false });
      }
    },

    onSwipeMove(e) {
      if (!this.data.__swipeEnabled) return;
      // 防止垂直滚动时误触发
      const touch = e.touches[0];
      const deltaY = Math.abs(touch.clientY - this.data.__swipeStartY);
      if (deltaY > MAX_VERTICAL) {
        this.setData({ __swipeEnabled: false });
      }
    },

    onSwipeEnd(e) {
      if (!this.data.__swipeEnabled) return;
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - this.data.__swipeStartX;
      const deltaY = Math.abs(touch.clientY - this.data.__swipeStartY);

      if (deltaX >= MIN_DISTANCE && deltaY <= MAX_VERTICAL) {
        const pages = getCurrentPages();
        if (pages.length > 1) {
          wx.navigateBack({ delta: 1 });
        }
      }

      this.setData({ __swipeEnabled: false });
    }
  }
});