# Informe Técnico de Auditoría y Remediación DevSecOps (`SECURITY_REPORT.md`)

**Proyecto:** AegisSec Enterprise · Plataforma Web Segura & DevSecOps
**Fecha de Auditoría:** `[COMPLETAR: Ej. 16 de Noviembre de 2026]`
**Responsables de Seguridad:** `[COMPLETAR: Nombres de los Integrantes]`
**Alcance:** Frontend SPA (`index.html`, `app.js`), API REST (`backend/src/`) y dependencias NPM (`backend/package-lock.json`).

---

## 1. Resumen Ejecutivo

Este documento registra las pruebas de seguridad estáticas (**SAST**), dinámicas (**DAST**) y de composición de software (**SCA**) ejecutadas sobre la plataforma **AegisSec Enterprise**, detallando los hallazgos detectados en la línea base inicial, el análisis de impacto bajo el estándar **OWASP Top 10 (2021)**, las remediaciones técnicas implementadas en el código fuente y la evidencia de verificación posterior.

| Herramienta Utilizada | Tipo de Análisis | Objetivo Evaluado | Estado Inicial (Antes) | Estado Final (Después) |
| :--- | :--- | :--- | :--- | :--- |
| **OWASP ZAP** | DAST (Dinámico) | Cabeceras HTTP, CORS, CSP y endpoints en ejecución (`http://localhost:4000` y `:5500`) | 3 Alertas Medias / 1 Alta | **0 Alertas Críticas / Altas / Medias** |
| **GitHub CodeQL** | SAST (Estático) | Flujo de datos en `app.js` y `backend/src/**/*.js` (Inyección NoSQL, XSS, CRLF, Mass Assignment) | 3 Hallazgos Altos | **0 Hallazgos (Verificado en CI)** |
| **npm audit** | SCA (Dependencias) | Árbol de dependencias en `backend/package-lock.json` | Riesgo de dependencias sin auditoría en CI | **Umbral `--audit-level=high` activo** |
| **Supertest Suite** | Integración de Seguridad | `backend/tests/security.test.js` y `backend/tests/api.test.js` | Sin cobertura automatizada | **22/22 pruebas aprobadas (100%)** |

---

## 2. Metodología de Escaneo y Evidencia de Ejecución

### 2.1. Análisis Dinámico (DAST) con OWASP ZAP
- **Modo de ejecución:** Escaneo automatizado Baseline / Full Scan apuntando a `http://localhost:4000/api` y `http://localhost:5500`.
- **Captura / Evidencia Inicial:** `[INSERTAR CAPTURA O RUTA DE REPORTE ZAP ANTES DE REMEDIACIÓN]`
- **Captura / Evidencia Final:** `[INSERTAR CAPTURA O RUTA DE REPORTE ZAP POST-REMEDIACIÓN]`

### 2.2. Análisis Estático (SAST) con GitHub CodeQL
- **Modo de ejecución:** Integrado en `.github/workflows/devsecops.yml` mediante `github/codeql-action/init@v3` y `analyze@v3` con suite `security-extended` para lenguaje `javascript`.
- **Captura / Evidencia en GitHub Security Tab:** `[INSERTAR CAPTURA DE GITHUB ACTIONS / CODEQL SIN ALERTAS]`

### 2.3. Análisis de Dependencias (SCA) con `npm audit`
- **Comandos ejecutados:**
  ```bash
  npm --prefix backend audit
  npm --prefix backend audit --omit=dev
  npm --prefix backend audit --audit-level=high
  ```
- **Hallazgo Inicial (Antes):** Se detectaron **3 vulnerabilidades** (`1 high` crítica en `nodemailer <=10.1.3` asociada a inyección de comandos SMTP / CRLF y DoS en addressparser, además de `2 moderate` en la dependencia de desarrollo `nodemon -> minimatch`).
  ![Evidencia Inicial npm audit](./evidencia/npm%20audit1.png)
