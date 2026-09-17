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
  fullName?: string | null;
  actionLink?: string;
  /** "reset" = olvidó la contraseña; "setup" = cuenta trasladada sin contraseña. */
  kind?: "reset" | "setup";
  expiresText?: string | null;
}

const Email = ({ fullName, actionLink, kind = "reset", expiresText }: Props) => {
  const setup = kind === "setup";
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>
        {setup
          ? "Crea tu contraseña para seguir usando Xandralyze"
          : "Restablece tu contraseña de Xandralyze"}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>Xandralyze</Text>
          <Heading style={heading}>
            {setup ? "Crea tu contraseña" : "Restablece tu contraseña"}
          </Heading>
          <Text style={text}>{fullName ? `Hola ${fullName},` : "Hola,"}</Text>
          <Text style={text}>
            {setup
              ? "Hemos trasladado tu cuenta a nuestro propio servidor. Tu correo y tus datos siguen intactos; solo necesitas crear una contraseña nueva para volver a entrar."
              : "Has pedido restablecer tu contraseña. Pulsa el botón para elegir una nueva."}
          </Text>
          {actionLink ? (
            <Section style={{ margin: "28px 0" }}>
              <Button href={actionLink} style={button}>
                {setup ? "Crear mi contraseña" : "Elegir contraseña nueva"}
              </Button>
              <Text style={small}>
                Si el botón no funciona, copia este enlace:{" "}
                <Link href={actionLink} style={link}>
                  {actionLink}
                </Link>
              </Text>
            </Section>
          ) : null}
          <Section style={infoBox}>
            <Text style={small}>
              {expiresText ?? (setup ? "El enlace caduca en 14 días." : "El enlace caduca en 1 hora.")}
            </Text>
            <Text style={small}>
              Si no has pedido este cambio, puedes ignorar este mensaje: tu contraseña actual seguirá
              funcionando.
            </Text>
          </Section>
          <Hr style={hr} />
          <Text style={small}>— Equipo Xandralyze</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    data["kind"] === "setup"
      ? "Crea tu contraseña de Xandralyze"
      : "Restablece tu contraseña de Xandralyze",
  displayName: "Contraseña de la cuenta (crear o restablecer)",
  previewData: {
    fullName: "Ana García",
    actionLink: "https://xandralyze.com/reset-password?token=ejemplo",
    kind: "reset",
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
const infoBox = { backgroundColor: "#f5f3ff", borderRadius: "10px", padding: "14px 16px", margin: "8px 0 4px" };
const hr = { borderColor: "#e5e7eb", margin: "20px 0" };
