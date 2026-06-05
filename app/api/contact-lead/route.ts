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
};

const erpUrl = process.env.ERPNEXT_URL;
const erpApiKey = process.env.ERPNEXT_API_KEY;
const erpApiSecret = process.env.ERPNEXT_API_SECRET;

/**
 * Use "Lead" for standard ERPNext Lead.
 * Use "CRM Lead" if you are using the separate Frappe CRM app.
 */
const leadDoctype = process.env.ERPNEXT_LEAD_DOCTYPE?.trim() || "Lead";

/**
 * These must match your Frappe CRM Lead fieldnames exactly.
 */
const FIELD_REQUIREMENT =
  process.env.ERPNEXT_LEAD_REQUIREMENT_FIELD || "custom_requirement";

const FIELD_SUB_REQUIREMENT =
  process.env.ERPNEXT_LEAD_SUB_REQUIREMENT_FIELD || "custom_sub_requirement";

const FIELD_QUANTITY_REQUIRED =
  process.env.ERPNEXT_LEAD_QUANTITY_REQUIRED_FIELD ||
  "custom_quantity_required";

const FIELD_BUDGET_PER_UNIT =
  process.env.ERPNEXT_LEAD_BUDGET_PER_UNIT_FIELD ||
  "custom_budget_per_unit";

const FIELD_BUDGET_TOTAL =
  process.env.ERPNEXT_LEAD_BUDGET_TOTAL_FIELD || "custom_budget_total";

const FIELD_FUNCTION_DATE =
  process.env.ERPNEXT_LEAD_FUNCTION_DATE_FIELD || "custom_function_date";

const FIELD_SPECIAL_REMARK =
  process.env.ERPNEXT_LEAD_SPECIAL_REMARK_FIELD ||
  "custom_special_requirement_and_remark";

const ALLOWED_REQUIREMENTS = [
  "Wedding Cards",
  "Rakhi Packaging Item",
  "Sagun Envelopes",
];

const WEDDING_CARD_SUB_REQUIREMENTS = [
  "None Of The Above",
  "Hindu Wedding Cards",
  "Muslim Wedding Cards",
  "Christian Wedding Cards",
  "General Wedding Cards",
];

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
    Object.entries(object).filter(([, value]) => value !== undefined),
  );
}

function normaliseRequirement(requirement: string) {
  const value = requirement.trim();

  if (value === "Shagun Envelopes") {
    return "Sagun Envelopes";
  }

  if (
    value === "Rakhi Cards" ||
    value === "Rakhi Boxes" ||
    value === "Rakhi Packaging" ||
    value === "Rakhi Packaging Items"
  ) {
    return "Rakhi Packaging Item";
  }

  return value;
}

function normaliseSubRequirement(subRequirement: string) {
  const value = subRequirement.trim();

  const aliases: Record<string, string> = {
    "None of the Above": "None Of The Above",
    "None of The Above": "None Of The Above",
    "Hindu Wedding Card": "Hindu Wedding Cards",
    "Muslim Wedding Card": "Muslim Wedding Cards",
    "Christian Wedding Card": "Christian Wedding Cards",
    "General Wedding Card": "General Wedding Cards",
  };

  return aliases[value] || value;
}

