const api = require('../../utils/api');
const auth = require('../../utils/auth');
const swipeBack = require('../../utils/swipe-back');
const { validateEntryForm, computeBasicStats } = require('../../utils/validate');

Page({
  behaviors: [swipeBack],

  data: {
    name: '',
    total: 0,
    maleCount: 0,
    femaleCount: 0,
    entries: [],
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
    if (!auth.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }
    this.setData({ name: auth.getName() });
    this.loadEntries();
  },

  onShow() {
    if (this._needRefresh) {
      this._needRefresh = false;
      this.loadEntries();
    }
  },

  /** 加载我的记录，并本地计算统计数据（减少一次 API 请求） */
  async loadEntries() {
    try {
      const res = await api.getMyEntries();
      const entries = res.entries || [];
      const stats = computeBasicStats(entries);
      this.setData({
        entries,
        total: stats.total,
        maleCount: stats.maleCount,
        femaleCount: stats.femaleCount
      });
    } catch (e) {
      console.error('加载记录失败:', e);
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

    const { form } = this.data;
    this.setData({ submitting: true });

    try {
      await api.createEntry({
        age: result.age,
        gender: form.gender,
        phone: form.phone,
        hobby: form.hobby,
        remark: form.remark
      });

      wx.showToast({ title: '登记成功！', icon: 'success' });
      this.setData({
        form: { age: '', gender: '', phone: '', hobby: '', remark: '' }
      });
      this.loadEntries();
    } catch (e) {
      wx.showToast({ title: e.message || '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  onEdit(e) {
    const id = e.detail.entry.id;
    this._needRefresh = true;
    wx.navigateTo({ url: '/pages/edit/edit?id=' + id });
  },

  onDelete(e) {
    const id = e.detail.id;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条登记记录吗？',
      confirmColor: '#e74c3c',
      success: async (res) => {
        if (!res.confirm) return;

        try {
          await api.deleteEntry(id);
          wx.showToast({ title: '已删除', icon: 'success' });
          this.loadEntries();
        } catch (e) {
          wx.showToast({ title: e.message || '删除失败', icon: 'none' });
        }
      }
    });
  },

  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (!res.confirm) return;

        auth.clearAuth();
        wx.navigateBack({ delta: 1 });
        api.logout().catch(() => {});
      }
    });
  }
});
