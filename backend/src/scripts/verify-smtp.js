const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { sendContactEmails, mailMode } = require('../services/mailer');

async function verifySmtp() {
  const args = process.argv.slice(2);
  const clientOnly = args.includes('--client-only');
  const testEmail = args.find(arg => arg !== '--client-only') || process.env.SMTP_USER || 'cliente.prueba@aegissec.cl';
  if (clientOnly && mailMode() === 'json-fallback') {
    console.error('Proveedor de correo sin configurar. No se envió correo.');
    process.exitCode = 1;
    return;
  }
  const ticketId = `TCK-${Math.floor(100000 + Math.random() * 900000)}`;

  console.log('==============================================================');
  console.log(' VERIFICACIÓN DE CORREO - AEGISSEC ENTERPRISE');
  console.log('==============================================================');
  console.log(`Proveedor: ${mailMode()}`);
  console.log(`INSTITUTIONAL_INBOX : ${process.env.INSTITUTIONAL_INBOX || 'contacto@aegissec.cl'}`);
  console.log(`Correo Cliente      : ${testEmail}`);
  console.log('--------------------------------------------------------------');

  const result = await sendContactEmails({
    ticketId,
    name: 'Integrante Verificación Certamen',
    email: testEmail,
    phone: '+56 9 8765 4321',
    subject: 'Prueba de correo de AegisSec Enterprise',
    message:
      clientOnly
        ? 'Prueba de la confirmación al visitante enviada desde el backend de AegisSec.'
        : 'Este mensaje comprueba la generación y despacho desde el backend hacia el buzón institucional y al cliente.'
  }, { clientOnly });

  console.log('Resultado del envío:', JSON.stringify(result, null, 2));
  if (clientOnly && result.mode !== 'json-fallback' && result.smtpClientCopySent) {
    console.log('✅ ÉXITO: El proveedor aceptó la confirmación al destinatario de prueba.');
  } else if (result.mode !== 'json-fallback' && result.smtpInstitutionalSent && result.smtpClientCopySent) {
    console.log('✅ ÉXITO: Ambos correos fueron aceptados por el proveedor.');
  } else if (result.mode === 'json-fallback') {
    console.log(
      '⚠️ AVISO: Se ejecutó en modo json-fallback porque falta configurar el proveedor de correo en backend/.env.'
    );
  } else {
    console.log('❌ ERROR: Alguno de los correos falló. Revisa tu configuración de correo en backend/.env.');
    process.exit(1);
  }
}

verifySmtp().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