function buildLeadPayload(data: Required<ContactLeadPayload>) {
  const quantity = toNumber(data.quantity);
  const budgetPerUnit = toNumber(data.budgetPerUnit);
  const totalBudget = toNumber(data.totalBudget);

  const payload: Record<string, unknown> = {
    /**
     * Standard Lead fields.
     */
    lead_name: data.name,
    first_name: data.name,
    email_id: data.email || undefined,
    email: data.email || undefined,
    mobile_no: data.mobile,
    phone: data.mobile,

    /**
     * Requirement always goes to Frappe CRM.
     */
    [FIELD_REQUIREMENT]: data.requirement || undefined,

    /**
     * Other custom fields.
     */
    [FIELD_QUANTITY_REQUIRED]: quantity,
    [FIELD_BUDGET_PER_UNIT]: budgetPerUnit,
    [FIELD_BUDGET_TOTAL]: totalBudget,
    [FIELD_FUNCTION_DATE]: data.eventDate || undefined,
    [FIELD_SPECIAL_REMARK]: data.message || undefined,
  };

  /**
   * Sub-requirement only goes to Frappe CRM for Wedding Cards.
   * For Rakhi Packaging Item / Sagun Envelopes, do not send this field.
   */
  if (data.requirement === "Wedding Cards" && data.subRequirement) {
    payload[FIELD_SUB_REQUIREMENT] = data.subRequirement;
  }

  return removeUndefined(payload);
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
        { status: 500 },
      );
    }

    if (leadDoctype.toLowerCase() === "contact") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Wrong configuration: ERPNEXT_LEAD_DOCTYPE is set to Contact. It must be Lead or CRM Lead.",
          leadDoctype,
        },
        { status: 500 },
      );
    }

    const body = (await request.json()) as ContactLeadPayload;

    const normalisedRequirement = normaliseRequirement(
      cleanText(body.requirement),
    );

    const normalisedSubRequirement = normaliseSubRequirement(
      cleanText(body.subRequirement),
    );

    const data: Required<ContactLeadPayload> = {
      name: cleanText(body.name),
      mobile: cleanText(body.mobile),
      email: cleanText(body.email),
      source: cleanText(body.source),
      requirement: normalisedRequirement,
      subRequirement: normalisedSubRequirement,
      quantity: cleanText(body.quantity),
      eventDate: cleanText(body.eventDate),
      budgetPerUnit: cleanText(body.budgetPerUnit),
      totalBudget: cleanText(body.totalBudget),
      message: cleanText(body.message),
    };

    if (!data.name || !data.mobile) {
      return NextResponse.json(
        {
          success: false,
          message: "Name and mobile number are required.",
        },
        { status: 400 },
      );
    }

    if (!data.requirement) {
      return NextResponse.json(
        {
          success: false,
          message: "Requirement is required.",
        },
        { status: 400 },
      );
    }

    if (!ALLOWED_REQUIREMENTS.includes(data.requirement)) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid requirement. Please select one of: ${ALLOWED_REQUIREMENTS.join(
            ", ",
          )}.`,
          receivedRequirement: data.requirement,
        },
        { status: 400 },
      );
    }

    /**
     * Sub-requirement is required only for Wedding Cards.
     */
    if (data.requirement === "Wedding Cards") {
      if (!data.subRequirement) {
        return NextResponse.json(
          {
            success: false,
            message: "Sub requirement is required for Wedding Cards.",
          },
          { status: 400 },
        );
      }

      if (!WEDDING_CARD_SUB_REQUIREMENTS.includes(data.subRequirement)) {
        return NextResponse.json(
          {
            success: false,
            message: `Invalid wedding card sub requirement. Please select one of: ${WEDDING_CARD_SUB_REQUIREMENTS.join(
              ", ",
            )}.`,
            receivedSubRequirement: data.subRequirement,
          },
          { status: 400 },
        );
      }
    }

    /**
     * For non-wedding requirements, clear sub-requirement completely.
     */
    if (data.requirement !== "Wedding Cards") {
      data.subRequirement = "";
    }

    const leadPayload = buildLeadPayload(data);

    const url = `${erpUrl.replace(/\/$/, "")}/api/resource/${encodeURIComponent(
      leadDoctype,
    )}`;

    console.log("Creating CRM enquiry:", {
      leadDoctype,
      url,
      requirement: data.requirement,
      subRequirement: data.subRequirement,
      requirementField: FIELD_REQUIREMENT,
      subRequirementField: FIELD_SUB_REQUIREMENT,
      payload: leadPayload,
    });

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
          url,
          sentPayload: leadPayload,
          erpError: result,
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Lead created successfully.",
      doctype: leadDoctype,
      url,
      sentPayload: leadPayload,
      lead: result,
    });
  } catch (error) {
    console.error("Contact lead route error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong while submitting the enquiry.",
        doctype: leadDoctype,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}