/**
 * AegisSec Enterprise - Frontend Integral Conectado a API REST Real
 * Se comunica con el backend Node.js + Express + Mongoose + Argon2id + JWT
 * mediante el cliente HTTP apiFetch().
 */

const IS_LOCAL_HOST =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'file:');

// Si despliegas el frontend en Vercel/Netlify separado del backend en Render/Railway, pega aquí la URL HTTPS de tu backend (ej. 'https://aegissec-api.onrender.com/api'). Si dejas '', usará automáticamente el mismo dominio HTTPS cuando se sirva desde Render/Railway o 'http://localhost:4000/api' en desarrollo local.
const PRODUCTION_API_URL = '';

const API_CONFIG = {
  BASE_URL:
    PRODUCTION_API_URL ||
    (IS_LOCAL_HOST
      ? 'http://localhost:4000/api'
      : window.AEGIS_API_BASE_URL || `${window.location.origin}/api`),
  SESSION_KEY: 'aegissec_jwt_token_v1'
};

const appState = {
  services: [],
  bookings: [],
  socials: [],
  faqs: [],
  adminUsers: [],
  adminContacts: [],
  adminFaqs: [],
  captchaToken: null
};

/* =========================================================
   1. UTILIDADES DE SEGURIDAD Y CLIENTE HTTP (apiFetch)
   ========================================================= */

function escapeHtml(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function stripHeaderInjection(str) {
  return String(str || '').replace(/[\r\n]+/g, ' ').trim();
}

function getStoredToken() {
  return (
    sessionStorage.getItem(API_CONFIG.SESSION_KEY) ||
    localStorage.getItem(API_CONFIG.SESSION_KEY) ||
    null
  );
}

function setStoredToken(token) {
  if (token) {
    sessionStorage.setItem(API_CONFIG.SESSION_KEY, token);
    localStorage.setItem(API_CONFIG.SESSION_KEY, token);
  } else {
    sessionStorage.removeItem(API_CONFIG.SESSION_KEY);
    localStorage.removeItem(API_CONFIG.SESSION_KEY);
  }
}

function base64UrlDecode(str) {
  try {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    return JSON.parse(decodeURIComponent(escape(atob(base64))));
  } catch (_e) {
    return null;
  }
}

function parseJwtForUi(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Token ausente (HTTP 401)' };
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'Formato JWT inválido' };
  }
  const header = base64UrlDecode(parts[0]);
  const payload = base64UrlDecode(parts[1]);
  if (!header || !payload) {
    return { valid: false, reason: 'No se pudo decodificar el token' };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < nowSec) {
    return {
      valid: false,
      reason: 'Token expirado (HTTP 401 TokenExpiredError)',
      header,
      payload,
      parts
    };
  }
  return { valid: true, header, payload, parts };
}

/**
 * Cliente HTTP centralizado hacia la API REST.
 * Adjunta Authorization: Bearer <token> e interpreta 401 / 403 / 429.
 */
async function apiFetch(endpoint, options = {}) {
  const token = getStoredToken();
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      ...options,
      headers
    });
  } catch (_networkErr) {
    const err = new Error('No se pudo conectar con el servidor API (http://localhost:4000/api).');
    err.status = 0;
    if (!options.silentNetwork) {
      showToast(err.message, 'error');
    }
    throw err;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg = data.error || `Error HTTP ${response.status}`;

    if (response.status === 401) {
      if (!options.silent401) {
        showToast(`HTTP 401 Unauthorized: ${msg}`, 'error');
      }
      const lockedNotice = document.getElementById('reservasLockedNotice');
      if (lockedNotice && document.getElementById('view-reservas')?.classList.contains('active')) {
        lockedNotice.style.display = 'block';
      }
    } else if (response.status === 403) {
      if (!options.silent403) {
        showToast(`HTTP 403 Forbidden: ${msg}`, 'error');
      }
      const forbiddenNotice = document.getElementById('adminForbiddenNotice');
      const adminContent = document.getElementById('adminProtectedContent');
      if (forbiddenNotice && adminContent) {
        forbiddenNotice.style.display = 'block';
        adminContent.style.display = 'none';
      }
    } else if (response.status === 429) {
      showToast(msg, 'error');
    }

    const err = new Error(msg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

/* =========================================================
   2. GESTIÓN DE SESIÓN Y ESTADO DE NAVEGACIÓN (SPA)
   ========================================================= */

function getCurrentSession() {
  const token = getStoredToken();
  if (!token) {
    return { authenticated: false, role: 'visitante', user: null, token: null };
  }
  const check = parseJwtForUi(token);
  if (!check.valid) {
    return {
      authenticated: false,
      role: 'visitante',
      user: null,
      token,
      expiredError: check.reason,
      decoded: check
    };
  }
  return {
    authenticated: true,
    role: check.payload.role,
    user: {
      _id: check.payload.sub,
      name: check.payload.name,
      email: check.payload.email,
      role: check.payload.role
    },
    token,
    decoded: check
  };
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4200);
}

function switchView(viewName) {
  document.querySelectorAll('.view-section').forEach((sec) => sec.classList.remove('active'));
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  if (viewName === 'contacto' && !appState.captchaToken) {
    loadCaptchaChallenge();
  }

  updateAllViews();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchAuthTab(tab, btnEl) {
  document.querySelectorAll('#view-auth .subtab-btn').forEach((b) => b.classList.remove('active'));
  btnEl.classList.add('active');
  document.getElementById('authLoginForm').classList.toggle('active', tab === 'login');
  document.getElementById('authRegisterForm').classList.toggle('active', tab === 'register');
}

function switchAdminTab(tabName, btnEl) {
  document.querySelectorAll('#view-admin .subtab-btn').forEach((b) => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  document.querySelectorAll('#view-admin .subtab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `admin-tab-${tabName}`);
  });
  if (tabName === 'nosql') renderNoSqlExplorer();
}

/* =========================================================
   3. CONTROLADORES DE AUTENTICACIÓN, REGISTRO Y JWT
   ========================================================= */

function updateLiveHashPreview() {
  const val = document.getElementById('regPassword').value;
  const previewEl = document.getElementById('liveArgonPreview');
  if (!previewEl) return;
  if (!val) {
    previewEl.textContent = '$argon2id$v=19$m=65536,t=3,p=4$ElHashSeGeneraEnElServidorAlRegistrar...';
    return;
  }
  if (val.length < 8) {
    previewEl.textContent = `Contraseña ingresada (${val.length}/8 chars mínimo). El hash Argon2id se generará en el backend.`;
    return;
  }
  previewEl.textContent = `Política válida (${val.length} chars) → El servidor aplicará argon2.hash(..., { type: argon2.argon2id }).`;
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;

  try {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      silent401: true
    });

    setStoredToken(data.token);
    showToast(`Bienvenido/a ${data.user.name}. Token JWT emitido (${data.user.role.toUpperCase()}).`);
    await updateAllViews();
  } catch (err) {
    if (err.status !== 429 && err.status !== 0) {
      showToast(err.message || 'Credenciales inválidas. Verifica tu correo o contraseña.', 'error');
    }
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = stripHeaderInjection(document.getElementById('regName').value);
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const password = document.getElementById('regPassword').value;

  if (password.length < 8) {
    showToast('La contraseña debe tener al menos 8 caracteres.', 'error');
    return;
  }

  try {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });

    setStoredToken(data.token);
    e.target.reset();
    updateLiveHashPreview();
    showToast(`Usuario registrado con hash Argon2id y autenticado como ${data.user.role.toUpperCase()}.`);
    await updateAllViews();
  } catch (err) {
    if (err.status !== 0) {
      showToast(err.message, 'error');
    }
  }
}

