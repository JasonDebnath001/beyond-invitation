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
                    <label htmlFor="name" className="text-sm font-medium text-ink">
                        Name
                    </label>

                    <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        placeholder="Your name"
                        className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
                    />
                </div>

                <div>
                    <label htmlFor="mobile" className="text-sm font-medium text-ink">
                        Mobile Number
                    </label>

                    <input
                        id="mobile"
                        name="mobile"
                        type="tel"
                        required
                        placeholder="Your mobile number"
                        className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
                    />
                </div>
            </div>

            <div>
                <label htmlFor="email" className="text-sm font-medium text-ink">
                    Email
                </label>

                <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Your email address"
                    className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
                />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
                <div>
                    <label htmlFor="requirement" className="text-sm font-medium text-ink">
                        Requirement
                    </label>

                    <select
                        id="requirement"
                        name="requirement"
                        required
                        className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
                        defaultValue=""
                    >
                        <option value="" disabled>
                            Select a product type
                        </option>
                        <option>Wedding Cards</option>
                        <option>Shagun Envelopes</option>
                        <option>Shagun Boxes</option>
                        <option>Rakhi Cards</option>
                        <option>Rakhi Boxes</option>
                        <option>Custom Requirement</option>
                    </select>
                </div>

                <div>
                    <label
                        htmlFor="subRequirement"
                        className="text-sm font-medium text-ink"
                    >
                        Sub Requirement
                    </label>

                    <select
                        id="subRequirement"
                        name="subRequirement"
                        className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
                        defaultValue=""
                    >
                        <option value="" disabled>
                            Select sub requirement
                        </option>
                        <option>Hindu Wedding Card</option>
                        <option>Muslim Wedding Card</option>
                        <option>Christian Wedding Card</option>
                        <option>General Wedding Card</option>
                        <option>Premium Shagun Envelope</option>
                        <option>Custom Design</option>
                    </select>
                </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
                <div>
                    <label htmlFor="quantity" className="text-sm font-medium text-ink">
                        Quantity
                    </label>

                    <input
                        id="quantity"
                        name="quantity"
                        type="number"
                        min="1"
                        placeholder="Example: 500"
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
                    />
                </div>

                <div>
                    <label htmlFor="eventDate" className="text-sm font-medium text-ink">
                        Event Date
                    </label>

                    <input
                        id="eventDate"
                        name="eventDate"
                        type="date"
                        className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
                    />
                </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
                <div>
                    <label
                        htmlFor="budgetPerUnit"
                        className="text-sm font-medium text-ink"
                    >
                        Budget Per Unit
                    </label>

                    <input
                        id="budgetPerUnit"
                        name="budgetPerUnit"
                        type="number"
                        min="0"
                        placeholder="Example: 75"
                        value={budgetPerUnit}
                        onChange={(event) => setBudgetPerUnit(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
                    />
                </div>

                <div>
                    <label htmlFor="totalBudget" className="text-sm font-medium text-ink">
                        Total Budget
                    </label>

                    <input
                        id="totalBudget"
                        name="totalBudget"
                        type="number"
                        min="0"
                        placeholder="Auto calculated"
                        value={totalBudget}
                        readOnly
                        className="mt-2 w-full rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
                    />
                </div>
            </div>

            <div>
                <label htmlFor="message" className="text-sm font-medium text-ink">
                    Message
                </label>

                <textarea
                    id="message"
                    name="message"
                    rows={5}
                    placeholder="Tell us what you are looking for..."
                    className="mt-2 w-full resize-none rounded-2xl border border-carbon/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-carbon"
                />
            </div>

            {message ? (
                <div
                    className={`rounded-2xl px-4 py-3 text-sm ${status === "success"
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