# AegisBot

El modo de preguntas rápidas funciona al iniciar Express con MongoDB. Usa las FAQ activas administrables y el catálogo vigente. La búsqueda y las respuestas de orientación están en `backend/src/utils/fastans.js`. El botón **Hablar con un ejecutivo** abre el formulario de contacto.

## Modo de detalles

Por defecto, **Necesito detalles** muestra el aviso de función no disponible. Para activar Qwen, define `CHAT_AI_ENABLED=true` en `backend/.env` y reinicia Express.

- Con `CHAT_AI_URL` vacía, Express ejecuta `docker compose -f chatbot.compose.yml up -d qwen` desde `backend/`. Docker y su plugin Compose deben estar instalados. Coloca el modelo indicado en `backend/models/`. La API local del modelo escucha en el puerto 6771 mediante loopback.
- Con `CHAT_AI_URL` definida, Express usa ese servicio compatible con Chat Completions. Configura `CHAT_AI_MODEL` y `CHAT_AI_KEY` si el proveedor los exige. Las claves quedan en el backend. Si el proveedor falla, el modo rápido sigue funcionando.
- Para apagar el contenedor local si ya se había iniciado, ejecuta `docker compose -f chatbot.compose.yml stop qwen` desde `backend/`. Poner la variable en falso desactiva el acceso desde la aplicación.

El navegador conserva hasta 30 intercambios en memoria y Express acota el contexto que envía al modelo. `CHAT_AI_HISTORY_BYTES` permite ajustar ese presupuesto. La IA se limita al modo de detalles.

## Frontend alojado por separado

En `runtime-config.js`, coloca la URL HTTPS pública de Express terminada en `/api`. En el backend, `FRONTEND_URL` debe indicar el origen del frontend. Publica únicamente los archivos estáticos que necesita la interfaz. Mantén fuera archivos de entorno, respaldos y pesos del modelo.

## Correo

Completa `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `INSTITUTIONAL_INBOX` en `backend/.env`. Desde `backend/`, `npm run verify:smtp -- CORREO_DE_PRUEBA` verifica el flujo de doble envío al buzón institucional y al destinatario de prueba. En modo simulado no se entrega correo por Internet.

## Aegis NLP en preguntas rápidas

En `backend/src/services/chatbot/nlp/` están el clasificador, el corpus y el archivo entrenado. No requieren GPU ni dependencias nuevas. La integración mantiene las FAQ administrables y consulta los precios en el catálogo. Las respuestas de catálogo, de tarifa individual y de recomendación muestran una tabla con el servicio y su tarifa vigente. Las respuestas de orientación se mantienen como texto. Para tráfico de bots, recomienda una mitigación inmediatamente. Conserva el tema «tráfico» para seguimientos breves como «dame una solución». Si el usuario cambia de tema o recarga la página, se limpia ese dato. El modo de detalles sigue controlado por `CHAT_AI_ENABLED`.

Desde la raíz del proyecto, `node backend/src/services/chatbot/nlp/entrenar.cjs` regenera el modelo con los ejemplos incluidos. `node --test backend/tests/chatbot-nlp.test.js` comprueba el controlador con modelos de MongoDB simulados, sin abrir puertos ni modificar la base.

### Zoho Mail API

El backend admite Zoho por OAuth 2.0 como alternativa al transporte SMTP. Configura en `backend/.env`:

```dotenv
MAIL_PROVIDER=zoho
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REFRESH_TOKEN=
ZOHO_ACCOUNT_ID=
ZOHO_FROM_EMAIL=
INSTITUTIONAL_INBOX=
```

El permiso de envío es `ZohoMail.messages.CREATE`. `ZohoMail.accounts.READ` se usa para obtener el ID de cuenta si aún no lo conoces. El código renueva el token de acceso usando el token de renovación y solo guarda el token de acceso en memoria. Las URL del adaptador corresponden al centro de datos de EE. UU. que se usa en este proyecto. El destinatario institucional debe ser un buzón autorizado.

Desde `backend/`, ejecuta `npm run verify:smtp -- --client-only CORREO_DE_PRUEBA` para probar solo la confirmación. Para probar ambos correos, omite `--client-only`.

- [OAuth de Zoho Mail](https://www.zoho.com/mail/help/api/using-oauth-2.html)
- [API de envío de Zoho Mail](https://www.zoho.com/mail/help/api/post-send-an-email.html)
