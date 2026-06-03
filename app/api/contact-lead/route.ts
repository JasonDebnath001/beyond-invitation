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
const leadDoctype = process.env.ERPNEXT_LEAD_DOCTYPE || "Lead";

function cleanText(value?: string) {
  return typeof value === "string" ? value.trim() : "";
}

function removeUndefined<T extends Record<string, unknown>>(object: T) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  );
}

function buildEnquiryDetails(data: Required<ContactLeadPayload>) {
  return [
    "Website Enquiry",
    "",
    `Name: ${data.name}`,
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

    const data: Required<ContactLeadPayload> = {
      name: cleanText(body.name),
      mobile: cleanText(body.mobile),
      email: cleanText(body.email),
      requirement: cleanText(body.requirement),
      subRequirement: cleanText(body.subRequirement),
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
          received: {
            name: data.name,
            mobile: data.mobile,
          },
        },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const details = buildEnquiryDetails(data);

    const allowedRequirements = ["A", "B"];

    const fullName = data.name;

    const leadPayload = removeUndefined({
      naming_series: "CRM-LEAD-.YYYY.-",

      // Full Name fields
      lead_name: fullName,
      title: fullName,
      first_name: fullName,

      // Custom lead date
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

      // Link field: Lead Source named "Website" must exist
      source: "Website",
    });

    console.log("ERPNext Lead Payload:", leadPayload);

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
          message: "Could not create lead in ERPNext.",
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