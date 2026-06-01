import crypto from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function cleanEnv(value?: string) {
  return (value ?? "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function mask(value: string) {
  if (!value) return "";

  if (value.length <= 8) {
    return `${value.slice(0, 2)}***${value.slice(-2)}`;
  }

  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function sha(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export async function GET() {
  const erpUrl = cleanEnv(process.env.ERPNEXT_URL);
  const apiKey = cleanEnv(process.env.ERPNEXT_API_KEY);
  const apiSecret = cleanEnv(process.env.ERPNEXT_API_SECRET);

  const authHeader = `token ${apiKey}:${apiSecret}`;

  const debugData: Record<string, unknown> = {
    vercelEnv: process.env.VERCEL_ENV || null,
    nodeEnv: process.env.NODE_ENV || null,

    erpUrl,
    erpUrlLength: erpUrl.length,
    erpUrlHash: sha(erpUrl),

    apiKeyExists: Boolean(apiKey),
    apiKeyLength: apiKey.length,
    apiKeyMasked: mask(apiKey),
    apiKeyHash: sha(apiKey),

    apiSecretExists: Boolean(apiSecret),
    apiSecretLength: apiSecret.length,
    apiSecretMasked: mask(apiSecret),
    apiSecretHash: sha(apiSecret),

    authHeaderLength: authHeader.length,
    authHeaderHash: sha(authHeader),
  };

  if (!erpUrl || !apiKey || !apiSecret) {
    return NextResponse.json(
      {
        ok: false,
        message: "Missing ERPNext env variables",
        debugData,
      },
      { status: 500 }
    );
  }

  try {
    const url = `${erpUrl.replace(/\/$/, "")}/api/method/frappe.auth.get_logged_user`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const text = await response.text();

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      testUrl: url,
      debugData,
      erpResponsePreview: text.slice(0, 1000),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error",
        debugData,
      },
      { status: 500 }
    );
  }
}