import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  candidateName?: string;
  assessmentTitle?: string;
  examLink?: string;
  expiresAt?: string | null;
  timeLimitMin?: number | null;
  instructions?: string | null;
}

const Email = ({
  candidateName,
  assessmentTitle,
  examLink,
  expiresAt,
  timeLimitMin,
  instructions,
}: Props) => {
  const title = assessmentTitle || "tu evaluación";
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>{`Tu enlace privado para realizar la prueba: ${title}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>Xandralyze</Text>
          <Heading style={heading}>Invitación a realizar una prueba</Heading>
          <Text style={text}>
            {candidateName ? `Hola ${candidateName},` : "Hola,"}
          </Text>
          <Text style={text}>
            Has sido inscrito/a en la evaluación <strong>{title}</strong>. Puedes realizarla
            directamente en pantalla desde tu enlace privado, sin necesidad de crear una cuenta.
          </Text>
          {examLink ? (
            <Section style={{ margin: "28px 0" }}>
              <Button href={examLink} style={button}>
                Comenzar la prueba
              </Button>
              <Text style={small}>
                Si el botón no funciona, copia este enlace: <Link href={examLink} style={link}>{examLink}</Link>
              </Text>
            </Section>
          ) : null}
          <Section style={infoBox}>
            {timeLimitMin ? (
              <Text style={small}>Tiempo disponible: {timeLimitMin} minutos desde que abras el examen.</Text>
            ) : null}
            {expiresAt ? <Text style={small}>El enlace caduca el {expiresAt}.</Text> : null}
            <Text style={small}>
              Este enlace es personal: no lo compartas, ya que identifica tu entrega.
            </Text>
          </Section>
          {instructions ? (
            <>
              <Hr style={hr} />
              <Text style={small}>{instructions}</Text>
            </>
          ) : null}
          <Hr style={hr} />
          <Text style={small}>Mucha suerte. — Equipo Xandralyze</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Tu prueba: ${data['assessmentTitle'] || "evaluación"} — enlace de acceso`,
  displayName: "Invitación a la prueba (aspirante)",
  previewData: {
    candidateName: "Ana García",
    assessmentTitle: "Prueba de redacción comercial",
    examLink: "https://xandralyze.com/exam/token-de-ejemplo",
    timeLimitMin: 45,
    expiresAt: "31/12/2026 20:00",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { padding: "28px 26px", maxWidth: "560px" };
const brand = { fontSize: "13px", letterSpacing: "2px", color: "#6d28d9", margin: "0 0 8px", fontWeight: 700 };
const heading = { fontSize: "22px", color: "#111827", margin: "0 0 16px" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#1f2937", margin: "0 0 12px" };
const small = { fontSize: "13px", lineHeight: "20px", color: "#4b5563", margin: "0 0 8px" };
const link = { color: "#6d28d9", wordBreak: "break-all" as const };
const button = {
  backgroundColor: "#6d28d9",
  color: "#ffffff",
  borderRadius: "8px",
  fontSize: "15px",
  fontWeight: 700,
  padding: "12px 22px",
  textDecoration: "none",
};
const infoBox = {
  backgroundColor: "#f5f3ff",
  borderRadius: "10px",
  padding: "14px 16px",
  margin: "8px 0 4px",
};
const hr = { borderColor: "#e5e7eb", margin: "20px 0" };
