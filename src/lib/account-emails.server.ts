/**
 * Correos de las cuentas propias (crear o restablecer contraseña).
 * Server-only.
 */

import { sendTemplateEmail } from "./email-templates/send-email";

function siteUrl(): string {
  const raw = process.env["PUBLIC_SITE_URL"] || "https://xandralyze.com";
  return raw.replace(/\/+$/, "");
}

export async function sendPasswordEmail(input: {
  kind: "reset" | "setup";
  email: string;
  fullName: string | null;
  token: string;
}): Promise<{ sent: boolean }> {
  const link = `${siteUrl()}/reset-password?token=${encodeURIComponent(input.token)}${
    input.kind === "setup" ? "&nuevo=1" : ""
  }`;
  const result = await sendTemplateEmail("account-password", input.email, {
    idempotencyKey: `account-${input.kind}-${input.token.slice(0, 32)}`,
    templateData: {
      fullName: input.fullName,
      actionLink: link,
      kind: input.kind,
    },
  });
  return { sent: result.sent };
}
