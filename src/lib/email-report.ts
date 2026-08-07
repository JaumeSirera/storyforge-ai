import { supabase } from "@/integrations/supabase/client";

/** Descarga el logo guardado en el bucket privado y lo convierte a data URL. */
export async function loadLogoDataUrl(path?: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    const { data, error } = await supabase.storage.from("branding").download(path);
    if (error || !data) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(data);
    });
  } catch {
    return null;
  }
}

/** Sustituye los campos dinámicos de las plantillas de correo. */
export function renderTemplate(
  tpl: string,
  vars: { candidato?: string | null; simulacion?: string | null },
) {
  return (tpl || "")
    .replaceAll("{{candidato}}", vars.candidato || "candidato/a")
    .replaceAll("{{simulacion}}", vars.simulacion || "la simulación");
}

/** Abre el cliente de correo con el remitente, asunto y mensaje configurados. */
export function openMailClient(opts: {
  to: string;
  subject: string;
  body: string;
  replyTo?: string | null;
  fromEmail?: string | null;
}): boolean {
  const params = new URLSearchParams();
  params.set("subject", opts.subject);
  params.set("body", opts.body);
  const cc = opts.replyTo && opts.replyTo !== opts.to ? opts.replyTo : null;
  if (cc) params.set("cc", cc);
  const url = `mailto:${encodeURIComponent(opts.to)}?${params.toString().replace(/\+/g, "%20")}`;

  // En el preview la app corre dentro de un iframe: `location.href` puede
  // bloquearse, así que usamos un enlace real en la ventana superior.
  try {
    const doc = window.top?.document ?? document;
    const a = doc.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    a.style.display = "none";
    doc.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    try {
      window.location.href = url;
      return true;
    } catch {
      return false;
    }
  }
}