async function quickDemoLogin(email) {
  const demoPasswords = {
    'admin@aegissec.cl': 'AdminSec2026!',
    'cliente@empresa.cl': 'Cliente2026!'
  };
  const password = demoPasswords[email.toLowerCase()];
  if (!password) return;

  try {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      silent401: true
    });
    setStoredToken(data.token);
    showToast(`Sesión cambiada a: ${data.user.name} [Rol: ${data.user.role.toUpperCase()}]`);
    await updateAllViews();
  } catch (err) {
    if (err.status !== 429 && err.status !== 0) {
      showToast(err.message, 'error');
    }
  }
}

function forceExpireToken() {
  const encode = (obj) =>
    btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  const expiredHeader = encode({ alg: 'HS256', typ: 'JWT' });
  const expiredPayload = encode({
    sub: 'demo_expired',
    name: 'Sesión Expirada Demo',
    email: 'demo@aegissec.cl',
    role: 'usuario',
    iat: 1700000000,
    exp: 1700003600
  });
  setStoredToken(`${expiredHeader}.${expiredPayload}.invalid_expired_signature`);
  showToast('Se ha inyectado un Token JWT expirado para probar la respuesta HTTP 401.', 'warn');
  updateAllViews();
}

async function renewJwtToken() {
  try {
    const data = await apiFetch('/auth/refresh', {
      method: 'POST'
    });
    setStoredToken(data.token);
    showToast('Token JWT renovado exitosamente por 60 minutos adicionales.');
    await updateAllViews();
  } catch (_err) {
    // apiFetch ya mostró el toast correspondiente (401/etc.)
  }
}

function logoutUser() {
  setStoredToken(null);
  appState.bookings = [];
  appState.adminUsers = [];
  appState.adminContacts = [];
  appState.adminFaqs = [];
  showToast('Sesión cerrada. Token JWT eliminado del cliente.', 'warn');
  updateAllViews();
}

async function testProtectedEndpoint() {
  const out = document.getElementById('endpointTestResult');
  if (!out) return;

  try {
    const data = await apiFetch('/admin/audit', {
      method: 'GET',
      silent401: true,
      silent403: true
    });
    out.innerHTML = `<div class="badge badge-success">HTTP 200 OK</div> <span style="color:#047857;">${escapeHtml(data.message)}</span>`;
  } catch (err) {
    if (err.status === 401) {
      out.innerHTML = `<div class="badge badge-danger">HTTP 401 Unauthorized</div> <span style="color:var(--danger);">${escapeHtml(err.message)}</span>`;
    } else if (err.status === 403) {
      out.innerHTML = `<div class="badge badge-warn">HTTP 403 Forbidden</div> <span style="color:#b45309;">${escapeHtml(err.message)}</span>`;
    } else {
      out.innerHTML = `<div class="badge badge-danger">Error</div> <span style="color:var(--danger);">${escapeHtml(err.message)}</span>`;
    }
  }
}

/* =========================================================
   4. CARGA Y RENDERIZADO DE VISTAS Y GUARDAS RBAC
   ========================================================= */

async function loadPublicData() {
  try {
    const [services, socials, faqs] = await Promise.all([
      apiFetch('/services', { silentNetwork: true }),
      apiFetch('/socials', { silentNetwork: true }),
      apiFetch('/chatbot/faqs', { silentNetwork: true })
    ]);
    appState.services = Array.isArray(services) ? services : [];
    appState.socials = Array.isArray(socials) ? socials : [];
    appState.faqs = Array.isArray(faqs) ? faqs : [];
  } catch (_err) {
    // Error manejado de forma no bloqueante al iniciar
  }
}

