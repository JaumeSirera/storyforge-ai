# Fase C — independencia de Lovable

Orden elegido: primero mover la lógica al servidor propio, después generar la web estática.

## 1. IA en tu servidor (Gemini con tu clave)
- [x] Pasarela `/api/v1/ai/...` en la API PHP (`api-php/src/Ai.php`, rutas en `public/index.php`).
- [ ] Usuario: subir `api-php/src/Ai.php` y `api-php/public/index.php`; añadir `GEMINI_API_KEY` al `.env`.
- [ ] Activar secreto `EXTERNAL_AI=1` y verificar generación de historia/preguntas.

## 2. PDF e informes en tu servidor
- [x] Verificado: los PDF (informe, evaluación, insights, recibos) se generan en el navegador del usuario (jsPDF). No dependen del servidor de Lovable; no requieren cambios para la web estática.
- [ ] Menor: el análisis de documentos subidos (extraer texto de PDF escaneados) usa una librería en el servidor de Lovable; se moverá a la API PHP si hace falta.

## 3. Correo por SMTP del hosting (fase B pendiente)
- [x] Endpoint `POST /api/v1/email/send` en la API PHP (`api-php/src/Mail.php`, cliente SMTP puro sin dependencias; STARTTLS/AUTH LOGIN, texto+HTML).
- [x] La app envía las plantillas por tu servidor cuando el secreto `EXTERNAL_EMAIL=1`, con respaldo automático a Lovable si el SMTP falla.
- [ ] Usuario: subir `api-php/src/Mail.php` y `api-php/public/index.php`; rellenar `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (y opcionalmente `SMTP_SECURE`) en el `.env`.
- [ ] Activar secreto `EXTERNAL_EMAIL=1` y verificar el envío real.

## 4. Pagos Redsys en tu servidor
- [ ] Mover firma y notificación de Redsys a la API PHP.

## 5. Web estática
- [ ] Quitar dependencias de servidor de Lovable en las rutas; compilar estático.
- [ ] Subir los archivos generados al hosting y apuntar el dominio.
