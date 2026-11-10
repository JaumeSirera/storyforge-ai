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