async function updateAllViews() {
  const session = getCurrentSession();

  // Actualizar barra superior y botón de sesión
  const roleBadge = document.getElementById('currentRoleBadge');
  const btnAuth = document.getElementById('btnNavAuth');
  const btnLogout = document.getElementById('btnNavLogout');
  const timerBadge = document.getElementById('jwtTimerBadge');

  if (session.authenticated) {
    roleBadge.textContent = `Rol: ${session.role === 'admin' ? 'Administrador' : 'Usuario Registrado'} (${session.user.name.split(' ')[0]})`;
    roleBadge.className = `role-badge ${session.role === 'admin' ? 'admin' : ''}`;
    btnAuth.textContent = 'Inspector JWT';
    btnLogout.style.display = 'inline-flex';
    const remainingMin = Math.max(
      0,
      Math.round((session.decoded.payload.exp - Math.floor(Date.now() / 1000)) / 60)
    );
    timerBadge.className = 'sec-pill';
    timerBadge.innerHTML = `<span class="dot"></span> JWT Válido (Expira en ${remainingMin} min)`;
  } else {
    roleBadge.textContent = 'Rol: Visitante';
    roleBadge.className = 'role-badge guest';
    btnAuth.textContent = 'Iniciar Sesión / Registro';
    btnLogout.style.display = 'none';
    timerBadge.className = 'sec-pill warn';
    timerBadge.textContent = session.expiredError
      ? `Alerta: ${session.expiredError}`
      : 'Sesión: Visitante (Sin Token)';
  }

  await loadPublicData();

  const statCount = document.getElementById('statServicesCount');
  if (statCount) statCount.textContent = appState.services.length;

  renderServices();
  renderJwtInspector(session);
  renderFooterSocials();
  renderChatQuickChips();

  await renderReservasView(session);
  await renderAdminView(session);
}

function renderServices() {
  const query = (document.getElementById('searchServiceInput')?.value || '').toLowerCase();
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;

  const filtered = appState.services.filter(
    (s) =>
      s.title.toLowerCase().includes(query) ||
      s.category.toLowerCase().includes(query) ||
      s.description.toLowerCase().includes(query)
  );

  grid.innerHTML = filtered
    .map(
      (srv) => `
    <article class="card">
      <div>
        <span class="card-tag">${escapeHtml(srv.category)}</span>
        <h3>${escapeHtml(srv.title)}</h3>
        <p>${escapeHtml(srv.description)}</p>
      </div>
      <div class="card-footer">
        <span class="price-tag">${escapeHtml(srv.price)}</span>
        <button class="btn btn-sm btn-primary" onclick="preselectServiceForBooking('${escapeHtml(srv._id)}')">
          Solicitar Servicio →
        </button>
      </div>
    </article>
  `
    )
    .join('');
}

function preselectServiceForBooking(serviceId) {
  const srv = appState.services.find((s) => s._id === serviceId);
  switchView('reservas');
  setTimeout(() => {
    const select = document.getElementById('bookingServiceSelect');
    if (select && srv) {
      select.value = srv.title;
    }
  }, 60);
}

async function renderReservasView(session) {
  const lockedNotice = document.getElementById('reservasLockedNotice');
  const protectedContent = document.getElementById('reservasProtectedContent');
  const select = document.getElementById('bookingServiceSelect');
  const tbody = document.getElementById('userBookingsTableBody');

  if (select) {
    const prevValue = select.value;
    select.innerHTML = appState.services
      .map(
        (s) =>
          `<option value="${escapeHtml(s.title)}">${escapeHtml(s.title)} (${escapeHtml(s.price)})</option>`
      )
      .join('');
    if (prevValue && appState.services.some((s) => s.title === prevValue)) {
      select.value = prevValue;
    }
  }

  if (!session.authenticated) {
    lockedNotice.style.display = 'block';
    protectedContent.style.opacity = '0.45';
    protectedContent.style.pointerEvents = 'none';
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Inicia sesión para consultar tus solicitudes</td></tr>`;
    }
    return;
  }

  try {
    const bookings = await apiFetch('/bookings', { silent401: true });
    appState.bookings = Array.isArray(bookings) ? bookings : [];
    lockedNotice.style.display = 'none';
    protectedContent.style.opacity = '1';
    protectedContent.style.pointerEvents = 'auto';
  } catch (err) {
    if (err.status === 401) {
      lockedNotice.style.display = 'block';
      protectedContent.style.opacity = '0.45';
      protectedContent.style.pointerEvents = 'none';
    }
    return;
  }

  if (!tbody) return;
  if (appState.bookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Aún no tienes solicitudes registradas.</td></tr>`;
  } else {
    tbody.innerHTML = appState.bookings
      .map(
        (b) => `
      <tr>
        <td><strong>${escapeHtml(b.serviceTitle)}</strong><br/><small>${escapeHtml(b.notes)}</small></td>
        <td>${escapeHtml(b.preferredDate)}</td>
        <td><span class="badge ${b.priority === 'Crítica' ? 'badge-danger' : 'badge-info'}">${escapeHtml(b.priority)}</span></td>
        <td><span class="badge ${b.status === 'Aprobada' ? 'badge-success' : 'badge-warn'}">${escapeHtml(b.status)}</span></td>
      </tr>
    `
      )
      .join('');
  }
}

async function handleCreateBooking(e) {
  e.preventDefault();
  const serviceTitle = document.getElementById('bookingServiceSelect').value;
  const preferredDate = document.getElementById('bookingDate').value;
  const priority = document.getElementById('bookingPriority').value;
  const notes = stripHeaderInjection(document.getElementById('bookingNotes').value);

  try {
    await apiFetch('/bookings', {
      method: 'POST',
      body: JSON.stringify({ serviceTitle, preferredDate, priority, notes })
    });
    e.target.reset();
    const dateInput = document.getElementById('bookingDate');
    if (dateInput) {
      dateInput.value = new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];
    }
    showToast('Solicitud guardada en MongoDB correctamente.');
    await updateAllViews();
  } catch (err) {
    if (err.status !== 401 && err.status !== 0) {
      showToast(err.message, 'error');
    }
  }
}

