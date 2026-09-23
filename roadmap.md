# Fase C — independencia de Lovable

Orden elegido: primero mover la lógica al servidor propio, después generar la web estática.

## 1. IA en tu servidor (Gemini con tu clave)
- [x] Pasarela `/api/v1/ai/...` en la API PHP (`api-php/src/Ai.php`, rutas en `public/index.php`).
- [ ] Usuario: subir `api-php/src/Ai.php` y `api-php/public/index.php`; añadir `GEMINI_API_KEY` al `.env`.
- [ ] Activar secreto `EXTERNAL_AI=1` y verificar generación de historia/preguntas.

## 2. PDF e informes en tu servidor
- [ ] Endpoint de generación de PDF en PHP (informe de sesión, evaluación, insights).
- [ ] Sustituir la generación en el servidor de Lovable por llamadas a tu API.

## 3. Correo por SMTP del hosting (fase B pendiente)
- [ ] PHPMailer + endpoint `/api/v1/email/send`; SMTP en el `.env`.
- [ ] Redirigir plantillas de la app a ese endpoint.

## 4. Pagos Redsys en tu servidor
- [ ] Mover firma y notificación de Redsys a la API PHP.

## 5. Web estática
- [ ] Quitar dependencias de servidor de Lovable en las rutas; compilar estático.
- [ ] Subir los archivos generados al hosting y apuntar el dominio.
