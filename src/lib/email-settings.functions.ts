import { createServerFn } from "@tanstack/react-start";
import { requireAnyAuth } from "@/lib/require-auth";
import { z } from "zod";

/** Lee los ajustes de correo del usuario actual. */
export const getMyEmailSettings = createServerFn({ method: "GET" })
  .middleware([requireAnyAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("email_settings")
      .select("from_name, from_email, reply_to, subject_template, body_template, logo_url, auto_send_on_complete")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    return {
      fromName: (data?.from_name as string | null) ?? "",
      fromEmail: (data?.from_email as string | null) ?? "",
      replyTo: (data?.reply_to as string | null) ?? "",
      logoUrl: ((data as any)?.logo_url as string | null) ?? "",
      autoSendOnComplete: Boolean((data as any)?.auto_send_on_complete),
      subjectTemplate:
        (data?.subject_template as string | null) ?? "Tu informe de la simulación {{simulacion}}",
      bodyTemplate:
        (data?.body_template as string | null) ??
        "Hola {{candidato}},\n\nAdjuntamos el informe de tu simulación «{{simulacion}}».\n\nUn saludo.",
    };
  });


const SaveInput = z.object({
  fromName: z.string().trim().max(120).optional(),
  fromEmail: z.string().trim().max(200).email("Introduce un email válido").or(z.literal("")).optional(),
  replyTo: z.string().trim().max(200).email("Introduce un email válido").or(z.literal("")).optional(),
  subjectTemplate: z.string().trim().max(200).optional(),
  bodyTemplate: z.string().trim().max(4000).optional(),
  logoUrl: z.string().trim().max(500).optional(),
  autoSendOnComplete: z.boolean().optional(),
});


/** Guarda los ajustes de correo del usuario actual. */
export const saveMyEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const patch: {
      user_id: string;
      from_name?: string | null;
      from_email?: string | null;
      reply_to?: string | null;
      subject_template?: string | null;
      body_template?: string | null;
      logo_url?: string | null;
      auto_send_on_complete?: boolean;
    } = { user_id: context.userId };
    if (data.fromName !== undefined) patch.from_name = data.fromName || null;
    if (data.fromEmail !== undefined) patch.from_email = data.fromEmail || null;
    if (data.replyTo !== undefined) patch.reply_to = data.replyTo || null;
    if (data.subjectTemplate !== undefined) patch.subject_template = data.subjectTemplate || null;
    if (data.bodyTemplate !== undefined) patch.body_template = data.bodyTemplate || null;
    if (data.logoUrl !== undefined) patch.logo_url = data.logoUrl || null;
    if (data.autoSendOnComplete !== undefined) patch.auto_send_on_complete = data.autoSendOnComplete;


    const { error } = await context.supabase
      .from("email_settings")
      .upsert(patch, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

