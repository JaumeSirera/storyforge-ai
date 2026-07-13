import { jsPDF } from "jspdf";

export interface ReceiptData {
  payment: {
    id: string;
    order_code: string;
    amount_cents: number;
    currency: string;
    kind: string;
    status: string;
    auth_code: string | null;
    response_code: string | null;
    created_at: string;
  };
  buyer: { name: string | null; email: string | null };
  merchant: { name: string; merchantCode: string; product: string };
  vatPct: number;
}

const KIND_LABEL: Record<string, string> = {
  subscription: "Suscripción inicial",
  renewal: "Renovación mensual",
  extra: "Consumo extra de IA",
};

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(cents / 100);
}

/** Generate a simple invoice-style PDF receipt for a Redsys payment. */
export function generateReceiptPdf(data: ReceiptData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("RECIBO", M, 64);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(data.merchant.name, W - M, 56, { align: "right" });
  doc.text(`Comercio Redsys: ${data.merchant.merchantCode}`, W - M, 70, { align: "right" });

  doc.setDrawColor(200);
  doc.line(M, 84, W - M, 84);

  // Meta
  const created = new Date(data.payment.created_at);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Nº de pedido", M, 108);
  doc.text("Fecha", M + 200, 108);
  doc.text("Estado", M + 360, 108);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(data.payment.order_code, M, 122);
  doc.text(created.toLocaleString("es-ES"), M + 200, 122);
  doc.text(data.payment.status.toUpperCase(), M + 360, 122);
  doc.setFont("helvetica", "normal");

  // Buyer
  doc.setTextColor(100);
  doc.setFontSize(10);
  doc.text("Facturado a", M, 160);
  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.text(data.buyer.name ?? data.buyer.email ?? "Cliente", M, 176);
  if (data.buyer.email && data.buyer.name) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(data.buyer.email, M, 190);
    doc.setTextColor(0);
  }

  // Line items table
  const tableTop = 230;
  doc.setFillColor(245, 245, 245);
  doc.rect(M, tableTop, W - M * 2, 24, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Concepto", M + 12, tableTop + 16);
  doc.text("Importe", W - M - 12, tableTop + 16, { align: "right" });
  doc.setFont("helvetica", "normal");

  const kindLabel = KIND_LABEL[data.payment.kind] ?? data.payment.kind;
  const lineY = tableTop + 44;
  doc.text(`${data.merchant.product}`, M + 12, lineY);
  doc.setTextColor(120);
  doc.setFontSize(9);
  doc.text(kindLabel, M + 12, lineY + 14);
  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.text(money(data.payment.amount_cents, data.payment.currency), W - M - 12, lineY, { align: "right" });

  doc.line(M, lineY + 30, W - M, lineY + 30);

  // Totals — precios con IVA incluido, desglose informativo configurable
  const total = data.payment.amount_cents;
  const vatRate = Number.isFinite(data.vatPct) && data.vatPct >= 0 ? data.vatPct : 21;
  const base = Math.round(total / (1 + vatRate / 100));
  const iva = total - base;

  const totalsY = lineY + 54;
  doc.setFontSize(10);
  doc.text("Base imponible", W - M - 140, totalsY);
  doc.text(money(base, data.payment.currency), W - M - 12, totalsY, { align: "right" });
  doc.text(`IVA (${vatRate}%)`, W - M - 140, totalsY + 16);
  doc.text(money(iva, data.payment.currency), W - M - 12, totalsY + 16, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total", W - M - 140, totalsY + 38);
  doc.text(money(total, data.payment.currency), W - M - 12, totalsY + 38, { align: "right" });
  doc.setFont("helvetica", "normal");

  // Payment details footer
  const footY = totalsY + 90;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Método de pago: Redsys (TPV)`, M, footY);
  if (data.payment.auth_code) {
    doc.text(`Código de autorización: ${data.payment.auth_code}`, M, footY + 14);
  }
  if (data.payment.response_code) {
    doc.text(`Código de respuesta: ${data.payment.response_code}`, M, footY + 28);
  }
  doc.text(
    "Este documento es un recibo emitido de forma automática. Para cualquier duda, contacte con el emisor.",
    M,
    footY + 56,
    { maxWidth: W - M * 2 },
  );

  return doc;
}

export function downloadReceiptPdf(data: ReceiptData) {
  const doc = generateReceiptPdf(data);
  doc.save(`recibo-${data.payment.order_code}.pdf`);
}
