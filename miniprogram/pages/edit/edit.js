const api = require('../../utils/api');
const auth = require('../../utils/auth');
const swipeBack = require('../../utils/swipe-back');
const { validateEntryForm } = require('../../utils/validate');

Page({
  behaviors: [swipeBack],

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

  onLoad(options) {
    if (!auth.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }

    const id = options.id;
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    this.setData({ id });
    this.loadEntry(id);
  },

  async loadEntry(id) {
    try {
      const res = await api.getEntry(id);
      const entry = res.entry;
      this.setData({
        form: {
          age: String(entry.age || ''),
          gender: entry.gender || '',
          phone: entry.phone || '',
          hobby: entry.hobby || '',
          remark: entry.remark || ''
        }
      });
    } catch (e) {
      wx.showToast({ title: '数据加载失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

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

  async onSubmit() {
    if (this.data.submitting) return;

    const result = validateEntryForm(this.data.form);
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' });
      return;
    }

    const { id, form } = this.data;
    this.setData({ submitting: true });

    try {
      await api.updateEntry(id, {
        age: result.age,
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
