const api = require('../../utils/api');
const auth = require('../../utils/auth');

Page({
  data: {
    id: '',
    form: {
      age: '',
      gender: '',
      phone: '',
      hobby: '',
      remark: ''
    },
    submitting: false
  },

  onLoad() {
    // 未登录则跳转登录页
    if (!auth.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }

    const app = getApp();
    const entry = app.globalData.editEntry;

    if (!entry) {
      wx.showToast({ title: '数据加载失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    this.setData({
      id: entry.id,
      form: {
        age: String(entry.age || ''),
        gender: entry.gender || '',
        phone: entry.phone || '',
        hobby: entry.hobby || '',
        remark: entry.remark || ''
      }
    });

    // 清除全局数据
    app.globalData.editEntry = null;
  },

  // ========== 表单事件 ==========

  onAgeInput(e) {
    this.setData({ 'form.age': e.detail.value });
  },

  onGenderChange(e) {
    this.setData({ 'form.gender': e.detail.value });
  },

  onPhoneInput(e) {
    this.setData({ 'form.phone': e.detail.value });
  },

  onHobbyInput(e) {
    this.setData({ 'form.hobby': e.detail.value });
  },

  onRemarkInput(e) {
    this.setData({ 'form.remark': e.detail.value });
  },

  /** 提交修改 */
  async onSubmit() {
    const { id, form } = this.data;

    // 校验
    if (!form.age) {
      wx.showToast({ title: '请输入年龄', icon: 'none' });
      return;
    }
    const age = Number(form.age);
    if (isNaN(age) || age < 1 || age > 150) {
      wx.showToast({ title: '请输入有效年龄', icon: 'none' });
      return;
    }
    if (!form.gender) {
      wx.showToast({ title: '请选择性别', icon: 'none' });
      return;
    }
    if (!form.phone) {
      wx.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(form.phone)) {
      wx.showToast({ title: '请输入正确的11位手机号', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    try {
      await api.updateEntry(id, {
        age: age,
        gender: form.gender,
        phone: form.phone,
        hobby: form.hobby,
        remark: form.remark
      });

      wx.showToast({ title: '修改成功！', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (e) {
      wx.showToast({ title: e.message || '修改失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
