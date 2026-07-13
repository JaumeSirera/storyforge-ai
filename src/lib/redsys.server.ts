// Server-only Redsys client (HMAC_SHA256_V1 signing).
// Handles form-post checkout params and REST recurring charges.
import crypto from "node:crypto";

export interface RedsysConfig {
  merchantKey: string; // base64
  merchantCode: string; // FUC
  terminal: string;
  merchantName: string;
  currency: string; // ISO numeric, "978" = EUR
  urlTpv: string; // hosted checkout POST endpoint
  urlRest: string; // REST endpoint for recurring
}

export function getRedsysConfig(): RedsysConfig {
  const merchantKey = process.env.REDSYS_MERCHANT_KEY;
  const merchantCode = process.env.REDSYS_MERCHANT_CODE;
  const terminal = process.env.REDSYS_TERMINAL ?? "1";
  const merchantName = process.env.REDSYS_MERCHANT_NAME ?? "VITA Training";
  const env = (process.env.REDSYS_ENV ?? "production").toLowerCase();
  if (!merchantKey || !merchantCode) {
    throw new Error("REDSYS_MERCHANT_KEY o REDSYS_MERCHANT_CODE no configurados");
  }
  const isProd = env === "production" || env === "prod" || env === "live";
  return {
    merchantKey,
    merchantCode,
    terminal,
    merchantName,
    currency: "978",
    urlTpv: isProd
      ? "https://sis.redsys.es/sis/realizarPago"
      : "https://sis-t.redsys.es:25443/sis/realizarPago",
    urlRest: isProd
      ? "https://sis.redsys.es/sis/rest/trataPeticionREST"
      : "https://sis-t.redsys.es:25443/sis/rest/trataPeticionREST",
  };
}

/** 3DES-CBC encrypt (zero IV, zero padding). Redsys spec. */
function encrypt3DES(keyB64: string, message: string): Buffer {
  const key = Buffer.from(keyB64, "base64");
  const iv = Buffer.alloc(8, 0);
  const cipher = crypto.createCipheriv("des-ede3-cbc", key, iv);
  cipher.setAutoPadding(false);
  const buf = Buffer.from(message, "utf8");
  const rem = buf.length % 8;
  const padded = rem === 0 ? buf : Buffer.concat([buf, Buffer.alloc(8 - rem, 0)]);
  return Buffer.concat([cipher.update(padded), cipher.final()]);
}

function hmacSha256(key: Buffer, message: string): Buffer {
  return crypto.createHmac("sha256", key).update(message, "utf8").digest();
}

/** Build Ds_MerchantParameters (base64 JSON) and Ds_Signature. */
export function signRequest(
  params: Record<string, string>,
  order: string,
  merchantKey: string,
): { merchantParameters: string; signature: string } {
  const json = JSON.stringify(params);
  const merchantParameters = Buffer.from(json, "utf8").toString("base64");
  const derivedKey = encrypt3DES(merchantKey, order);
  const signature = hmacSha256(derivedKey, merchantParameters).toString("base64");
  return { merchantParameters, signature };
}

/** Verify a notification/response signature. Redsys uses URL-safe b64 for merchantParameters
 *  in notifications; we decode either form. */
