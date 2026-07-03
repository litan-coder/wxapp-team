/**
 * 根据会话构建用户数据归属条件（openId 优先，无 openId 时降级为姓名）
 */
function buildOwnerFilter(session, paramIndex = 1) {
  if (session.openId) {
    return {
      clause: `open_id = $${paramIndex}`,
      params: [session.openId]
    };
  }
  return {
    clause: `name = $${paramIndex} AND open_id IS NULL`,
    params: [session.name]
  };
}

/** 判断用户是否有权访问某条记录 */
function canAccessEntry(session, entry) {
  if (session.role === 'admin') return true;
  if (session.openId) return entry.open_id === session.openId;
  return entry.name === session.name && !entry.open_id;
}

module.exports = { buildOwnerFilter, canAccessEntry };
