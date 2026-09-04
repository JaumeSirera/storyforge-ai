import React from "react";
import {
  Body,
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
}

const Email = ({
  message,
  candidateName,
  simulationTitle,
  stars,
  points,
  feedback,
  signature,
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
const hr = { borderColor: "#e5e7eb", margin: "20px 0" };
