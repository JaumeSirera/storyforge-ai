# Fase C — independencia de Lovable

## Demostración pública en portada
- [x] Añadir el vídeo completo enviado y una simulación de ejemplo sin registro.
- [x] Verificar reproducción, decisiones y resultado final en la portada.
- [x] Guardar el vídeo y la miniatura dentro del proyecto (`public/demo/`) para que viajen en el ZIP.
- [ ] Usuario: subir `xandralyze-web_v19.zip` y comprobar que el vídeo se reproduce en xandralyze.com.

Orden elegido: primero mover la lógica al servidor propio, después generar la web estática.

## 1. IA en tu servidor (Gemini con tu clave)
- [x] Pasarela `/api/v1/ai/...` en la API PHP (`api-php/src/Ai.php`, rutas en `public/index.php`).
- [ ] Usuario: subir `api-php/src/Ai.php` y `api-php/public/index.php`; añadir `GEMINI_API_KEY` al `.env`.
- [ ] Activar secreto `EXTERNAL_AI=1` y verificar generación de historia/preguntas.

## 2. PDF e informes en tu servidor
- [x] Verificado: los PDF (informe, evaluación, insights, recibos) se generan en el navegador del usuario (jsPDF). No dependen del servidor de Lovable; no requieren cambios para la web estática.
- [ ] Menor: el análisis de documentos subidos (extraer texto de PDF escaneados) usa una librería en el servidor de Lovable; se moverá a la API PHP si hace falta.

## 3. Correo por SMTP del hosting — COMPLETO
- [x] Endpoint `POST /api/v1/email/send` en la API PHP (`api-php/src/Mail.php`, cliente SMTP puro; STARTTLS/SSL, AUTH LOGIN, texto+HTML).
- [x] La app envía las plantillas por tu servidor (secreto `EXTERNAL_EMAIL=1`), con respaldo automático a Lovable si el SMTP falla.
- [x] Verificado en vivo: correo de prueba enviado y aceptado por tu servidor.


## 4. Pagos Redsys en tu servidor
- [x] `api-php/src/Redsys.php`: pago inicial, consumo extra, notificación y renovaciones (firma verificada idéntica).
- [ ] Usuario: subir Redsys.php + index.php, datos Redsys en `.env`, tarea diaria en el hosting.
- [ ] Activar `EXTERNAL_PAYMENTS=1` y probar.

## 5. Web estática
- [ ] Quitar dependencias de servidor de Lovable en las rutas; compilar estático.
- [ ] Subir los archivos generados al hosting y apuntar el dominio.
