const api = require('../../utils/api');
const auth = require('../../utils/auth');
const swipeBack = require('../../utils/swipe-back');

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
    // 未登录则跳转登录页
    if (!auth.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }
    this.setData({ name: auth.getName() });
    this.loadData();
  },

  onShow() {
    // 从编辑页返回时仅标记需要刷新，避免每次 onShow 都请求
    if (this._needRefresh) {
      this._needRefresh = false;
      this.loadData();
    }
  },

  /** 加载统计和记录 */
  async loadData() {
    await Promise.all([this.loadStats(), this.loadEntries()]);
  },

  /** 加载统计数据 */
  async loadStats() {
    try {
      const stats = await api.getStats();
      this.setData({
        total: stats.total || 0,
        maleCount: stats.maleCount || 0,
        femaleCount: stats.femaleCount || 0
      });
    } catch (e) {
      console.error('加载统计失败:', e);
    }
  },

  /** 加载我的记录 */
  async loadEntries() {
    try {
      const res = await api.getMyEntries();
      this.setData({ entries: res.entries || [] });
    } catch (e) {
      console.error('加载记录失败:', e);
    }
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

  /** 提交登记 */
  async onSubmit() {
    // 防重复提交
    if (this.data.submitting) return;

    const { form } = this.data;

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
      await api.createEntry({
        age: age,
        gender: form.gender,
        phone: form.phone,
        hobby: form.hobby,
        remark: form.remark
      });

      wx.showToast({ title: '登记成功！', icon: 'success' });

      // 重置表单
      this.setData({
        form: { age: '', gender: '', phone: '', hobby: '', remark: '' }
      });

      // 刷新数据
      this.loadData();
    } catch (e) {
      wx.showToast({ title: e.message || '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  // ========== 记录操作 ==========

  /** 编辑记录 */
  onEdit(e) {
    const id = e.detail.entry.id;
    this._needRefresh = true;
    wx.navigateTo({ url: '/pages/edit/edit?id=' + id });
  },

  /** 删除记录 */
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
          this.loadData();
        } catch (e) {
          wx.showToast({ title: e.message || '删除失败', icon: 'none' });
        }
      }
    });
  },

  /** 返回首页 */
  onHome() {
    auth.clearAuth();
    wx.reLaunch({ url: '/pages/index/index' });
    api.logout().catch(() => {});
  },

  /** 退出登录 */
  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (!res.confirm) return;

        // 先清除登录状态，再跳转，避免 401 触发的 handle401 导致双重 reLaunch
        auth.clearAuth();
        wx.reLaunch({ url: '/pages/index/index' });

        // 通知后端（fire-and-forget，不阻塞跳转）
        api.logout().catch(() => {});
      }
    });
  }
});
