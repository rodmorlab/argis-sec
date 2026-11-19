function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET debe estar definido en entorno de producción.');
    }
    return 'dev_only_jwt_secret_change_me_in_env_file';
  }
  return secret;
}

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || '1h';
}

function getInstitutionalInbox() {
  return process.env.INSTITUTIONAL_INBOX || 'contacto@aegissec.cl';
}

module.exports = {
  getJwtSecret,
  getJwtExpiresIn,
  getInstitutionalInbox
};