function renderJwtInspector(session) {
  const box = document.getElementById('jwtInspectorView');
  if (!box) return;

  if (!session.token || !session.decoded) {
    box.innerHTML = `// Estado: Visitante sin token activo.\n// Inicia sesión o usa los botones de "Modo Evaluación Rápida" arriba para inspeccionar el JWT.`;
    return;
  }

  const d = session.decoded;
  box.innerHTML = `<div style="margin-bottom:8px;"><strong>Token Compacto (Authorization: Bearer):</strong><br/>
<span class="jwt-part-header">${escapeHtml(d.parts[0])}</span>.<span class="jwt-part-payload">${escapeHtml(d.parts[1])}</span>.<span class="jwt-part-sig">${escapeHtml(d.parts[2])}</span></div>
<div class="jwt-part-header">// 1. HEADER: ${escapeHtml(JSON.stringify(d.header))}</div>
<div class="jwt-part-payload">// 2. PAYLOAD (Sin contraseñas ni secretos expuestos):\n${escapeHtml(JSON.stringify(d.payload, null, 2))}</div>
<div class="jwt-part-sig">// 3. SIGNATURE: HMACSHA256(base64UrlEncode(header) + "." + base64UrlEncode(payload), process.env.JWT_SECRET)</div>`;
}

/* =========================================================
   5. FORMULARIO DE CONTACTO, CAPTCHA BACKEND Y DOBLE CORREO
   ========================================================= */

async function loadCaptchaChallenge() {
  try {
    const data = await apiFetch('/contacts/captcha', { silentNetwork: true });
    appState.captchaToken = data.captchaToken;
    const qEl = document.getElementById('captchaQuestionText');
    if (qEl) qEl.textContent = data.question;
  } catch (_err) {
    const qEl = document.getElementById('captchaQuestionText');
    if (qEl) qEl.textContent = 'Desafío no disponible (verifica API)';
  }
}

function updateContactCounter() {
  const txt = document.getElementById('contactMessage')?.value || '';
  const counter = document.getElementById('contactCharCount');
  if (counter) counter.textContent = `${txt.length} / 500 caracteres`;
}

async function handleContactSubmit(e) {
  e.preventDefault();

  if (!appState.captchaToken) {
    await loadCaptchaChallenge();
  }

  const name = stripHeaderInjection(document.getElementById('contactName').value);
  const email = stripHeaderInjection(document.getElementById('contactEmail').value.toLowerCase());
  const phone = stripHeaderInjection(document.getElementById('contactPhone').value || 'No indicado');
  const subject = stripHeaderInjection(document.getElementById('contactSubject').value);
  const message = document.getElementById('contactMessage').value.trim();
  const captchaAnswer = document.getElementById('captchaAnswerInput').value;

  try {
    const result = await apiFetch('/contacts', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        phone,
        subject,
        message,
        captchaToken: appState.captchaToken,
        captchaAnswer
      })
    });

    const { contact, smtp } = result;
    const ticketId = contact.ticketId;

    document.getElementById('mailPreviewInstitutional').innerHTML = `
      <strong>Asunto:</strong> [Nuevo Ticket ${escapeHtml(ticketId)}] ${escapeHtml(contact.subject)}<br/>
      <strong>Destinatario Fijo:</strong> <code>${escapeHtml(smtp.institutionalInbox)}</code> · Modo: <code>${escapeHtml(smtp.mode)}</code><br/>
      <strong>Remitente Validado:</strong> ${escapeHtml(contact.name)} (${escapeHtml(contact.email)} · Tel: ${escapeHtml(contact.phone)})<br/>
      <strong>Mensaje Sanitizado:</strong> "${escapeHtml(contact.message)}"<br/>
      <span class="badge ${smtp.smtpInstitutionalSent ? 'badge-success' : 'badge-warn'}" style="margin-top:6px;">
        ${smtp.smtpInstitutionalSent ? 'Registrado en MongoDB y entregado a buzón institucional' : 'Registrado en MongoDB (revisar configuración SMTP)'}
      </span>
    `;

    document.getElementById('mailClientRecipient').textContent = contact.email;
    document.getElementById('mailPreviewClient').innerHTML = `
      <strong>Asunto:</strong> Hemos recibido tu consulta (${escapeHtml(ticketId)}) - AegisSec Enterprise<br/>
      <strong>Cuerpo:</strong> Hola <b>${escapeHtml(contact.name)}</b>, confirmamos la recepción de tu solicitud sobre <em>"${escapeHtml(contact.subject)}"</em>. Nuestro equipo te responderá a la brevedad.<br/>
      <span class="badge ${smtp.smtpClientCopySent ? 'badge-info' : 'badge-warn'}" style="margin-top:6px;">
        ${smtp.smtpClientCopySent ? `Copia automática procesada (${escapeHtml(smtp.mode)})` : 'Error al despachar copia al cliente'}
      </span>
    `;

    e.target.reset();
    updateContactCounter();
    await loadCaptchaChallenge();
    showToast('Consulta guardada en MongoDB y doble despacho Nodemailer ejecutado.');
    await updateAllViews();
  } catch (err) {
    if (err.status !== 429 && err.status !== 0) {
      showToast(err.message, 'error');
    }
    await loadCaptchaChallenge();
  }
}

/* =========================================================
   6. PANEL ADMINISTRATIVO (USUARIOS, SERVICIOS, REDES, CHATBOT, NOSQL)
   ========================================================= */

