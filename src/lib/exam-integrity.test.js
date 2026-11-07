import { expect, test } from "bun:test";
import { emptyIntegrity, integrityLevel, normalizeIntegrity } from "./exam-integrity";

test("sin incidencias cuando todo es cero", () => {
  expect(integrityLevel(emptyIntegrity())).toBe("sin_incidencias");
});

test("revisar con pocas incidencias", () => {
  expect(integrityLevel({ ...emptyIntegrity(), tabSwitches: 2, hiddenSeconds: 20 })).toBe("revisar");
  expect(integrityLevel({ ...emptyIntegrity(), pasteBlocked: 4 })).toBe("revisar");
});

test("riesgo alto con 5 incidencias o 2 minutos fuera", () => {
  expect(integrityLevel({ ...emptyIntegrity(), tabSwitches: 3, pasteBlocked: 2 })).toBe("alto");
  expect(integrityLevel({ ...emptyIntegrity(), tabSwitches: 1, hiddenSeconds: 120 })).toBe("alto");
});

test("normaliza datos manipulados desde el navegador", () => {
  const n = normalizeIntegrity({ tabSwitches: -3, hiddenSeconds: "9", pasteBlocked: 2.6, fullscreenUsed: "yes" });
  expect(n.tabSwitches).toBe(0);
  expect(n.hiddenSeconds).toBe(0);
  expect(n.pasteBlocked).toBe(3);
  expect(n.fullscreenUsed).toBe(false);
});
