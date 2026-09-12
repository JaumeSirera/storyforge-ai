# Migrar las evaluaciones a tu base de datos

Tu servidor externo ya responde correctamente (`api.xandralyze.com`, comprobado ahora). El siguiente paso es que todo el módulo de evaluaciones (evaluaciones, aspirantes, entregas, anotaciones, colaboradores, banco de preguntas y registro de examen) lea y escriba en tu base de datos MySQL en lugar de la base de datos de Lovable Cloud.

## Qué se mantiene igual

- Las cuentas y contraseñas siguen en Lovable Cloud (así lo decidimos).
- Las fotos, escaneos y PDF de las entregas siguen guardándose en el almacenamiento de Lovable Cloud, porque tu API todavía no guarda archivos. Los datos sí pasan a tu servidor.
- Simulaciones, capturas de vídeo, informes de sesión y facturación siguen donde están; son fases posteriores.
- La pantalla y el funcionamiento para el usuario no cambian.

## Qué se hace

1. **Capa de datos única para evaluaciones.** Todo el código de evaluaciones deja de hablar directamente con la base de datos de Lovable Cloud y pasa por una única pieza intermedia que decide el destino: tu servidor si está configurado, o la base actual si no lo está. Así, si tu servidor cae, se puede volver atrás quitando un ajuste.
2. **Permisos de colaboradores en tu servidor.** Hoy las reglas de "quién puede corregir, anotar o aprobar" viven dentro de la base de datos de Lovable. Se replican en tu API (PHP) para que sigan aplicándose igual con los datos en MySQL.
3. **Acceso del aspirante por enlace.** La página pública del examen (`/exam/<enlace>`) también se pasa a tu base de datos, con las mismas comprobaciones de enlace válido, caducidad y entrega bloqueada.
4. **Copia de los datos existentes.** Se copian tus evaluaciones actuales de Lovable Cloud a MySQL (evaluaciones, aspirantes, entregas, anotaciones, colaboradores, banco de preguntas y registro), conservando identificadores para que los enlaces ya enviados sigan funcionando. Los datos originales no se borran: quedan como respaldo.
5. **Comprobación real.** Con la sesión iniciada: crear una evaluación, invitar a un aspirante, entregar, corregir y aprobar, verificando que las filas aparecen en tu MySQL.

## Detalles técnicos

- Nuevo módulo `src/lib/assessments-repo.server.ts`: funciones (`listAssessments`, `getAssessment`, `insertSubmission`, …) con dos implementaciones — cliente externo (`external-data.server.ts`) y Supabase — seleccionadas por `isExternalApiEnabled()`.
- Se reescriben los puntos de acceso a datos de `assessments.server.ts`, `assessment-candidates.server.ts`, `assessment-annotations.server.ts`, `assessment-roles.server.ts`, `question-bank.server.ts`, `exam-audit.server.ts`, `candidate-invites.server.ts` y `candidate.functions.ts` para usar ese módulo; la lógica de IA, OCR y PDF no se toca.
- `api-php`: se amplía `Repo.php`/`index.php` con endpoints para acceso por token de aspirante, comprobación de permisos de colaborador (equivalente a `assessment_can`/`submission_can`) e inserción del registro de auditoría; se añaden a `schema.mysql.sql` las columnas que falten.
- La copia de datos se hace con un script puntual que lee de Lovable Cloud y escribe vía tu API con el token de aplicación.
- Tras cada bloque: `bunx tsgo --noEmit`, `php -l` en los archivos PHP y prueba funcional en el navegador.

## Lo que necesitarás hacer tú

- Volver a subir a `api.xandralyze.com` los archivos PHP actualizados (te aviso cuándo y cuáles).
- Ejecutar en tu base de datos el archivo de esquema actualizado.
