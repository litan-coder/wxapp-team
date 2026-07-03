const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseHobbies, buildAgeGroups } = require('../lib/stats');
const { buildOwnerFilter, canAccessEntry } = require('../lib/user-access');
const { isValidPhone } = require('../lib/validation');

test('parseHobbies 聚合多种分隔符', () => {
  const rows = [
    { hobby: '篮球, 阅读' },
    { hobby: '篮球、游泳' },
    { hobby: '阅读' }
  ];
  const result = parseHobbies(rows);
  assert.equal(result['篮球'], 2);
  assert.equal(result['阅读'], 2);
  assert.equal(result['游泳'], 1);
});

test('buildAgeGroups 映射 SQL 聚合结果', () => {
  const groups = buildAgeGroups({
    u18: 1,
    a18_25: 2,
    a26_35: 3,
    a36_45: 4,
    a46_plus: 5
  });
  assert.deepEqual(groups, {
    '18以下': 1,
    '18-25': 2,
    '26-35': 3,
    '36-45': 4,
    '46以上': 5
  });
});

test('buildOwnerFilter 优先使用 openId', () => {
  const filter = buildOwnerFilter({ role: 'user', name: '张三', openId: 'oid-1' });
  assert.equal(filter.clause, 'open_id = $1');
  assert.deepEqual(filter.params, ['oid-1']);
});

test('buildOwnerFilter 无 openId 时降级为姓名', () => {
  const filter = buildOwnerFilter({ role: 'user', name: '张三' });
  assert.equal(filter.clause, 'name = $1 AND open_id IS NULL');
  assert.deepEqual(filter.params, ['张三']);
});

test('canAccessEntry 校验记录归属', () => {
  const userSession = { role: 'user', name: '张三', openId: 'oid-1' };
  const adminSession = { role: 'admin', name: '管理员' };

  assert.equal(canAccessEntry(userSession, { open_id: 'oid-1', name: '张三' }), true);
  assert.equal(canAccessEntry(userSession, { open_id: 'oid-2', name: '李四' }), false);
  assert.equal(canAccessEntry(adminSession, { open_id: 'oid-2', name: '李四' }), true);
});

test('isValidPhone 校验手机号', () => {
  assert.equal(isValidPhone('13800138000'), true);
  assert.equal(isValidPhone('12345'), false);
  assert.equal(isValidPhone('23800138000'), false);
});
