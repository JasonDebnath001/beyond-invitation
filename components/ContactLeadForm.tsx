"use client";

import { FormEvent, useMemo, useState } from "react";

type SubmitStatus = "idle" | "submitting" | "success" | "error";

const REQUIREMENTS = [
  "Wedding Cards",
  "Rakhi Packaging Item",
  "Sagun Envelopes",
] as const;

const WEDDING_CARD_SUB_REQUIREMENTS = [
  "None Of The Above",
  "Hindu Wedding Cards",
  "Muslim Wedding Cards",
  "Christian Wedding Cards",
  "General Wedding Cards",
] as const;

export default function ContactLeadForm() {
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [message, setMessage] = useState("");

  const [requirement, setRequirement] = useState("");
  const [subRequirement, setSubRequirement] = useState("");

  const [quantity, setQuantity] = useState("");
  const [budgetPerUnit, setBudgetPerUnit] = useState("");

  const shouldShowSubRequirement = requirement === "Wedding Cards";

  const totalBudget = useMemo(() => {
    const qty = Number(quantity);
    const budget = Number(budgetPerUnit);

    if (!qty || !budget) {
      return "";
    }

    return String(qty * budget);
  }, [quantity, budgetPerUnit]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    setStatus("submitting");
    setMessage("");

    const payload = {
      name: String(formData.get("name") || ""),
      mobile: String(formData.get("mobile") || ""),
      email: String(formData.get("email") || ""),
      source: String(formData.get("source") || "Website"),

      requirement,

      /**
       * Only send sub-requirement when user selected Wedding Cards.
       * For Rakhi/Sagun this remains blank and backend will not send it to Frappe.
       */
      subRequirement: shouldShowSubRequirement ? subRequirement : "",

      quantity: String(formData.get("quantity") || ""),
      eventDate: String(formData.get("eventDate") || ""),
      budgetPerUnit: String(formData.get("budgetPerUnit") || ""),
      totalBudget,
      message: String(formData.get("message") || ""),
    };

    try {
      const response = await fetch("/api/contact-lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Lead submit error:", result);

        const serverMessage =
          result?.erpError?._server_messages ||
          result?.erpError?.exception ||
          result?.erpError?.exc_type ||
          result?.message ||
          "Failed to submit enquiry.";

        throw new Error(
          typeof serverMessage === "string"
            ? serverMessage
            : JSON.stringify(serverMessage),
        );
      }

      setStatus("success");
      setMessage("Thank you. Your enquiry has been submitted successfully.");

      form.reset();
      setRequirement("");
      setSubRequirement("");
      setQuantity("");
      setBudgetPerUnit("");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to submit enquiry right now.",
      );
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-[2rem] border border-gold/20 bg-white p-6 shadow-sm"
    >
      <div>
        <label className="text-sm font-medium text-carbon">Name</label>
        <input
          name="name"
          type="text"
          required
          className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-carbon">Mobile Number</label>
        <input
          name="mobile"
          type="tel"
          required
          className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-carbon">Email</label>
        <input
          name="email"
          type="email"
          className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-carbon">Source</label>
        <select
          name="source"
          defaultValue="Website"
          className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
        >
          <option value="Website">Website</option>
          <option value="WhatsApp">WhatsApp</option>
          <option value="Phone Call">Phone Call</option>
          <option value="Instagram">Instagram</option>
          <option value="Facebook">Facebook</option>
          <option value="Referral">Referral</option>
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-carbon">Requirement</label>
        <select
          name="requirement"
          value={requirement}
          required
          onChange={(event) => {
            const nextRequirement = event.target.value;
            setRequirement(nextRequirement);

            /**
             * Reset sub-requirement when requirement changes.
             * This prevents old Wedding Card sub-requirement from being sent
             * when user switches to Rakhi or Sagun.
             */
            setSubRequirement("");
          }}
          className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
        >
          <option value="">Select requirement</option>
          {REQUIREMENTS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {shouldShowSubRequirement ? (
        <div>
          <label className="text-sm font-medium text-carbon">
            Sub Requirement
          </label>
          <select
            name="subRequirement"
            value={subRequirement}
            required
            onChange={(event) => setSubRequirement(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
          >
            <option value="">Select sub requirement</option>

            {WEDDING_CARD_SUB_REQUIREMENTS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label className="text-sm font-medium text-carbon">
          Quantity Required
        </label>
        <input
          name="quantity"
          type="number"
          min="1"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-carbon">
          Budget Per Unit
        </label>
        <input
          name="budgetPerUnit"
          type="number"
          min="0"
          value={budgetPerUnit}
          onChange={(event) => setBudgetPerUnit(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-carbon">Budget Total</label>
        <input
          name="totalBudget"
          type="number"
          value={totalBudget}
          readOnly
          className="mt-2 w-full rounded-2xl border border-carbon/10 bg-carbon/5 px-4 py-3 text-sm text-ink outline-none"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-carbon">Function Date</label>
        <input
          name="eventDate"
          type="date"
          className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-carbon">
          Special Requirement and Remark
        </label>
        <textarea
          name="message"
          rows={4}
          className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
        />
      </div>

      {message ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            status === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-full bg-carbon px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-carbon-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "submitting" ? "Submitting..." : "Submit Enquiry"}
      </button>

      <p className="text-center text-xs text-ink-light">
        Your enquiry will be sent directly to our CRM team.
      </p>
    </form>
  );
}