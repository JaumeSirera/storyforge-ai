import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  message?: string;
  candidateName?: string | null;
  simulationTitle?: string | null;
  stars?: number | null;
  points?: number | null;
  feedback?: string | null;
  signature?: string | null;
  reportUrl?: string | null;
}

const Email = ({
  message,
  candidateName,
  simulationTitle,
  stars,
  points,
  feedback,
  signature,
  reportUrl,
}: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>{`Tu informe de ${simulationTitle || "la simulación"}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Xandralyze</Text>
        <Heading style={heading}>
          Informe de {simulationTitle || "la simulación"}
        </Heading>
        <Text style={text}>{message || `Hola ${candidateName || "candidato/a"},`}</Text>
        {typeof points === "number" || typeof stars === "number" ? (
          <Section style={infoBox}>
            {typeof stars === "number" ? <Text style={small}>Estrellas: {stars}</Text> : null}
            {typeof points === "number" ? <Text style={small}>Puntos: {points}</Text> : null}
          </Section>
        ) : null}
        {feedback ? (
          <>
            <Hr style={hr} />
            <Text style={small}>Feedback del evaluador:</Text>
            <Text style={text}>{feedback}</Text>
          </>
        ) : null}
        {reportUrl ? (
          <Section style={actionSection}>
            <Button href={reportUrl} style={actionButton}>
              Abrir informe completo
            </Button>
            <Text style={linkHelp}>
              El informe se abre en una página segura de Xandralyze, donde también puede descargarse en PDF.
            </Text>
          </Section>
        ) : null}
        <Hr style={hr} />
        <Text style={small}>{signature || "Equipo Xandralyze"}</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    data['subject'] || `Tu informe de ${data['simulationTitle'] || "la simulación"}`,
  displayName: "Informe de sesión (candidato)",
  previewData: {
    candidateName: "Ana García",
    simulationTitle: "Simulación de atención al cliente",
    stars: 2,
    points: 65,
    message: "Hola Ana García,",
    reportUrl: "https://xandralyze.com/app/sessions/ejemplo",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { padding: "28px 26px", maxWidth: "560px" };
const brand = {
  fontSize: "13px",
  letterSpacing: "2px",
  color: "#6d28d9",
  margin: "0 0 8px",
  fontWeight: 700,
};
const heading = { fontSize: "22px", color: "#111827", margin: "0 0 16px" };
const text = {
  fontSize: "15px",
  lineHeight: "24px",
  color: "#1f2937",
  margin: "0 0 12px",
  whiteSpace: "pre-line" as const,
};
const small = { fontSize: "13px", lineHeight: "20px", color: "#4b5563", margin: "0 0 8px" };
const infoBox = {
  backgroundColor: "#f5f3ff",
  borderRadius: "10px",
  padding: "14px 16px",
  margin: "8px 0 4px",
};
const actionSection = { margin: "22px 0 8px", textAlign: "center" as const };
const actionButton = {
  backgroundColor: "#253e7a",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 700,
  padding: "12px 20px",
  textDecoration: "none",
};
const linkHelp = {
  fontSize: "12px",
  lineHeight: "18px",
  color: "#6b7280",
  margin: "12px 0 0",
};
const hr = { borderColor: "#e5e7eb", margin: "20px 0" };
