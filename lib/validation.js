const PHONE_REGEX = /^1[3-9]\d{9}$/;

function isValidPhone(phone) {
  return PHONE_REGEX.test(phone);
}

module.exports = { PHONE_REGEX, isValidPhone };