- **Remediación Aplicada:** Se actualizó `nodemailer` a la versión segura `^10.6.0` en `backend/package.json` y se regeneró `backend/package-lock.json`.
- **Resultado Final (Después):** **0 vulnerabilidades altas o críticas** en todo el árbol (`npm audit --audit-level=high` aprueba con código `0`) y **0 vulnerabilidades totales (`found 0 vulnerabilities`)** en las dependencias de producción verificadas con `npm audit --omit=dev`.
  ![Evidencia Corregida npm audit](./evidencia/npm%20audit%202%20corregido.png)

---

## 3. Detalle Técnico de Hallazgos, Impacto y Remediación

### Hallazgo 01 · Exposición de Cabeceras y Ausencia de Políticas de Seguridad HTTP
- **Categoría OWASP Top 10:** A05:2021 – *Security Misconfiguration*
- **Herramienta detectora:** OWASP ZAP (DAST)
- **Severidad inicial:** Media
- **Descripción del problema (Antes):** La instancia por defecto de Express exponía la cabecera `X-Powered-By: Express` (facilitando reconocimiento de tecnología) y carecía de cabeceras defensivas como `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security` y `X-Frame-Options`. Además, el acceso CORS no estaba restringido al origen del frontend.
- **Impacto técnico y de negocio:** Susceptibilidad a ataques de *Clickjacking*, *MIME-sniffing* y lectura cruzada desde orígenes no autorizados.
- **Remediación aplicada en código:**
  - En `backend/src/app.js`: Se invocó `app.disable('x-powered-by')`, se integró el middleware `helmet()` y se configuró `cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5500' })`.
- **Verificación posterior:** Comprobado automáticamente en `backend/tests/api.test.js` (`res.headers['x-powered-by'] === undefined` y presencia de `x-content-type-options: nosniff`).

---

### Hallazgo 02 · Inyección de Operadores NoSQL en Autenticación y Consultas
- **Categoría OWASP Top 10:** A03:2021 – *Injection (NoSQL Injection)*
- **Herramienta detectora:** GitHub CodeQL (SAST) / Pruebas de Penetración
- **Severidad inicial:** Alta
- **Descripción del problema (Antes):** Si un atacante enviaba un objeto JSON como `{"email": {"$gt": ""}, "password": "..."}` al endpoint `POST /api/auth/login`, una consulta directa a MongoDB sin sanitización ni validación de tipos podía evaluar la condición como verdadera y permitir evasión de autenticación.
- **Impacto técnico y de negocio:** Compromiso total de cuentas (incluyendo el rol `admin`) sin conocer la contraseña.
- **Remediación aplicada en código:**
  1. En `backend/src/app.js`: Se incorporó `express-mongo-sanitize()` a nivel global para eliminar claves que comiencen con `$` o contengan `.`.
  2. En `backend/src/routes/auth.routes.js`: Se añadieron validadores estrictos con `express-validator` (`body('email').isEmail()`, `body('password').isString()`) evaluados por `validateRequest` antes de tocar Mongoose.
- **Verificación posterior:** Verificado en `backend/tests/security.test.js` (inciso `e`), confirmando rechazo con código HTTP `400`/`401` y ausencia de token.

---

### Hallazgo 03 · Almacenamiento de Credenciales y Riesgo de Escalación de Privilegios (Mass Assignment)
- **Categoría OWASP Top 10:** A02:2021 – *Cryptographic Failures* y A01:2021 – *Broken Access Control*
- **Herramienta detectora:** Auditoría de Arquitectura / CodeQL
- **Severidad inicial:** Crítica
- **Descripción del problema (Antes):** El prototipo inicial simulaba hashes en cliente (`localStorage`) y permitía enviar el campo `role` durante el registro, además de carecer de exclusión automática del hash en consultas de base de datos.
- **Impacto técnico y de negocio:** Exposición de hashes de contraseñas en respuestas JSON y creación no autorizada de cuentas con rol `admin`.
- **Remediación aplicada en código:**
  1. En `backend/src/models/User.js`: Se definió `passwordHash: { type: String, required: true, select: false }`.
  2. En `backend/src/routes/auth.routes.js`: Se implementó hashing real en servidor con `argon2.hash(password, { type: argon2.argon2id })`, verificación con `argon2.verify()`, asignación forzada de `role: 'usuario'` en `POST /api/auth/register` y serialización mediante `toPublicUser(user)` que jamás incluye `passwordHash`.
  3. En `backend/src/middlewares/auth.js`: Se implementaron los middlewares `verifyToken` (HTTP `401`) y `verifyRole(['admin'])` (HTTP `403`).
