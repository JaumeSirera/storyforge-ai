/** Helpers server-only para invitaciones de sesiones de grabación. */

export function newCaptureToken(len = 28) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export interface LoadedInvitation {
  invitation: any;
  session: any;
}

/** Valida un token y devuelve la invitación + la sesión de captura asociada. */
export async function loadCaptureInvitation(token: string): Promise<LoadedInvitation> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: inv, error } = await supabaseAdmin
    .from("capture_invitations" as any)
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!inv) throw new Error("Invitación no encontrada");

  const i = inv as any;
  if (i.revoked_at) throw new Error("Invitación revocada");
  if (i.expires_at && new Date(i.expires_at).getTime() < Date.now()) {
    throw new Error("Invitación caducada");
  }
  if (i.max_uses != null && (i.uses_count ?? 0) >= i.max_uses) {
    throw new Error("Invitación agotada");
  }

  const { data: session, error: sErr } = await supabaseAdmin
    .from("capture_sessions")
    .select(
      "id, owner_id, title, area_key, simulation_id, mode, capture_mode, record_screen, consent_text, status, retention_days",
    )
    .eq("id", i.capture_session_id)
    .maybeSingle();
  if (sErr) throw new Error(sErr.message);
  if (!session) throw new Error("Sesión de grabación no disponible");

  return { invitation: i, session };
}

/** Devuelve la ficha del participante vinculada a este usuario en esta sesión. */
export async function requireLinkedParticipant(captureSessionId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("capture_participants")
    .select("id, name, role, capture_session_id, owner_id")
    .eq("capture_session_id", captureSessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No estás dado de alta como participante en esta sesión");
  return data as any;
}
