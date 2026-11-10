import { describe, expect, it } from "vitest";
import { findHelpTopic } from "./assistant-help";

describe("asistente: ayuda de la app", () => {
  it("reconoce preguntas sobre claves de IA aunque lleven tildes", () => {
    expect(findHelpTopic("¿Dónde pongo mi clave de la IA?")?.id).toBe("claves-ia");
  });

  it("reconoce la corrección de exámenes", () => {
    expect(findHelpTopic("Quiero corregir exámenes escaneados")?.id).toBe("corregir-examenes");
  });

  it("trata como prompt libre lo que no es sobre la app", () => {
    expect(findHelpTopic("Escríbeme un poema sobre el mar")).toBeNull();
  });
});

import { localAnswerFor, topicsForPath } from "./assistant-help";

describe("asistente: ayuda local o IA del usuario", () => {
  it("contesta en local una pregunta corta sobre la app", () => {
    expect(localAnswerFor("¿Cómo analizo una grabación?")?.id).toBe("analizar-grabacion");
  });

  it("pasa a la IA un encargo largo aunque nombre algo de la app", () => {
    expect(localAnswerFor("Escríbeme un correo amable para enviar a un candidato que no se ha presentado")).toBeNull();
  });

  it("sugiere primero la ayuda de la pantalla de Evaluaciones", () => {
    expect(topicsForPath("/app/assessments/123")[0].id).toBe("corregir-examenes");
  });

  it("sugiere el banco de preguntas en su propia pantalla", () => {
    expect(topicsForPath("/app/assessments/bank")[0].id).toBe("banco-preguntas");
  });
});

import { existsSync } from "node:fs";
import { HELP_TOPICS } from "./assistant-help";

describe("asistente: vídeos grabados por tema", () => {
  it("«¿Cómo creo una simulación?» tiene su vídeo grabado", () => {
    expect(HELP_TOPICS.find((t) => t.id === "crear-simulacion")?.video).toBe("/assistant/temas/crear-simulacion-alfa.mp4");
  });

  it("cada vídeo de tema existe en la web publicada", () => {
    for (const t of HELP_TOPICS.filter((x) => x.video)) expect(existsSync(`public${t.video}`), t.id).toBe(true);
  });
});