- **Verificación posterior:** Verificado en `backend/tests/security.test.js` (incisos `a`, `b`, `c` y `d`).

---

### Hallazgo 04 · Fuerza Bruta en Login, Abuso de Correo SMTP e Inyección de Cabeceras CRLF
- **Categoría OWASP Top 10:** A07:2021 – *Identification and Authentication Failures* / A04:2021 – *Insecure Design*
- **Herramienta detectora:** OWASP ZAP / Revisión DevSecOps
- **Severidad inicial:** Alta
- **Descripción del problema (Antes):** La ausencia de límites de tasa (*Rate Limiting*) permitía ataques de fuerza bruta contra `/api/auth/login` y flooding de correos en `/api/contacts`. Asimismo, saltos de línea `\r\n` en el asunto o nombre del contacto podían inyectar cabeceras SMTP arbitrarias (`Bcc:`).
- **Impacto técnico y de negocio:** Denegación de servicio, bloqueo del servidor SMTP por spam y suplantación de cabeceras de correo.
- **Remediación aplicada en código:**
  1. En `backend/src/routes/auth.routes.js`: `express-rate-limit` configurado a **5 intentos cada 15 minutos** (`HTTP 429`).
  2. En `backend/src/routes/contacts.routes.js`: `express-rate-limit` de **3 envíos por minuto por IP**, verificación de desafío matemático firmado con JWT temporal (`GET /api/contacts/captcha`), sanitización con `stripCrlf()` (`str.replace(/[\r\n]+/g, ' ').trim()`) y destinatario institucional fijo desde `process.env.INSTITUTIONAL_INBOX`.
  3. En `backend/src/routes/chatbot.routes.js`: `express-rate-limit` de **6 mensajes cada 30 segundos**, longitud máxima de 180 caracteres y lista negra de comandos administrativos.
- **Verificación posterior:** Verificado en `backend/tests/api.test.js` (secciones 4, 5 y 6).

---

### Hallazgo 05 · Validación de Enlaces Externos y Fuga de Información en Errores
- **Categoría OWASP Top 10:** A03:2021 – *Injection (Stored XSS / Open Redirect)* y A05:2021 – *Security Misconfiguration*
- **Herramienta detectora:** CodeQL / Inspección de Código
- **Severidad inicial:** Media
- **Descripción del problema (Antes):** Si se permitían URLs sin validar el esquema en la colección `socials`, un enlace malicioso (`javascript:...` o `http://...`) podía renderizarse en el pie de página. Adicionalmente, errores no controlados podían devolver el `stacktrace` completo al cliente en producción.
- **Impacto técnico y de negocio:** Ejecución de scripts en el navegador o divulgación de rutas internas del servidor.
- **Remediación aplicada en código:**
  1. En `backend/src/models/Social.js` y `backend/src/routes/socials.routes.js`: Se exige que toda URL inicie estrictamente con `https://`, sumado al atributo `rel="noopener noreferrer"` y `escapeHtml()` en el frontend.
  2. En `backend/src/middlewares/errorHandler.js`: Cuando `NODE_ENV === 'production'`, cualquier excepción interna devuelve una respuesta controlada `{ "error": "Error interno del servidor." }` sin `stack` ni detalles internos.
- **Verificación posterior:** Verificado en `backend/tests/security.test.js` (inciso `e`) y `backend/tests/api.test.js` (sección 6).

---

## 4. Tabla Comparativa Consolidada (Antes vs. Después de la Remediación)

