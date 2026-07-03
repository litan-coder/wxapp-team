const PHONE_REGEX = /^1[3-9]\d{9}$/;

const AGE_GROUP_DISPLAY = {
  '18以下': '18岁以下',
  '18-25': '18-25岁',
  '26-35': '26-35岁',
  '36-45': '36-45岁',
  '46以上': '46岁以上'
};

function getAgeGroup(age) {
  if (age < 18) return '18以下';
  if (age <= 25) return '18-25';
  if (age <= 35) return '26-35';
  if (age <= 45) return '36-45';
  return '46以上';
}

function getAgeGroupDisplay(age) {
  return AGE_GROUP_DISPLAY[getAgeGroup(age)] || '';
}

/** 校验登记表单，成功时返回 { ok: true, age } */
function validateEntryForm(form) {
  if (!form.age) {
    return { ok: false, message: '请输入年龄' };
  }
  const age = Number(form.age);
  if (isNaN(age) || age < 1 || age > 150) {
    return { ok: false, message: '请输入有效年龄' };
  }
  if (!form.gender) {
    return { ok: false, message: '请选择性别' };
  }
  if (!form.phone) {
    return { ok: false, message: '请输入手机号' };
  }
  if (!PHONE_REGEX.test(form.phone)) {
    return { ok: false, message: '请输入正确的11位手机号' };
  }
  return { ok: true, age };
}

/** 从记录列表计算基础统计 */
function computeBasicStats(entries) {
  let maleCount = 0;
  let femaleCount = 0;
  entries.forEach(e => {
    if (e.gender === '男') maleCount++;
    else if (e.gender === '女') femaleCount++;
  });
  return {
    total: entries.length,
    maleCount,
    femaleCount
  };
}

module.exports = {
  PHONE_REGEX,
  getAgeGroup,
  getAgeGroupDisplay,
  validateEntryForm,
  computeBasicStats
};