async function renderAdminView(session) {
  const forbiddenNotice = document.getElementById('adminForbiddenNotice');
  const adminContent = document.getElementById('adminProtectedContent');

  if (!session.authenticated || session.role !== 'admin') {
    forbiddenNotice.style.display = 'block';
    adminContent.style.display = 'none';
    return;
  }

  try {
    const [users, contacts, bookings, faqs] = await Promise.all([
      apiFetch('/admin/users', { silent401: true, silent403: true }),
      apiFetch('/contacts', { silent401: true, silent403: true }),
      apiFetch('/bookings', { silent401: true, silent403: true }),
      apiFetch('/chatbot/faqs/admin', { silent401: true, silent403: true })
    ]);

    appState.adminUsers = Array.isArray(users) ? users : [];
    appState.adminContacts = Array.isArray(contacts) ? contacts : [];
    appState.bookings = Array.isArray(bookings) ? bookings : [];
    appState.adminFaqs = Array.isArray(faqs) ? faqs : [];

    forbiddenNotice.style.display = 'none';
    adminContent.style.display = 'block';
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      forbiddenNotice.style.display = 'block';
      adminContent.style.display = 'none';
    }
    return;
  }

  // 1. Tabla de Usuarios
  document.getElementById('adminUsersTable').innerHTML = appState.adminUsers
    .map(
      (u) => `
    <tr>
      <td><span class="code-chip">${escapeHtml(u._id)}</span></td>
      <td><strong>${escapeHtml(u.name)}</strong></td>
      <td>${escapeHtml(u.email)}</td>
      <td><span class="badge ${u.role === 'admin' ? 'badge-danger' : 'badge-info'}">${escapeHtml(u.role.toUpperCase())}</span></td>
      <td><span class="code-chip" title="Hash Argon2id protegido en servidor">${escapeHtml(u.passwordHashPreview || 'Argon2id')}</span></td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="toggleUserRole('${escapeHtml(u._id)}')">Cambiar Rol</button>
      </td>
    </tr>
  `
    )
    .join('');

  // 2. Tabla de Servicios
  document.getElementById('adminServicesTable').innerHTML = appState.services
    .map(
      (s) => `
    <tr>
      <td><strong>${escapeHtml(s.title)}</strong></td>
      <td>${escapeHtml(s.category)}</td>
      <td>${escapeHtml(s.price)}</td>
      <td style="display:flex; gap:6px;">
        <button class="btn btn-sm btn-outline" onclick="editService('${escapeHtml(s._id)}')">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="deleteService('${escapeHtml(s._id)}')">Eliminar</button>
      </td>
    </tr>
  `
    )
    .join('');

  // 3. Tabla de Contactos y Reservas
  document.getElementById('adminContactsTable').innerHTML = appState.adminContacts
    .map(
      (c) => `
    <tr>
      <td><small>${new Date(c.createdAt).toLocaleDateString('es-CL')}</small></td>
      <td><strong>${escapeHtml(c.name)}</strong><br/><small>${escapeHtml(c.email)}</small></td>
      <td><strong>${escapeHtml(c.subject)}</strong><br/><small>${escapeHtml(c.message)}</small></td>
      <td><span class="badge ${c.smtpInstitutionalSent && c.smtpClientCopySent ? 'badge-success' : 'badge-warn'}">${c.smtpInstitutionalSent && c.smtpClientCopySent ? '2 Correos OK' : 'Parcial'}</span></td>
    </tr>
  `
    )
    .join('');

  document.getElementById('adminBookingsTable').innerHTML = appState.bookings
    .map(
      (b) => `
    <tr>
      <td><strong>${escapeHtml(b.userName)}</strong><br/><small>${escapeHtml(b.preferredDate)}</small></td>
      <td>${escapeHtml(b.serviceTitle)}</td>
      <td><span class="badge ${b.status === 'Aprobada' ? 'badge-success' : 'badge-warn'}">${escapeHtml(b.status)}</span></td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="toggleBookingStatus('${escapeHtml(b._id)}')">Alternar Estado</button>
      </td>
    </tr>
  `
    )
    .join('');

  // 4. Tabla de Redes Sociales
  document.getElementById('adminSocialsTable').innerHTML = appState.socials
    .map(
      (soc) => `
    <tr>
      <td><strong>${escapeHtml(soc.network)}</strong></td>
      <td><a href="${escapeHtml(soc.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(soc.url)}</a></td>
      <td><span class="badge ${soc.active ? 'badge-success' : 'badge-warn'}">${soc.active ? 'Activo' : 'Oculto'}</span></td>
      <td style="display:flex; gap:6px; flex-wrap:wrap;">
        <button class="btn btn-sm btn-outline" onclick="editSocial('${escapeHtml(soc._id)}')">Editar</button>
        <button class="btn btn-sm btn-outline" onclick="toggleSocialActive('${escapeHtml(soc._id)}')">${soc.active ? 'Desactivar' : 'Activar'}</button>
        <button class="btn btn-sm btn-danger" onclick="deleteSocial('${escapeHtml(soc._id)}')">✕</button>
      </td>
    </tr>
  `
    )
    .join('');

  // 5. Tabla de FAQs del Chatbot
  document.getElementById('adminFaqsTable').innerHTML = appState.adminFaqs
    .map(
      (f) => `
    <tr>
      <td><strong>${escapeHtml(f.category)}</strong><br/><small>Keywords: ${escapeHtml(f.keywords)}</small></td>
      <td><strong>${escapeHtml(f.question)}</strong><br/><small>${escapeHtml(f.answer)}</small></td>
      <td><span class="badge ${f.active ? 'badge-success' : 'badge-warn'}">${f.active ? 'Activa' : 'Inactiva'}</span></td>
      <td style="display:flex; gap:6px; flex-wrap:wrap;">
        <button class="btn btn-sm btn-outline" onclick="editFaq('${escapeHtml(f._id)}')">Editar</button>
        <button class="btn btn-sm btn-outline" onclick="toggleFaqActive('${escapeHtml(f._id)}')">${f.active ? 'Pausar' : 'Activar'}</button>
        <button class="btn btn-sm btn-danger" onclick="deleteFaq('${escapeHtml(f._id)}')">✕</button>
      </td>
    </tr>
  `
    )
    .join('');

  renderNoSqlExplorer();
}

