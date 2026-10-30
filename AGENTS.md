<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Public sector pages use a shared browser-safe SectorLanding with independent leaf routes and metadata; why: each audience needs a shareable URL while demonstrations and navigation stay consistent.
- The landing demonstration uses local story data and client-only scoring without creating candidate sessions; why: visitors must try it without accounts or external database access. The demo video and poster are static files under `public/demo/` referenced by root-relative path, never platform asset pointers; why: those URLs only resolve on the platform host and 404 on the user's own hosting.
- Self-hosting build: `npm run build:web` (script = `vite build --config vite.config.hosting.ts`) run outside the Lovable sandbox (unset LOVABLE_SANDBOX/DEV_SERVER__PROJECT_PATH) produces a node-server `.output/` for the cPanel Node.js app; why: Lovable sandbox forces the cloudflare preset. User-facing steps live in `DEPLOY.md`.
- Paid features (donations, subscription, pricing) are hidden behind `DONATIONS_ENABLED` in `src/lib/features.ts`, never deleted; why: the project is free/open source for now but may re-enable them.
- Collaborator program lives in the PHP API (`api-php/src/Contrib.php`, `/api/v1/contrib/*`, tables auto-created) and grants role `collaborator` in `app_user_roles` only on admin approval; why: Lovable Cloud is paused and all data lives in the user's MySQL.
- Despliegue manual: se compila con vite.config.hosting.ts, se empaqueta `.output/` (server + public + nitro.json) en un ZIP y el usuario lo sube a xandralyze-web; no hay integración con GitHub Actions. Por qué: el usuario decidió seguir apañándose con el ZIP de siempre.
- Estudio de redes sociales (ex Story Weaver Social) vive bajo /app/admin/social, datos en la API PHP (`api-php/src/Social.php`, `/api/v1/social/*`, solo rol admin) y publica solo con Upload-Post (clave y perfil por admin en `app_social_settings`, credenciales leídas con `publishCredentials()`); cron de cPanel llama a `/api/public/social/publish-due` con SOCIAL_CRON_SECRET. Por qué: independencia total de Lovable y sin conectores de Lovable.
- Social publish acknowledgements are stored as `enviando` with per-platform request tracking in the existing result field; only confirmed platform outcomes count as published, and manual checks/cron poll existing jobs without re-uploading. Why: Upload-Post can accept a job before Facebook or other networks publish it.
