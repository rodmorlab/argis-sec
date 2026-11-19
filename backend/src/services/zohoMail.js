const requiredVariables = [
  'ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN', 'ZOHO_ACCOUNT_ID', 'ZOHO_FROM_EMAIL'
];
let cachedToken;
let refreshInProgress;

function hasZohoSettings() {
  return requiredVariables.some(name => Boolean(process.env[name]));
}

function createZohoTransport() {
  const missing = requiredVariables.filter(name => !process.env[name]?.trim());
  if (missing.length) throw new Error(`Configuración de Zoho incompleta: ${missing.join(', ')}`);
  const { ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ACCOUNT_ID, ZOHO_FROM_EMAIL } = process.env;
  if (!/^\d+$/.test(ZOHO_ACCOUNT_ID)) throw new Error('ZOHO_ACCOUNT_ID debe ser numérico.');
  const endpoint = `https://mail.zoho.com/api/accounts/${ZOHO_ACCOUNT_ID}/messages`;

  async function refreshToken() {
    const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: ZOHO_CLIENT_ID,
        client_secret: ZOHO_CLIENT_SECRET,
        refresh_token: ZOHO_REFRESH_TOKEN
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(10000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || typeof data.access_token !== 'string' || !data.access_token) {
      throw new Error(`Zoho no emitió un token (HTTP ${response.status}).`);
    }
    const expires = Number(data.expires_in);
    cachedToken = {
      value: data.access_token,
      usableUntil: Date.now() + (Number.isFinite(expires) ? Math.max(0, expires - 30) * 1000 : 0)
    };
    return cachedToken.value;
  }

  async function accessToken() {
    if (cachedToken && Date.now() < cachedToken.usableUntil) return cachedToken.value;
    refreshInProgress ||= refreshToken().finally(() => { refreshInProgress = undefined; });
    return refreshInProgress;
  }

  return {
    async sendMail({ to, subject, html }) {
      const token = await accessToken();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromAddress: ZOHO_FROM_EMAIL, toAddress: to, subject, content: html, mailFormat: 'html' }),
        redirect: 'error',
        signal: AbortSignal.timeout(10000)
      });
      if (response.status === 401 && cachedToken?.value === token) cachedToken = undefined;
      const data = await response.json().catch(() => ({}));
      if (!response.ok || Number(data.status?.code) !== 200) {
        throw new Error(`Zoho rechazó el envío (HTTP ${response.status}).`);
      }
      return { messageId: data.data?.messageId || data.data?.mailId || null };
    }
  };
}

module.exports = { createZohoTransport, hasZohoSettings };