async function toggleUserRole(userId) {
  const user = appState.adminUsers.find((u) => u._id === userId);
  if (!user) return;
  const nextRole = user.role === 'admin' ? 'usuario' : 'admin';

  try {
    const updated = await apiFetch(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role: nextRole })
    });
    showToast(`Rol de ${updated.name} actualizado a ${updated.role.toUpperCase()}.`);
    await updateAllViews();
  } catch (err) {
    if (err.status !== 401 && err.status !== 403 && err.status !== 0) {
      showToast(err.message, 'error');
    }
  }
}

async function handleSaveService(e) {
  e.preventDefault();
  const id = document.getElementById('srvEditId').value;
  const payload = {
    title: stripHeaderInjection(document.getElementById('srvTitle').value),
    category: stripHeaderInjection(document.getElementById('srvCategory').value),
    price: stripHeaderInjection(document.getElementById('srvPrice').value),
    description: document.getElementById('srvDesc').value.trim()
  };

  try {
    if (id) {
      await apiFetch(`/services/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      showToast('Servicio actualizado en la colección services.');
    } else {
      await apiFetch('/services', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast('Nuevo servicio creado en MongoDB.');
    }
    resetServiceForm();
    await updateAllViews();
  } catch (err) {
    if (err.status !== 401 && err.status !== 403 && err.status !== 0) {
      showToast(err.message, 'error');
    }
  }
}

function editService(id) {
  const s = appState.services.find((item) => item._id === id);
  if (!s) return;
  document.getElementById('srvEditId').value = s._id;
  document.getElementById('srvTitle').value = s.title;
  document.getElementById('srvCategory').value = s.category;
  document.getElementById('srvPrice').value = s.price;
  document.getElementById('srvDesc').value = s.description;
}

function resetServiceForm() {
  document.getElementById('srvEditId').value = '';
  document.getElementById('adminServiceForm')?.reset();
}

async function deleteService(id) {
  try {
    await apiFetch(`/services/${id}`, { method: 'DELETE' });
    showToast('Servicio eliminado de la colección.', 'warn');
    await updateAllViews();
  } catch (err) {
    if (err.status !== 401 && err.status !== 403 && err.status !== 0) {
      showToast(err.message, 'error');
    }
  }
}

async function toggleBookingStatus(id) {
  const b = appState.bookings.find((item) => item._id === id);
  if (!b) return;
  const nextStatus = b.status === 'Aprobada' ? 'Pendiente Revisión' : 'Aprobada';

  try {
    const updated = await apiFetch(`/bookings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus })
    });
    showToast(`Estado de la reserva actualizado a: ${updated.status}`);
    await updateAllViews();
  } catch (err) {
    if (err.status !== 401 && err.status !== 403 && err.status !== 0) {
      showToast(err.message, 'error');
    }
  }
}

/* =========================================================
   7. GESTIÓN DINÁMICA DE REDES SOCIALES (SECCIÓN 6.3)
   ========================================================= */

function renderFooterSocials() {
  const container = document.getElementById('footerSocialLinks');
  if (!container) return;
  const activeSocials = appState.socials.filter((s) => s.active);
  if (activeSocials.length === 0) {
    container.innerHTML = `<span style="font-size:12px;">Sin enlaces activos</span>`;
    return;
  }
  container.innerHTML = activeSocials
    .map(
      (s) => `
    <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="social-pill">
      🔗 ${escapeHtml(s.network)}
    </a>
  `
    )
    .join('');
}

async function handleSaveSocial(e) {
  e.preventDefault();
  const id = document.getElementById('socEditId')?.value;
  const network = document.getElementById('socNetwork').value;
  const url = document.getElementById('socUrl').value.trim();
  const active = document.getElementById('socActive').value === 'true';

  if (!url.startsWith('https://')) {
    showToast('Por seguridad, el enlace externo debe utilizar protocolo seguro https://', 'error');
    return;
  }

  try {
    if (id) {
      await apiFetch(`/socials/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ network, url, active })
      });
    } else {
      await apiFetch('/socials', {
        method: 'POST',
        body: JSON.stringify({ network, url, active })
      });
    }
    e.target.reset();
    if (document.getElementById('socEditId')) document.getElementById('socEditId').value = '';
    showToast(`Enlace oficial de ${network} guardado y actualizado en el pie de página.`);
    await updateAllViews();
  } catch (err) {
    if (err.status !== 401 && err.status !== 403 && err.status !== 0) {
      showToast(err.message, 'error');
    }
  }
}

function editSocial(id) {
  const s = appState.socials.find((item) => item._id === id);
  if (!s) return;
  const editInput = document.getElementById('socEditId');
  if (editInput) editInput.value = s._id;
  document.getElementById('socNetwork').value = s.network;
  document.getElementById('socUrl').value = s.url;
  document.getElementById('socActive').value = s.active ? 'true' : 'false';
  showToast(`Editando enlace de ${s.network}. Modifica la URL y haz clic en Guardar.`);
}

async function toggleSocialActive(id) {
  const s = appState.socials.find((item) => item._id === id);
  if (!s) return;

  try {
    const updated = await apiFetch(`/socials/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !s.active })
    });
    showToast(`Red social ${updated.network}: ${updated.active ? 'Activada' : 'Desactivada'}.`);
    await updateAllViews();
  } catch (err) {
    if (err.status !== 401 && err.status !== 403 && err.status !== 0) {
      showToast(err.message, 'error');
    }
  }
}

async function deleteSocial(id) {
  try {
    await apiFetch(`/socials/${id}`, { method: 'DELETE' });
    showToast('Enlace de red social eliminado.', 'warn');
    await updateAllViews();
  } catch (err) {
    if (err.status !== 401 && err.status !== 403 && err.status !== 0) {
      showToast(err.message, 'error');
    }
  }
}

