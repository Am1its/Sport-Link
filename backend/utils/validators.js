// Shared input validators for auth / profile fields. Single source of truth —
// import here instead of duplicating regex/length checks across routes.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;

function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email.trim());
}

function isValidUsername(username) {
  return typeof username === 'string' && USERNAME_RE.test(username.trim());
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

module.exports = { isValidEmail, isValidUsername, isValidPassword };