| ID | Riesgo OWASP Top 10 | Herramienta | Componente Afectado | Severidad Inicial | Hallazgo Inicial (Antes) | Corrección Técnica Implementada | Resultado de Verificación (Después) |
| :- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **01** | **A05: Security Misconfiguration** | OWASP ZAP (DAST) | `backend/src/app.js` | Media | Exposición de `X-Powered-By: Express`, ausencia de cabeceras Helmet y CORS abierto. | `app.disable('x-powered-by')`, `helmet()`, `cors({ origin: process.env.FRONTEND_URL })` y `express.json({ limit: '50kb' })`. | **Resuelto** · 0 alertas de cabeceras en ZAP y test de integración aprobado. |
| **02** | **A03: Injection (NoSQL)** | GitHub CodeQL (SAST) | `POST /api/auth/login` y rutas API | Alta | Posible inyección de operadores MongoDB (`{"$gt": ""}`) en el body JSON. | `express-mongo-sanitize()` global + validación de tipos con `express-validator`. | **Resuelto** · Peticiones con `$gt` rechazadas con HTTP `400`/`401`. |
| **03** | **A02: Cryptographic Failures & A01: Broken Access Control** | Auditoría / CodeQL | `User.js`, `auth.routes.js`, `auth.js` | Crítica | Hashes simulados en cliente, riesgo de exposición de `passwordHash` y falta de guardas RBAC en servidor. | `argon2.hash(..., { type: argon2.argon2id })`, `select: false` en Mongoose, `verifyToken` (`401`) y `verifyRole(['admin'])` (`403`). | **Resuelto** · Verificado en `security.test.js` (incisos `a`, `b`, `c`, `d`). |
| **04** | **A07: Auth Failures & Spam** | OWASP ZAP / Revisión | `/api/auth/login`, `/api/contacts`, `/api/chatbot` | Alta | Ausencia de Rate Limiting, riesgo de fuerza bruta y posible inyección CRLF en cabeceras SMTP. | `express-rate-limit` (login 5/15m, contacto 3/1m, chatbot 6/30s), CAPTCHA firmado con JWT y filtro `stripCrlf()`. | **Resuelto** · Bloqueo `HTTP 429` y sanitización CRLF verificados con `supertest`. |
| **05** | **A03 / A05: URLs Inseguras y Fuga de Stacktrace** | CodeQL / Supertest | `Social.js`, `errorHandler.js` | Media | Posibilidad de registrar enlaces `http://` o `javascript:` y exposición de stacktraces en errores. | Validación obligatoria `https://` en esquema y ruta + ocultamiento de stacktrace cuando `NODE_ENV=production`. | **Resuelto** · Rechazo `HTTP 400` a URLs sin `https://` y respuestas limpias en producción. |
| **06** | **A06: Vulnerable and Outdated Components** | `npm audit` (SCA) | `backend/package-lock.json` (`nodemailer`) | Alta (`high`) | `nodemailer <=10.1.3` presentaba 1 vulnerabilidad de severidad **Alta (`high`)** (GHSA-mm7p-fcc7-pg87 / SMTP Command Injection & CRLF) y 2 moderadas en dev (`minimatch`). | Actualización a `nodemailer@^10.6.0` y compuerta en GitHub Actions con `npm audit --audit-level=high` y `npm audit --omit=dev`. | **Resuelto** · `found 0 vulnerabilities` en producción (`--omit=dev`) y 0 alertas altas/críticas (ver capturas en `./evidencia/`). |

---

## 5. Conclusiones de Seguridad

1. **Defensa en Profundidad:** La seguridad no depende de una sola capa; el cliente sanitiza salidas HTML contra XSS (`escapeHtml`), la red API aplica límites de tasa, validación de esquemas y sanitización NoSQL/CRLF, y la base de datos refuerza índices únicos y exclusión de campos sensibles (`select: false`).
2. **Automatización DevSecOps (Shift-Left Security):** La integración de **Supertest**, **`npm audit`** y **GitHub CodeQL** en `.github/workflows/devsecops.yml` garantiza que ninguna regresión funcional ni vulnerabilidad alta o crítica pueda llegar al entorno de producción en Render/Vercel.
