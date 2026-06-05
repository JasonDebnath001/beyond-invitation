"use client";

import { FormEvent, useMemo, useState } from "react";

type SubmitStatus = "idle" | "submitting" | "success" | "error";

export default function ContactLeadForm() {
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [message, setMessage] = useState("");
  const [quantity, setQuantity] = useState("");
  const [budgetPerUnit, setBudgetPerUnit] = useState("");

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

      requirement: String(formData.get("requirement") || ""),
      subRequirement: String(formData.get("subRequirement") || ""),
      quantity: String(formData.get("quantity") || ""),
      eventDate: String(formData.get("eventDate") || ""),
      budgetPerUnit: String(formData.get("budgetPerUnit") || ""),
      totalBudget: String(formData.get("totalBudget") || ""),
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
            : JSON.stringify(serverMessage)
        );
      }

      setStatus("success");
      setMessage("Thank you. Your enquiry has been submitted successfully.");

      form.reset();
      setQuantity("");
      setBudgetPerUnit("");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to submit enquiry right now."
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-light">
            Name
          </label>
          <input
            name="name"
            required
            className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-light">
            Mobile Number
          </label>
          <input
            name="mobile"
            required
            inputMode="tel"
            className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-light">
            Email
          </label>
          <input
            name="email"
            type="email"
            className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-light">
            Source
          </label>
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
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-light">
            Requirement
          </label>
          <select
            name="requirement"
            required
            className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
          >
            <option value="">Select requirement</option>
            <option value="Wedding Cards">Wedding Cards</option>
            <option value="Rakhi Packaging Item">Rakhi Packaging Item</option>
            <option value="Sagun Envelopes">Sagun Envelopes</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-light">
            Sub Requirement
          </label>
          <select
            name="subRequirement"
            className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
          >
            <option value="">Select sub requirement</option>
            <option value="Hindu Wedding Cards">Hindu Wedding Cards</option>
            <option value="Muslim Wedding Cards">Muslim Wedding Cards</option>
            <option value="Christian Wedding Cards">
              Christian Wedding Cards
            </option>
            <option value="General Wedding Cards">General Wedding Cards</option>
            <option value="Premium Sagun Envelope">
              Premium Sagun Envelope
            </option>
            <option value="Rakhi Box">Rakhi Box</option>
            <option value="Rakhi Tray">Rakhi Tray</option>
            <option value="Custom Design">Custom Design</option>
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-light">
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
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-light">
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
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-light">
            Budget Total
          </label>
          <input
            name="totalBudget"
            value={totalBudget}
            readOnly
            className="mt-2 w-full rounded-2xl border border-carbon/10 bg-paper px-4 py-3 text-sm text-ink outline-none"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-light">
          Function Date
        </label>
        <input
          name="eventDate"
          type="date"
          className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-light">
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