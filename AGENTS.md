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
- Self-hosting build: `vite build --config vite.config.hosting.ts` outside the Lovable sandbox (unset LOVABLE_SANDBOX/DEV_SERVER__PROJECT_PATH) produces a node-server `.output/` for the cPanel Node.js app; why: Lovable sandbox forces the cloudflare preset.
- Paid features (donations, subscription, pricing) are hidden behind `DONATIONS_ENABLED` in `src/lib/features.ts`, never deleted; why: the project is free/open source for now but may re-enable them.
- Collaborator program lives in the PHP API (`api-php/src/Contrib.php`, `/api/v1/contrib/*`, tables auto-created) and grants role `collaborator` in `app_user_roles` only on admin approval; why: Lovable Cloud is paused and all data lives in the user's MySQL.
