const jwt = require('jsonwebtoken');

function generateToken(userId) {
  const expiresIn =
    typeof process.env.JWT_EXPIRES_IN === 'string' && process.env.JWT_EXPIRES_IN.trim()
      ? process.env.JWT_EXPIRES_IN.trim()
      : '7d';

  return jwt.sign({ id: String(userId) }, process.env.JWT_SECRET, {
    expiresIn,
  });
}

module.exports = generateToken;
