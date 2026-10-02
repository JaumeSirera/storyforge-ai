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
