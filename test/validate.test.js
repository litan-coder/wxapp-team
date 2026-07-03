const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateEntryForm,
  computeBasicStats,
  getAgeGroup,
  getAgeGroupDisplay
} = require('../miniprogram/utils/validate');

test('validateEntryForm 通过合法表单', () => {
  const result = validateEntryForm({
    age: '25',
    gender: '男',
    phone: '13800138000'
  });
  assert.equal(result.ok, true);
  assert.equal(result.age, 25);
});

test('validateEntryForm 拒绝无效手机号', () => {
  const result = validateEntryForm({
    age: '25',
    gender: '男',
    phone: '123'
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /手机号/);
});

test('computeBasicStats 统计性别数量', () => {
  const stats = computeBasicStats([
    { gender: '男' },
    { gender: '女' },
    { gender: '男' }
  ]);
  assert.deepEqual(stats, { total: 3, maleCount: 2, femaleCount: 1 });
});

test('getAgeGroup 与展示文案一致', () => {
  assert.equal(getAgeGroup(16), '18以下');
  assert.equal(getAgeGroupDisplay(16), '18岁以下');
  assert.equal(getAgeGroup(30), '26-35');
  assert.equal(getAgeGroupDisplay(30), '26-35岁');
});
