const AGE_GROUP_KEYS = ['18以下', '18-25', '26-35', '36-45', '46以上'];

/** 从 hobby 文本行聚合爱好频次 */
function parseHobbies(rows) {
  const hobbyMap = {};
  rows.forEach(row => {
    if (!row.hobby) return;
    row.hobby.split(/[,，、\s]+/).forEach(h => {
      h = h.trim();
      if (h) hobbyMap[h] = (hobbyMap[h] || 0) + 1;
    });
  });
  return hobbyMap;
}

/** 将 SQL 聚合行转为 ageGroups 对象 */
function buildAgeGroups(row) {
  return {
    '18以下': row.u18 || 0,
    '18-25': row.a18_25 || 0,
    '26-35': row.a26_35 || 0,
    '36-45': row.a36_45 || 0,
    '46以上': row.a46_plus || 0
  };
}

module.exports = { AGE_GROUP_KEYS, parseHobbies, buildAgeGroups };