/* =========================================================
   8. CHATBOT DE ATENCIÓN AL CLIENTE (SECCIÓN 7)
   ========================================================= */

function toggleChatbot() {
  const win = document.getElementById('chatbotWindow');
  win.classList.toggle('open');
  const msgBox = document.getElementById('chatMessages');
  if (win.classList.contains('open') && msgBox.children.length === 0) {
    appendChatBubble(
      'bot',
      '¡Hola! Soy AegisBot, el asistente virtual de AegisSec Enterprise. Selecciona una categoría abajo o escribe tu consulta sobre nuestros servicios, precios o seguridad.'
    );
  }
}

function renderChatQuickChips() {
  const chipContainer = document.getElementById('chatQuickCategories');
  if (!chipContainer) return;
  const activeFaqs = appState.faqs.filter((f) => f.active);
  chipContainer.innerHTML = activeFaqs
    .map(
      (f) => `
    <button type="button" class="chip-btn" onclick="triggerChatCategory('${escapeHtml(f._id)}')">
      ${escapeHtml(f.category)}
    </button>
  `
    )
    .join('');
}

const CHAT_UNAVAILABLE = 'esta funcion no se encuentra disponible en estos momentos';

async function setChatDetails(enabled) {
  const win = document.getElementById('chatbotWindow');
  win.classList.toggle('details', enabled);
  document.getElementById('chatDetailsButton').hidden = enabled;
  document.getElementById('chatQuickButton').hidden = !enabled;
  document.getElementById('chatMessages').hidden = enabled;
  document.getElementById('chatQuickCategories').hidden = enabled;
  const details = document.getElementById('chatDetailsMessages');
  details.hidden = !enabled;
  if (!enabled) return;
  details.querySelector('[data-retry]')?.remove();
  if (details.childElementCount) return;
  const status = appendChatBubble('bot', 'Cargando detalles…', details);
  try {
    const { mode } = await apiFetch('/chatbot/details/status', {
      signal: AbortSignal.timeout(5000), silentNetwork: true
    });
    status.textContent = mode === 'ai'
      ? 'Cuéntame qué pasa con tu sitio o tu aplicación. Si necesito más detalles, te haré una pregunta.'
      : 'Escribe el nombre de un servicio o pregunta por su precio.';
  } catch {
    status.textContent = CHAT_UNAVAILABLE;
    status.dataset.retry = 'true';
  }
}

function appendChatBubble(sender, text, msgBox = document.getElementById('chatMessages')) {
  const div = document.createElement('div');
  div.className = `chat-bubble ${sender}`;
  div.textContent = text;
  msgBox.appendChild(div);
  msgBox.scrollTop = msgBox.scrollHeight;
  return div;
}

function appendChatReply(response, target) {
  const bubble = appendChatBubble('bot', response.reply, target);
  if (!Array.isArray(response.recommendations) || !response.recommendations.length) return;

  bubble.classList.add('has-service-table');
  const table = document.createElement('table');
  table.className = 'chat-service-table';
  table.setAttribute('aria-label', 'Servicios recomendados');
  const header = table.createTHead().insertRow();
  for (const label of ['Servicio', 'Valor']) {
    const heading = document.createElement('th');
    heading.scope = 'col';
    heading.textContent = label;
    header.appendChild(heading);
  }
  const rows = table.createTBody();
  for (const { title, price } of response.recommendations) {
    const row = rows.insertRow();
    row.insertCell().textContent = title;
    row.insertCell().textContent = price;
  }
  bubble.appendChild(table);
  bubble.parentElement.scrollTop = bubble.parentElement.scrollHeight;
}

function showChatPending(target) {
  const pending = appendChatBubble('bot', 'Pensando…', target);
  pending.classList.add('chat-pending');
  pending.setAttribute('role', 'status');

  const dots = document.createElement('span');
  dots.className = 'chat-thinking-dots';
  dots.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i += 1) {
    dots.appendChild(document.createElement('span'));
  }
  pending.appendChild(dots);
  pending.parentElement.scrollTop = pending.parentElement.scrollHeight;
  return pending;
}

let quickPhase = null;
let quickRequestPending = false;

async function triggerChatCategory(faqId) {
  if (quickRequestPending) return;
  const faq = appState.faqs.find((f) => f._id === faqId && f.active);
  if (!faq) return;
  quickRequestPending = true;
  appendChatBubble('user', faq.question);
  const pending = showChatPending();

  try {
    const res = await apiFetch('/chatbot/message', {
      method: 'POST',
      body: JSON.stringify({ message: faq.question })
    });
    quickPhase = res.quickPhase ?? null;
    appendChatReply(res);
  } catch (err) {
    if (err.status === 429) {
      appendChatBubble('bot', 'Has enviado demasiados mensajes seguidos. Por favor espera 3 segundos.');
    }
  } finally {
    quickRequestPending = false;
    pending.remove();
  }
}

const detailHistory = [];
let detailRequestPending = false;

async function handleChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('chatUserInput');
  const rawQuery = input.value.trim();
  if (!rawQuery) return;

  if (rawQuery.length > 180) {
    showToast('El mensaje no puede superar los 180 caracteres.', 'error');
    return;
  }

  const details = document.getElementById('chatbotWindow').classList.contains('details');
  if (details ? detailRequestPending : quickRequestPending) return;
  if (details) detailRequestPending = true;
  else quickRequestPending = true;
  const target = document.getElementById(details ? 'chatDetailsMessages' : 'chatMessages');
  appendChatBubble('user', rawQuery, target);
  input.value = '';
  const pending = showChatPending(target);

  try {
    const res = await apiFetch('/chatbot/message', {
      method: 'POST',
      body: JSON.stringify({ message: rawQuery, details, ...(details ? { history: detailHistory } : { quickPhase }) }),
      signal: AbortSignal.timeout(details ? 27000 : 5000),
      silentNetwork: true
    });
    if (details) {
      const services = res.recommendations?.map(({ title }) => title).join(', ');
      const assistant = services ? `${res.reply} Servicios mostrados: ${services}.` : res.reply;
      detailHistory.push({ user: rawQuery, assistant });
      if (detailHistory.length > 30) detailHistory.shift();
    } else {
      quickPhase = res.quickPhase ?? null;
    }
    appendChatReply(res, target);
  } catch (err) {
    const text = err.status === 429
      ? 'Has enviado demasiados mensajes seguidos. Por favor espera 3 segundos.'
      : CHAT_UNAVAILABLE;
    appendChatBubble('bot', text, target);
  } finally {
    if (details) detailRequestPending = false;
    else quickRequestPending = false;
    pending.remove();
  }
}

