const nodemailer = require('nodemailer');
const { getInstitutionalInbox } = require('../config/env');
const { createZohoTransport, hasZohoSettings } = require('./zohoMail');
const { stripCrlf } = require('../utils/sanitize');

function escapeHtml(raw) {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function mailMode() {
  const provider = process.env.MAIL_PROVIDER;
  if (provider === 'zoho' || (!provider && hasZohoSettings())) return 'zoho';
  return process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS ? 'smtp' : 'json-fallback';
}

function createTransporter() {
  if (mailMode() === 'zoho') return { mode: 'zoho', transporter: createZohoTransport() };
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  const isConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

  if (isConfigured) {
    const port = Number(SMTP_PORT || 587);
    return {
      mode: 'smtp',
      transporter: nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: port === 465,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS
        }
      })
    };
  }

  return {
    mode: 'json-fallback',
    transporter: nodemailer.createTransport({ jsonTransport: true })
  };
}

async function sendContactEmails({ ticketId, name, email, phone, subject, message }, { clientOnly = false } = {}) {
  const safeName = stripCrlf(name);
  const safeEmail = stripCrlf(email);
  const safePhone = stripCrlf(phone || 'No indicado');
  const safeSubject = stripCrlf(subject);
  const safeTicketId = stripCrlf(ticketId);
  const institutionalInbox = getInstitutionalInbox();
  const fromAddress = process.env.SMTP_USER || 'no-reply@aegissec.cl';

  const { mode, transporter } = createTransporter();

  const institutionalMail = {
    from: `"AegisSec Web" <${fromAddress}>`,
    to: institutionalInbox,
    replyTo: safeEmail,
    subject: `[Nuevo Ticket ${safeTicketId}] ${safeSubject}`,
    text: [
      `Ticket: ${safeTicketId}`,
      `Remitente: ${safeName} (${safeEmail})`,
      `Teléfono: ${safePhone}`,
      `Asunto: ${safeSubject}`,
      '',
      'Mensaje:',
      message
    ].join('\n'),
    html: `
      <h3>Nuevo Ticket ${escapeHtml(safeTicketId)}</h3>
      <p><strong>Remitente:</strong> ${escapeHtml(safeName)} (${escapeHtml(safeEmail)})</p>
      <p><strong>Teléfono:</strong> ${escapeHtml(safePhone)}</p>
      <p><strong>Asunto:</strong> ${escapeHtml(safeSubject)}</p>
      <hr />
      <p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>
    `
  };

  const clientMail = {
    from: `"AegisSec Soporte" <${fromAddress}>`,
    to: safeEmail,
    subject: `Hemos recibido tu consulta (${safeTicketId}) - AegisSec Enterprise`,
    text: [
      `Hola ${safeName},`,
      '',
      `Confirmamos la recepción de tu solicitud sobre "${safeSubject}" (Ticket: ${safeTicketId}).`,
      'Nuestro equipo de ciberseguridad te responderá a la brevedad.',
      '',
      'Atentamente,',
      'Equipo AegisSec Enterprise'
    ].join('\n'),
    html: `
      <p>Hola <strong>${escapeHtml(safeName)}</strong>,</p>
      <p>Confirmamos la recepción de tu solicitud sobre <em>"${escapeHtml(safeSubject)}"</em> (Ticket: <code>${escapeHtml(safeTicketId)}</code>).</p>
      <p>Nuestro equipo de ciberseguridad te responderá a la brevedad.</p>
      <p>Atentamente,<br/>AegisSec Enterprise</p>
    `
  };

  let smtpInstitutionalSent = false;
  let smtpClientCopySent = false;
  let institutionalMessageId = null;
  let clientMessageId = null;

  if (!clientOnly) {
    try {
      const infoInst = await transporter.sendMail(institutionalMail);
      smtpInstitutionalSent = true;
      institutionalMessageId = infoInst.messageId || null;
    } catch (err) {
      console.warn('[Mailer] Error enviando correo institucional:', err.message);
    }
  }

  try {
    const infoClient = await transporter.sendMail(clientMail);
    smtpClientCopySent = true;
    clientMessageId = infoClient.messageId || null;
  } catch (err) {
    console.warn('[Mailer] Error enviando confirmación al cliente:', err.message);
  }

  return {
    mode,
    institutionalInbox,
    smtpInstitutionalSent,
    smtpClientCopySent,
    institutionalMessageId,
    clientMessageId
  };
}

module.exports = {
  sendContactEmails, mailMode
};