export function verifyResponseSignature(
  merchantParameters: string,
  receivedSignature: string,
  merchantKey: string,
): { ok: boolean; params: Record<string, string> } {
  // Decode params (URL-safe b64 tolerated)
  const normalized = merchantParameters.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = Buffer.from(normalized, "base64").toString("utf8");
  const params = JSON.parse(decoded) as Record<string, string>;
  const order = params.Ds_Order ?? params.DS_ORDER ?? "";
  if (!order) return { ok: false, params };
  const derivedKey = encrypt3DES(merchantKey, order);
  const computed = hmacSha256(derivedKey, merchantParameters).toString("base64");
  // Redsys sends signature URL-safe: '-' and '_' instead of '+' and '/'
  const computedUrlSafe = computed.replace(/\+/g, "-").replace(/\//g, "_");
  const rec = receivedSignature.trim();
  const ok = rec === computed || rec === computedUrlSafe;
  return { ok, params };
}

/** Generate a valid Redsys order code: 4 numeric prefix + up to 8 alphanumeric.
 *  We use last-6 of unix time (numeric) + 6 random alphanumeric = 12 chars. */
export function newOrderCode(): string {
  const now = Date.now().toString();
  const numeric = now.slice(-6); // 6 digits
  const alnum = crypto.randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
  return `${numeric}${alnum}`;
}

/** Build the hosted-checkout form params for the FIRST payment that tokenizes the card. */
export function buildCheckoutParams(opts: {
  order: string;
  amountCents: number;
  cfg: RedsysConfig;
  urlOk: string;
  urlKo: string;
  urlNotification: string;
  productDescription: string;
  requestTokenization: boolean;
}): Record<string, string> {
  const p: Record<string, string> = {
    DS_MERCHANT_AMOUNT: String(opts.amountCents),
    DS_MERCHANT_ORDER: opts.order,
    DS_MERCHANT_MERCHANTCODE: opts.cfg.merchantCode,
    DS_MERCHANT_CURRENCY: opts.cfg.currency,
    DS_MERCHANT_TRANSACTIONTYPE: "0",
    DS_MERCHANT_TERMINAL: opts.cfg.terminal,
    DS_MERCHANT_MERCHANTURL: opts.urlNotification,
    DS_MERCHANT_URLOK: opts.urlOk,
    DS_MERCHANT_URLKO: opts.urlKo,
    DS_MERCHANT_CONSUMERLANGUAGE: "001",
    DS_MERCHANT_MERCHANTNAME: opts.cfg.merchantName,
    DS_MERCHANT_PRODUCTDESCRIPTION: opts.productDescription,
  };
  if (opts.requestTokenization) {
    // Card-on-file: request token + mark this as initial recurring transaction.
    p.DS_MERCHANT_IDENTIFIER = "REQUIRED";
    p.DS_MERCHANT_COF_INI = "S";
    p.DS_MERCHANT_COF_TYPE = "R";
  }
  return p;
}

/** Charge a stored card via REST for recurring payments. Returns parsed response. */
export async function chargeRecurringREST(opts: {
  order: string;
  amountCents: number;
  cfg: RedsysConfig;
  cardToken: string;
  originalAuthCode: string;
  productDescription: string;
}): Promise<{
  ok: boolean;
  responseCode: string;
  authCode?: string;
  raw: Record<string, string>;
}> {
  const params: Record<string, string> = {
    DS_MERCHANT_AMOUNT: String(opts.amountCents),
    DS_MERCHANT_ORDER: opts.order,
    DS_MERCHANT_MERCHANTCODE: opts.cfg.merchantCode,
    DS_MERCHANT_CURRENCY: opts.cfg.currency,
    DS_MERCHANT_TRANSACTIONTYPE: "0",
    DS_MERCHANT_TERMINAL: opts.cfg.terminal,
    DS_MERCHANT_IDENTIFIER: opts.cardToken,
    DS_MERCHANT_DIRECTPAYMENT: "true",
    DS_MERCHANT_COF_INI: "N",
    DS_MERCHANT_COF_TYPE: "R",
    DS_MERCHANT_COF_TXNID: opts.originalAuthCode,
    DS_MERCHANT_PRODUCTDESCRIPTION: opts.productDescription,
  };
  const { merchantParameters, signature } = signRequest(params, opts.order, opts.cfg.merchantKey);
  const body = JSON.stringify({
    Ds_SignatureVersion: "HMAC_SHA256_V1",
    Ds_MerchantParameters: merchantParameters,
    Ds_Signature: signature,
  });
  const res = await fetch(opts.cfg.urlRest, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, responseCode: "PARSE_ERROR", raw: { body: text } };
  }
  const outParams = json?.Ds_MerchantParameters
    ? (JSON.parse(
        Buffer.from(
          String(json.Ds_MerchantParameters).replace(/-/g, "+").replace(/_/g, "/"),
          "base64",
        ).toString("utf8"),
      ) as Record<string, string>)
    : (json as Record<string, string>);
  const responseCode = String(outParams.Ds_Response ?? outParams.DS_RESPONSE ?? "");
  const authCode = outParams.Ds_AuthorisationCode ?? outParams.DS_AUTHORISATIONCODE;
  const numeric = Number(responseCode);
  const ok = Number.isFinite(numeric) && numeric >= 0 && numeric <= 99;
  return { ok, responseCode, authCode, raw: outParams };
}
