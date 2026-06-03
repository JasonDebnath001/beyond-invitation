import { NextResponse } from "next/server";

type ContactLeadPayload = {
  name?: string;
  fullName?: string;
  lead_name?: string;
  first_name?: string;

  mobile?: string;
  phone?: string;
  whatsapp?: string;

  email?: string;
  email_id?: string;

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

function cleanText(value?: string) {
  return typeof value === "string" ? value.trim() : "";
}

function removeUndefined<T extends Record<string, unknown>>(object: T) {
  return Object.fromEntries(
    Object.entries(object).filter(
      ([, value]) => value !== undefined && value !== ""
    )
  );
}

function buildEnquiryDetails(data: {
  fullName: string;
  mobile: string;
  email: string;
  requirement: string;
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
    `Name: ${data.fullName}`,
    `Mobile: ${data.mobile}`,
    `Email: ${data.email || "-"}`,
    `Requirement: ${data.requirement || "-"}`,
    `Sub Requirement: ${data.subRequirement || "-"}`,
    `Quantity: ${data.quantity || "-"}`,
    `Event Date: ${data.eventDate || "-"}`,
    `Budget Per Unit: ${data.budgetPerUnit || "-"}`,
    `Total Budget: ${data.totalBudget || "-"}`,
    "",
    "Message:",
    data.message || "-",
  ].join("\n");
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

    /**
     * This is important.
     * Your frontend may send name, fullName, lead_name, or first_name.
     * We accept all, then send ERPNext lead_name explicitly.
     */
    const fullName =
      cleanText(body.name) ||
      cleanText(body.fullName) ||
      cleanText(body.lead_name) ||
      cleanText(body.first_name);

    const mobile =
      cleanText(body.mobile) ||
      cleanText(body.phone) ||
      cleanText(body.whatsapp);

    const email = cleanText(body.email) || cleanText(body.email_id);

    const data = {
      fullName,
      mobile,
      email,
      requirement: cleanText(body.requirement),
      subRequirement: cleanText(body.subRequirement),
      quantity: cleanText(body.quantity),
      eventDate: cleanText(body.eventDate),
      budgetPerUnit: cleanText(body.budgetPerUnit),
      totalBudget: cleanText(body.totalBudget),
      message: cleanText(body.message),
    };

    if (!data.fullName || !data.mobile) {
      return NextResponse.json(
        {
          success: false,
          message: "Full Name and Mobile Number are required.",
          receivedBody: body,
          parsedData: data,
        },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const details = buildEnquiryDetails(data);

    /**
     * ERPNext custom_requirement options are currently only:
     * A
     * B
     *
     * So do not send website values like "Wedding Cards" into this Select field
     * unless ERPNext options are updated.
     */
    const allowedRequirements = ["A", "B"];

    const leadDoc = removeUndefined({
      doctype: "Lead",

      naming_series: "CRM-LEAD-.YYYY.-",

      // Full Name fields
      lead_name: data.fullName,
      first_name: data.fullName,

      // Your custom date field
      custom_lead_date: today,

      // Contact fields
      email_id: data.email || undefined,
      mobile_no: data.mobile,
      phone: data.mobile,
      whatsapp_no: data.mobile,

      // Lead classification
      status: "Lead",
      type: "Client",
      request_type: "Product Enquiry",

      // Custom fields
      custom_requirement: allowedRequirements.includes(data.requirement)
        ? data.requirement
        : undefined,

      custom_details__price_quoted: details,

      // Link field: Lead Source named "Website" must exist in ERPNext
      source: "Website",
    });

    const url = `${erpUrl.replace(
      /\/$/,
      ""
    )}/api/method/frappe.client.insert`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `token ${erpApiKey}:${erpApiSecret}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        doc: leadDoc,
      }),
    });

    const rawText = await response.text();

    let result: unknown = null;

    try {
      result = rawText ? JSON.parse(rawText) : null;
    } catch {
      result = rawText;
    }

    if (!response.ok) {
      console.error("ERPNext Lead creation failed:", {
        status: response.status,
        statusText: response.statusText,
        url,
        receivedBody: body,
        parsedData: data,
        sentDoc: leadDoc,
        result,
      });

      return NextResponse.json(
        {
          success: false,
          message: "Could not create lead in ERPNext.",
          status: response.status,
          statusText: response.statusText,
          receivedBody: body,
          parsedData: data,
          sentDoc: leadDoc,
          erpError: result,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Lead created successfully.",
      sentDoc: leadDoc,
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