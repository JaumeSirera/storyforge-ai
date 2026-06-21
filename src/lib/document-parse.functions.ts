import { createServerFn } from "@tanstack/react-start";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_CHARS = 50_000;

function stripXml(s: string): string {
  // Remove any leftover XML/HTML-ish tags and collapse entities.
  return s
    .replace(/<\/?[a-zA-Z][^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x?[0-9a-fA-F]+;/g, " ");
}

function cleanText(s: string): string {
  return stripXml(s)
    .replace(/\{[0-9a-fA-F-]{24,}\}/g, " ")
    .split("\n")
    .filter((line) => !/(xmlns|schemas\.microsoft\.com|officedocument|drawingml|cNvPr|grpSpPr|blipFill|custGeom|prstGeom|creationId)/i.test(line))
    .join("\n")
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function parsePdf(buf: ArrayBuffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n\n") : text;
}

async function parseDocx(buf: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value;
}

async function parsePptx(buf: ArrayBuffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return na - nb;
    });
  const slides: string[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async("string");
    const texts = Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g))
      .map((m) =>
        m[1]
          .replace(/&amp;/g, "&")
          .replace(/&lt;[^&]*?&gt;/g, " ")
          .replace(/&lt;/g, " ")
          .replace(/&gt;/g, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .trim(),
      )
      .filter((t) => t.length > 0 && !/(xmlns|schemas\.microsoft\.com|officedocument|drawingml|cNvPr|grpSpPr|blipFill|custGeom|prstGeom|creationId)/i.test(t));
    if (texts.length === 0) continue;
    slides.push(`# Diapositiva ${i + 1}\n${texts.join("\n")}`);
  }
  return slides.join("\n\n");
}

export const extractDocumentText = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("FormData requerido");
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("Archivo no encontrado");
    if (file.size === 0) throw new Error("Archivo vacío");
    if (file.size > MAX_BYTES) throw new Error("El archivo supera los 10 MB");
    return { file };
  })
  .handler(async ({ data }) => {
    const { file } = data;
    const name = file.name.toLowerCase();
    const buf = await file.arrayBuffer();

    let text = "";
    try {
      if (name.endsWith(".pdf")) {
        text = await parsePdf(buf);
      } else if (name.endsWith(".docx")) {
        text = await parseDocx(buf);
      } else if (name.endsWith(".pptx")) {
        text = await parsePptx(buf);
      } else if (name.endsWith(".txt") || name.endsWith(".md")) {
        text = new TextDecoder("utf-8").decode(buf);
      } else {
        throw new Error(
          "Formato no soportado. Usa PDF, DOCX, PPTX, TXT o MD.",
        );
      }
    } catch (err: any) {
      throw new Error(err?.message ?? "No se pudo leer el archivo");
    }

    const cleaned = cleanText(text);
    if (!cleaned) throw new Error("El archivo no contiene texto extraíble");

    const truncated = cleaned.length > MAX_CHARS;
    return {
      text: truncated ? cleaned.slice(0, MAX_CHARS) : cleaned,
      chars: Math.min(cleaned.length, MAX_CHARS),
      truncated,
      filename: file.name,
    };
  });
