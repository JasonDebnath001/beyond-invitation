import { NextResponse } from "next/server";

type ContactLeadPayload = {
  name?: string;
  mobile?: string;
  email?: string;
  source?: string;

  requirement?: string;
  subRequirement?: string;
  quantity?: string;
  eventDate?: string;
  budgetPerUnit?: string;
  totalBudget?: string;
  message?: string;

  product?: string;
  rate?: string;
};

const erpUrl = process.env.ERPNEXT_URL;
const erpApiKey = process.env.ERPNEXT_API_KEY;
const erpApiSecret = process.env.ERPNEXT_API_SECRET;

const leadDoctype = process.env.ERPNEXT_LEAD_DOCTYPE || "Lead";

/**
 * These defaults are based on normal Frappe custom field naming.
 * If your actual fieldnames are different, set them in .env.local.
 */
const FIELD_REQUIREMENT =
  process.env.ERPNEXT_LEAD_REQUIREMENT_FIELD || "custom_requirement";

const FIELD_SUB_REQUIREMENT =
  process.env.ERPNEXT_LEAD_SUB_REQUIREMENT_FIELD || "custom_sub_requirement";

const FIELD_QUANTITY_REQUIRED =
  process.env.ERPNEXT_LEAD_QUANTITY_REQUIRED_FIELD ||
  "custom_quantity_required";

const FIELD_BUDGET_PER_UNIT =
  process.env.ERPNEXT_LEAD_BUDGET_PER_UNIT_FIELD || "custom_budget_per_unit";

const FIELD_BUDGET_TOTAL =
  process.env.ERPNEXT_LEAD_BUDGET_TOTAL_FIELD || "custom_budget_total";

const FIELD_FUNCTION_DATE =
  process.env.ERPNEXT_LEAD_FUNCTION_DATE_FIELD || "custom_function_date";

const FIELD_SPECIAL_REMARK =
  process.env.ERPNEXT_LEAD_SPECIAL_REMARK_FIELD ||
  "custom_special_requirement_and_remark";

const FIELD_PRODUCTS_TABLE =
  process.env.ERPNEXT_LEAD_PRODUCTS_TABLE_FIELD || "custom_products";

const CHILD_FIELD_PRODUCT =
  process.env.ERPNEXT_LEAD_CHILD_PRODUCT_FIELD || "product";

const CHILD_FIELD_RATE = process.env.ERPNEXT_LEAD_CHILD_RATE_FIELD || "rate";

function cleanText(value?: string) {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: string) {
  if (!value) return undefined;

  const number = Number(value);

  return Number.isFinite(number) ? number : undefined;
}

function removeUndefined<T extends Record<string, unknown>>(object: T) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  );
}

function buildLeadPayload(data: Required<ContactLeadPayload>) {
  const quantity = toNumber(data.quantity);
  const budgetPerUnit = toNumber(data.budgetPerUnit);
  const totalBudget = toNumber(data.totalBudget);
  const rate = toNumber(data.rate);

  const products =
    data.product || rate !== undefined
      ? [
          removeUndefined({
            [CHILD_FIELD_PRODUCT]: data.product || undefined,
            [CHILD_FIELD_RATE]: rate,
          }),
        ]
      : undefined;

  return removeUndefined({
    /**
     * Standard Lead fields
     */
    lead_name: data.name,
    first_name: data.name,
    email_id: data.email || undefined,
    email: data.email || undefined,
    mobile_no: data.mobile,
    phone: data.mobile,
    source: data.source || "Website",

    /**
     * Custom CRM fields shown in your screenshot
     */
    [FIELD_REQUIREMENT]: data.requirement || undefined,
    [FIELD_SUB_REQUIREMENT]: data.subRequirement || undefined,
    [FIELD_QUANTITY_REQUIRED]: quantity,
    [FIELD_BUDGET_PER_UNIT]: budgetPerUnit,
    [FIELD_BUDGET_TOTAL]: totalBudget,
    [FIELD_FUNCTION_DATE]: data.eventDate || undefined,
    [FIELD_SPECIAL_REMARK]: data.message || undefined,

    /**
     * Products child table
     */
    [FIELD_PRODUCTS_TABLE]: products,
  });
}

export async function POST(request: Request) {
  try {
    if (!erpUrl || !erpApiKey || !erpApiSecret) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ERPNext credentials missing. Check ERPNEXT_URL, ERPNEXT_API_KEY, and ERPNEXT_API_SECRET.",
        },
        { status: 500 }
      );
    }

    const body = (await request.json()) as ContactLeadPayload;

    const data: Required<ContactLeadPayload> = {
      name: cleanText(body.name),
      mobile: cleanText(body.mobile),
      email: cleanText(body.email),
      source: cleanText(body.source) || "Website",

      requirement: cleanText(body.requirement),
      subRequirement: cleanText(body.subRequirement),
      quantity: cleanText(body.quantity),
      eventDate: cleanText(body.eventDate),
      budgetPerUnit: cleanText(body.budgetPerUnit),
      totalBudget: cleanText(body.totalBudget),
      message: cleanText(body.message),

      product: cleanText(body.product),
      rate: cleanText(body.rate),
    };

    if (!data.name || !data.mobile) {
      return NextResponse.json(
        {
          success: false,
          message: "Name and mobile number are required.",
        },
        { status: 400 }
      );
    }

    const leadPayload = buildLeadPayload(data);

    const url = `${erpUrl.replace(/\/$/, "")}/api/resource/${encodeURIComponent(
      leadDoctype
    )}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `token ${erpApiKey}:${erpApiSecret}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(leadPayload),
      cache: "no-store",
    });

    const rawText = await response.text();

    let result: unknown = null;

    try {
      result = rawText ? JSON.parse(rawText) : null;
    } catch {
      result = rawText;
    }

    if (!response.ok) {
      console.error("Lead creation failed:", {
        status: response.status,
        statusText: response.statusText,
        doctype: leadDoctype,
        url,
        payload: leadPayload,
        result,
      });

      return NextResponse.json(
        {
          success: false,
          message: "Could not create lead in ERPNext/Frappe CRM.",
          status: response.status,
          statusText: response.statusText,
          doctype: leadDoctype,
          sentPayload: leadPayload,
          erpError: result,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Lead created successfully.",
      lead: result,
    });
  } catch (error) {
    console.error("Contact lead route error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong while submitting the enquiry.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}