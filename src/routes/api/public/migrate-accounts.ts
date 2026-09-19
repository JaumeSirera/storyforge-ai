import { createFileRoute } from "@tanstack/react-router";

/**
 * Traslada las cuentas de Lovable Cloud al servidor propio: copia el
 * identificador, el correo y el nombre, y crea para cada persona un enlace de
 * "crear contraseña" (las contraseñas no se pueden exportar). Protegida con la
 * clave compartida (X-App-Token).
 *
 * Cuerpo opcional: { "send_emails": true } para enviar los correos al momento.
 */
export const Route = createFileRoute("/api/public/migrate-accounts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["EXTERNAL_API_TOKEN"];
        if (!expected || request.headers.get("x-app-token") !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const body = (await request.json().catch(() => ({}))) as {
          send_emails?: boolean;
          /** Reenvía el enlace también a las cuentas ya copiadas. */
          resend_all?: boolean;
        };
        const { accountsApi, ownAccountsEnabled } = await import("@/lib/accounts.server");
        if (!ownAccountsEnabled()) {
          return Response.json({ error: "own accounts not enabled" }, { status: 503 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        type Incoming = {
          id: string;
          email: string;
          full_name: string | null;
          email_verified: boolean;
          roles: string[];
        };

        const users: Incoming[] = [];
        for (let page = 1; page <= 20; page += 1) {
          const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
          if (error) return Response.json({ error: error.message }, { status: 500 });
          const batch = data?.users ?? [];
          for (const user of batch) {
            if (!user.email) continue;
            const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
            users.push({
              id: user.id,
              email: user.email,
              full_name:
                typeof meta["full_name"] === "string" ? (meta["full_name"] as string) : null,
              email_verified: Boolean(user.email_confirmed_at),
              roles: [],
            });
          }
          if (batch.length < 200) break;
        }

        // Roles actuales (tabla separada en Lovable Cloud).
        const { data: roleRows } = await supabaseAdmin.from("user_roles").select("user_id, role");
        const rolesByUser = new Map<string, string[]>();
        for (const row of roleRows ?? []) {
          const list = rolesByUser.get(row.user_id) ?? [];
          list.push(String(row.role));
          rolesByUser.set(row.user_id, list);
        }
        for (const user of users) user.roles = rolesByUser.get(user.id) ?? [];

        const result = await accountsApi.import(users);

        let emailsSent = 0;
        const emailErrors: string[] = [];
        if (body.send_emails) {
          const { sendPasswordEmail } = await import("@/lib/account-emails.server");
          for (const invite of result.invites) {
            try {
              const sent = await sendPasswordEmail({
                kind: "setup",
                email: invite.email,
                fullName: invite.full_name,
                token: invite.token,
              });
              if (sent.sent) emailsSent += 1;
            } catch (err) {
              if (emailErrors.length < 5) {
                emailErrors.push(`${invite.email}: ${err instanceof Error ? err.message : String(err)}`);
              }
            }
          }
        }

        return Response.json({
          found: users.length,
          imported: result.imported,
          skipped: result.skipped,
          invites: result.invites.length,
          emails_sent: emailsSent,
          email_errors: emailErrors,
        });
      },
    },
  },
});