async function handleSaveFaq(e) {
  e.preventDefault();
  const id = document.getElementById('faqEditId')?.value;
  const payload = {
    category: stripHeaderInjection(document.getElementById('faqCategory').value),
    keywords: stripHeaderInjection(document.getElementById('faqKeywords').value),
    question: stripHeaderInjection(document.getElementById('faqQuestion').value),
    answer: document.getElementById('faqAnswer').value.trim(),
    active: true
  };

  try {
    if (id) {
      await apiFetch(`/chatbot/faqs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
    } else {
      await apiFetch('/chatbot/faqs', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
    e.target.reset();
    if (document.getElementById('faqEditId')) document.getElementById('faqEditId').value = '';
    showToast('Regla de respuesta guardada en el Chatbot en MongoDB.');
    await updateAllViews();
  } catch (err) {
    if (err.status !== 401 && err.status !== 403 && err.status !== 0) {
      showToast(err.message, 'error');
    }
  }
}

function editFaq(id) {
  const f = appState.adminFaqs.find((item) => item._id === id);
  if (!f) return;
  const editInput = document.getElementById('faqEditId');
  if (editInput) editInput.value = f._id;
  document.getElementById('faqCategory').value = f.category;
  document.getElementById('faqKeywords').value = f.keywords;
  document.getElementById('faqQuestion').value = f.question;
  document.getElementById('faqAnswer').value = f.answer;
  showToast(`Editando regla "${f.category}". Modifica los campos y haz clic en Guardar.`);
}

async function toggleFaqActive(id) {
  const f = appState.adminFaqs.find((item) => item._id === id);
  if (!f) return;

  try {
    const updated = await apiFetch(`/chatbot/faqs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !f.active })
    });
    showToast(`Regla "${updated.category}" ${updated.active ? 'activada' : 'pausada'}.`);
    await updateAllViews();
  } catch (err) {
    if (err.status !== 401 && err.status !== 403 && err.status !== 0) {
      showToast(err.message, 'error');
    }
  }
}

async function deleteFaq(id) {
  try {
    await apiFetch(`/chatbot/faqs/${id}`, { method: 'DELETE' });
    showToast('Regla eliminada del Chatbot.', 'warn');
    await updateAllViews();
  } catch (err) {
    if (err.status !== 401 && err.status !== 403 && err.status !== 0) {
      showToast(err.message, 'error');
    }
  }
}

/* =========================================================
   9. ADMINISTRACIÓN NOSQL, EXPLORADOR Y RESPALDO (SECCIÓN 5)
   ========================================================= */

async function renderNoSqlExplorer() {
  const selector = document.getElementById('nosqlCollectionSelector');
  const viewer = document.getElementById('nosqlJsonViewer');
  if (!selector || !viewer) return;
  const session = getCurrentSession();
  if (!session.authenticated || session.role !== 'admin') return;

  const colName = selector.value;
  try {
    const docs = await apiFetch(`/admin/collections/${encodeURIComponent(colName)}`, {
      silent401: true,
      silent403: true
    });
    viewer.textContent = JSON.stringify(docs || [], null, 2);
  } catch (err) {
    viewer.textContent = `// Error consultando colección: ${err.message}`;
  }
}

async function exportNoSqlBackup() {
  try {
    const backup = await apiFetch('/admin/backup');
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backup, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute(
      'download',
      `mongodb_backup_aegissec_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast('Respaldo JSON de MongoDB exportado exitosamente.');
  } catch (err) {
    if (err.status !== 401 && err.status !== 403 && err.status !== 0) {
      showToast(err.message, 'error');
    }
  }
}

async function restoreDefaultDatabase() {
  try {
    await apiFetch('/admin/seed', {
      method: 'POST',
      body: JSON.stringify({ reset: true })
    });
    showToast('Base de datos NoSQL restaurada a su semilla inicial.');
    await updateAllViews();
  } catch (err) {
    if (err.status !== 401 && err.status !== 403 && err.status !== 0) {
      showToast(err.message, 'error');
    }
  }
}

/* =========================================================
   10. SIMULACIÓN DE PIPELINE CI/CD Y ESCANEO DEVSECOPS
   ========================================================= */

function runSimulatedPipeline() {
  showToast('Ejecutando GitHub Actions: Build -> CodeQL -> npm audit -> OWASP ZAP...');
  const cards = document.querySelectorAll('#pipelineStagesGrid .card');
  cards.forEach((c, idx) => {
    c.style.opacity = '0.35';
    setTimeout(() => {
      c.style.opacity = '1';
      c.style.borderColor = 'var(--success)';
    }, (idx + 1) * 350);
  });
  setTimeout(() => {
    showToast('Pipeline CI/CD completado: 0 vulnerabilidades altas/críticas. Despliegue HTTPS exitoso.');
  }, 2000);
}

/* =========================================================
   INICIALIZACIÓN AL CARGAR EL DOM
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  loadCaptchaChallenge();
  const dateInput = document.getElementById('bookingDate');
  if (dateInput) {
    dateInput.value = new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];
  }
  updateAllViews();
});
