/**
 * Versión del texto/alcance de consentimiento vigente.
 * Súbela cuando cambie el contenido legal para que la auditoría distinga
 * qué versión aceptó cada participante.
 */
export const CONSENT_VERSION = "2026-08-v2";

export const CONSENT_SCOPE_LABELS: Record<string, string> = {
  recording: "Grabación (imagen y voz)",
  face_analysis: "Análisis facial",
  voice_analysis: "Análisis de voz",
  screen: "Compartir pantalla",
};

export const CONSENT_SOURCE_LABELS: Record<string, string> = {
  host: "Anfitrión",
  invitation: "Invitación",
  join: "Alta por enlace",
};
