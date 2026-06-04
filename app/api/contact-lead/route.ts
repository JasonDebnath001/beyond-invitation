import { NextResponse } from "next/server";

type ContactLeadPayload = {
  name?: string;
  mobile?: string;
  email?: string;
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

const leadDoctype = process.env.ERPNEXT_LEAD_DOCTYPE || "CRM Lead";
const leadStatus = process.env.ERPNEXT_CRM_LEAD_STATUS || "New";
const leadSource = process.env.ERPNEXT_CRM_LEAD_SOURCE || "";
const enquiryDetailsField =
  process.env.ERPNEXT_CRM_LEAD_ENQUIRY_FIELD || "custom_enquiry_details";

function cleanText(value?: string) {
  return typeof value === "string" ? value.trim() : "";
}

function removeEmpty<T extends Record<string, unknown>>(object: T) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string" && value.trim() === "") return false;
      return true;
    })
  );
}

function toNumber(value: string) {
  if (!value) return undefined;

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function splitName(fullName: string) {
  const cleanName = fullName.trim();
  const parts = cleanName.split(/\s+/);

  const firstName = parts.shift() || cleanName;
  const lastName = parts.join(" ");

  return {
    firstName,
    lastName,
  };
}

/**
 * Frappe CRM custom_requirement is a Select field.
 * Current allowed values:
 * - Wedding Cards
 * - Rakhi Packaging Item
 * - Sagun Envelopes
 */
function normalizeRequirement(requirement: string) {
  const value = requirement.trim();

  const map: Record<string, string> = {
    "Wedding Cards": "Wedding Cards",
    "Wedding Card": "Wedding Cards",
    Wedding: "Wedding Cards",

    "Hindu Wedding Cards": "Wedding Cards",
    "Bengali Wedding Cards": "Wedding Cards",
    "Muslim Wedding Cards": "Wedding Cards",
    "mushlim Wedding cards": "Wedding Cards",

    Rakhi: "Rakhi Packaging Item",
    "Rakhi Cards": "Rakhi Packaging Item",
    "Rakhi Card": "Rakhi Packaging Item",
    "Rakhi Boxes": "Rakhi Packaging Item",
    "Rakhi Box": "Rakhi Packaging Item",
    "Rakhi Tags": "Rakhi Packaging Item",
    "Rakhi Tag": "Rakhi Packaging Item",
    "Rakhi Packaging": "Rakhi Packaging Item",
    "Rakhi Packaging Item": "Rakhi Packaging Item",

    "Shagun Envelopes": "Sagun Envelopes",
    "Shagun Envelope": "Sagun Envelopes",
    "Premium Shagun Envelope": "Sagun Envelopes",
    "Premium Shagun Envelopes": "Sagun Envelopes",
    "Sagun Envelopes": "Sagun Envelopes",
    "Sagun Envelope": "Sagun Envelopes",
    Shagun: "Sagun Envelopes",
    Sagun: "Sagun Envelopes",
  };

  return map[value] || value;
}

/**
 * Only send custom_sub_requirement when it matches the current Frappe CRM
 * Select field options. Otherwise do not send it, because Frappe rejects
 * invalid Select values.
 *
 * Actual selected sub requirement is still saved in enquiry details.
 */
function normalizeSubRequirement(subRequirement: string) {
  const value = subRequirement.trim();

  const map: Record<string, string> = {
    "Hindu Wedding Cards": "Hindu Wedding Cards",
    "Hindu Wedding Card": "Hindu Wedding Cards",

    "Bengali Wedding Cards": "Bengali Wedding Cards",
    "Bengali Wedding Card": "Bengali Wedding Cards",

    "Muslim Wedding Cards": "mushlim Wedding cards",
    "Muslim Wedding Card": "mushlim Wedding cards",
    "Mushlim Wedding Cards": "mushlim Wedding cards",
    "Mushlim Wedding Card": "mushlim Wedding cards",
    "mushlim Wedding cards": "mushlim Wedding cards",
  };

  return map[value] || "";
}

function buildEnquiryDetails(args: {
  name: string;
  mobile: string;
  email: string;
  requirement: string;
  originalRequirement: string;
  subRequirement: string;
  quantity: string;
  eventDate: string;
  budgetPerUnit: string;
  totalBudget: string;
  message: string;
}) {
  return [
    "Website Enquiry",
    "",
    `Name: ${args.name}`,
    `Mobile: ${args.mobile}`,
    `Email: ${args.email || "-"}`,
    `Requirement: ${args.requirement || "-"}`,
    `Original Requirement Selected: ${args.originalRequirement || "-"}`,
    `Sub Requirement Selected: ${args.subRequirement || "-"}`,
    `Quantity: ${args.quantity || "-"}`,
    `Event Date: ${args.eventDate || "-"}`,
    `Budget Per Unit: ${args.budgetPerUnit || "-"}`,
    `Total Budget: ${args.totalBudget || "-"}`,
    "",
    "Message:",
    args.message || "-",
  ].join("\n");
}

async function createFrappeComment(args: {
  leadName: string;
  content: string;
}) {
  if (!erpUrl || !erpApiKey || !erpApiSecret) return;

  const url = `${erpUrl.replace(/\/$/, "")}/api/resource/Comment`;

  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `token ${erpApiKey}:${erpApiSecret}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      comment_type: "Comment",
      reference_doctype: leadDoctype,
      reference_name: args.leadName,
      content: args.content.replace(/\n/g, "<br />"),
    }),
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

    const originalRequirement = cleanText(body.requirement);
    const originalSubRequirement = cleanText(body.subRequirement);

    const normalizedRequirement = normalizeRequirement(originalRequirement);
    const normalizedSubRequirement =
      normalizeSubRequirement(originalSubRequirement);

    const data = {
      name: cleanText(body.name),
      mobile: cleanText(body.mobile),
      email: cleanText(body.email),
      requirement: normalizedRequirement,
      originalRequirement,
      subRequirement: originalSubRequirement,
      normalizedSubRequirement,
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
        { status: 400 }
      );
    }

    const { firstName, lastName } = splitName(data.name);
    const enquiryDetails = buildEnquiryDetails(data);

    const leadPayload: Record<string, unknown> = removeEmpty({
      first_name: firstName,
      last_name: lastName,
      lead_name: data.name,
      email: data.email,
      mobile_no: data.mobile,
      phone: data.mobile,
      status: leadStatus,

      source: leadSource || undefined,
      organization: "Website Enquiry",

      [enquiryDetailsField]: enquiryDetails,

      custom_requirement: data.requirement,

      /**
       * IMPORTANT:
       * Send custom_sub_requirement only when it is one of the allowed
       * Frappe CRM Select options.
       *
       * Do NOT send values like:
       * - Premium Shagun Envelope
       * - Rakhi Boxes
       * - Rakhi Cards
       *
       * Those values are saved in custom_enquiry_details and Comment.
       */
      custom_sub_requirement: data.normalizedSubRequirement || undefined,

      custom_quantity: toNumber(data.quantity),
      custom_event_date: data.eventDate,
      custom_budget_per_unit: toNumber(data.budgetPerUnit),
      custom_total_budget: toNumber(data.totalBudget),
      custom_message: data.message,
    });

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
    });

    const rawText = await response.text();

    let result: any = null;

    try {
      result = rawText ? JSON.parse(rawText) : null;
    } catch {
      result = rawText;
    }

    if (!response.ok) {
      console.error("Frappe CRM Lead creation failed:", {
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
          message: "Could not create lead in Frappe CRM.",
          status: response.status,
          statusText: response.statusText,
          doctype: leadDoctype,
          erpError: result,
        },
        { status: response.status }
      );
    }

    const createdLeadName = result?.data?.name;

    if (createdLeadName) {
      try {
        await createFrappeComment({
          leadName: createdLeadName,
          content: enquiryDetails,
        });
      } catch (commentError) {
        console.error("Frappe CRM Lead comment creation failed:", commentError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Lead created successfully in Frappe CRM.",
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