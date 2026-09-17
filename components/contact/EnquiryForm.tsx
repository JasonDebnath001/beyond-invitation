"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useContactMotion } from "@/components/contact/ContactMotion";
import ProductEnquiryBanner from "@/components/contact/ProductEnquiryBanner";
import EnquirySuccess from "@/components/contact/EnquirySuccess";
import {
  REQUIREMENTS, WEDDING_CARD_TYPES, buildEnquiryMessage, buildWhatsAppUrl,
  formatInr, isValidIndianMobile, normaliseMobile, requirementFromSubject, type EnquiryProduct,
} from "@/lib/contact";
import { CONTACT } from "@/lib/site-config";

const inputClass = "mt-2 w-full min-w-0 rounded-xl border border-carbon/15 bg-white px-4 py-3 text-[15px] text-ink placeholder:text-ink-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.18em] text-ink-mid";
const hintClass = "mt-1.5 text-xs text-ink-light";
type FieldName = "requirement" | "subRequirement" | "quantity" | "eventDate" | "name" | "mobile" | "email" | "budgetPerUnit" | "message";
type Errors = Partial<Record<FieldName, string>>;

function Reveal({ open, id, children }: { open: boolean; id: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const initiallyHidden = useRef(!open);
  const previousOpen = useRef(open);
  const motion = useContactMotion();
  useEffect(() => {
    if (ref.current && previousOpen.current !== open) {
      if (open) motion.expand(ref.current);
      else motion.collapse(ref.current);
    }
    previousOpen.current = open;
  }, [open, motion]);
  return <div ref={ref} id={id} hidden={initiallyHidden.current} aria-hidden={!open} inert={!open}>{children}</div>;
}

function FieldError({ field, errors }: { field: FieldName; errors: Errors }) {
  return errors[field] ? <p id={`enquiry-${field}-error`} className="mt-1.5 text-xs text-maroon">{errors[field]}</p> : null;
}

function localToday() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export default function EnquiryForm({ enquiryProduct }: { enquiryProduct: EnquiryProduct | null }) {
  const initial = requirementFromSubject(enquiryProduct?.subject || "");
  const [requirement, setRequirement] = useState(initial.requirement);
  const [subRequirement, setSubRequirement] = useState(initial.subRequirement);
  const [cardTypeMounted, setCardTypeMounted] = useState(initial.requirement === "Wedding Cards");
  const [quantity, setQuantity] = useState("");
  const [budget, setBudget] = useState("");
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [mobile, setMobile] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<{ name: string; mobile: string } | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [today, setToday] = useState(localToday);
  const totalRef = useRef<HTMLSpanElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);
  const focusAfterReset = useRef(false);
  const invalidField = useRef<string | null>(null);
  const motion = useContactMotion();
  const isWedding = requirement === "Wedding Cards";
  const computedTotal = quantity !== "" && budget !== "" ? Number(quantity) * Number(budget) : null;
  const total = computedTotal != null && Number.isFinite(computedTotal) && computedTotal >= 0 ? Math.round(computedTotal * 100) / 100 : null;
  const whatsappUrl = buildWhatsAppUrl(CONTACT.whatsappNumber, enquiryProduct
    ? `Hello Beyond Invitation, I would like a price for design ${enquiryProduct.designNo}.`
    : "Hello Beyond Invitation, I would like to know more.");

  useEffect(() => { setToday(localToday()); }, []);
  useEffect(() => {
    if (totalRef.current && total != null) motion.countTo(totalRef.current, total, formatInr);
  }, [total, budgetOpen, motion]);
  useEffect(() => {
    if (focusAfterReset.current && !success) {
      formRef.current?.querySelector<HTMLInputElement>('input[name="requirement"]')?.focus();
      focusAfterReset.current = false;
    }
  }, [success]);
  useEffect(() => {
    if (invalidField.current) {
      const field = formRef.current?.querySelector<HTMLElement>(`[name="${invalidField.current}"]`);
      invalidField.current = null;
      if (typeof window.requestAnimationFrame === "function") {
        const frame = window.requestAnimationFrame(() => field?.focus());
        return () => window.cancelAnimationFrame(frame);
      }
      field?.focus();
    }
  }, [errors]);

  function accessibility(field: FieldName, hint?: string) {
    return {
      "aria-invalid": errors[field] ? true as const : undefined,
      "aria-describedby": [hint, errors[field] ? `enquiry-${field}-error` : ""].filter(Boolean).join(" ") || undefined,
    };
  }

  function reset() {
    setRequirement(initial.requirement);
    setSubRequirement(initial.subRequirement);
    setCardTypeMounted(initial.requirement === "Wedding Cards");
    setQuantity(""); setBudget(""); setBudgetOpen(false); setMobile("");
    setErrors({}); setSubmitError(null); setBusy(false);
    setFormVersion(value => value + 1);
    focusAfterReset.current = true;
    setSuccess(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const read = (field: string) => String(data.get(field) || "").trim();
    const name = read("name");
    const phone = normaliseMobile(mobile);
    setSubmitError(null);
    if (String(data.get("website") || "").length > 0) {
      setSuccess({ name, mobile: phone });
      return;
    }

    const nextErrors: Errors = {};
    if (!REQUIREMENTS.some(item => item.value === requirement)) nextErrors.requirement = "Choose what you need.";
    if (isWedding && !WEDDING_CARD_TYPES.some(item => item.value === subRequirement)) nextErrors.subRequirement = "Choose a card type, or select Not sure yet.";
    if (quantity && (!Number.isInteger(Number(quantity)) || Number(quantity) < 1)) nextErrors.quantity = "Enter a quantity of at least 1.";
    if (read("eventDate") && read("eventDate") < localToday()) nextErrors.eventDate = "Choose today or a future date.";
    if (!name) nextErrors.name = "Enter your name.";
    else if (name.length > 100) nextErrors.name = "Keep your name to 100 characters.";
    if (!isValidIndianMobile(phone)) nextErrors.mobile = "Enter a 10-digit mobile number.";
    const emailInput = form.elements.namedItem("email") as HTMLInputElement;
    if (read("email") && !emailInput.validity.valid) nextErrors.email = "Enter a valid email address.";
    if (budget && (!Number.isFinite(Number(budget)) || Number(budget) < 0)) nextErrors.budgetPerUnit = "Enter a budget of 0 or more.";
    const message = buildEnquiryMessage(enquiryProduct, read("message"));
    if (message.length > 2000) nextErrors.message = "Keep your message, including the design details, to 2,000 characters.";
    setErrors(nextErrors);
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      if (nextErrors.budgetPerUnit) setBudgetOpen(true);
      invalidField.current = firstInvalid;
      return;
    }

    submitting.current = true;
    setBusy(true);
    const payload = {
      name, mobile: phone, email: read("email"), source: "Website", requirement,
      subRequirement: isWedding ? subRequirement : "",
      quantity, eventDate: read("eventDate"), budgetPerUnit: budget,
      totalBudget: total == null ? "" : String(total), message,
    };
    try {
      const response = await fetch("/api/contact-lead", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        setSubmitError(typeof result?.message === "string" && result.message.trim() ? result.message : "");
        return;
      }
      setSuccess({ name, mobile: phone });
    } catch {
      setSubmitError("");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (success) return <EnquirySuccess {...success} whatsappUrl={whatsappUrl} onReset={reset} />;

  return (
    <form key={formVersion} ref={formRef} onSubmit={submit} noValidate aria-label="Send an enquiry" aria-busy={busy} className="relative space-y-6">
      <header>
        <h2 className="text-3xl font-light tracking-tight text-maroon">Send an enquiry</h2>
        <p className="mt-2 text-sm text-ink-light">Takes about a minute.</p>
      </header>
      {enquiryProduct ? <ProductEnquiryBanner product={enquiryProduct} /> : null}

      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <legend className="mb-3 text-base font-semibold text-carbon">What do you need</legend>
        <div>
          <p id="enquiry-requirement-label" className={labelClass}>Requirement</p>
          <div role="radiogroup" aria-labelledby="enquiry-requirement-label" aria-required="true" {...accessibility("requirement")} className="mt-3 flex flex-wrap gap-2">
            {REQUIREMENTS.map(item => (
              <label key={item.value} className="relative cursor-pointer">
                <input type="radio" name="requirement" value={item.value} checked={requirement === item.value} required className="peer sr-only" {...accessibility("requirement")} onChange={() => {
                  setRequirement(item.value); setSubRequirement("");
                  if (item.value === "Wedding Cards") setCardTypeMounted(true);
                }} />
                <span className="block rounded-full border border-carbon/20 px-4 py-2 text-sm font-semibold text-carbon transition hover:border-carbon/60 peer-checked:border-carbon peer-checked:bg-carbon peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold">{item.label}</span>
              </label>
            ))}
          </div>
          <FieldError field="requirement" errors={errors} />
        </div>
        <Reveal id="enquiry-card-type" open={isWedding}>
          {cardTypeMounted ? <div className="pb-1">
            <label htmlFor="enquiry-subRequirement" className={labelClass}>Card type</label>
            <select id="enquiry-subRequirement" name="subRequirement" required={isWedding} disabled={!isWedding || busy} value={subRequirement} onChange={event => setSubRequirement(event.target.value)} className={inputClass} {...accessibility("subRequirement")}>
              <option value="">Choose a card type</option>
              {WEDDING_CARD_TYPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            {isWedding ? <FieldError field="subRequirement" errors={errors} /> : null}
          </div> : null}
        </Reveal>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="enquiry-quantity" className={labelClass}>Quantity</label>
            <input id="enquiry-quantity" name="quantity" type="number" inputMode="numeric" min={1} value={quantity} onChange={event => setQuantity(event.target.value)} className={inputClass} {...accessibility("quantity", "enquiry-quantity-hint")} />
            <p id="enquiry-quantity-hint" className={hintClass}>Approximate is fine.</p><FieldError field="quantity" errors={errors} />
          </div>
          <div className="min-w-0">
            <label htmlFor="enquiry-eventDate" className={labelClass}>Event date</label>
            <input id="enquiry-eventDate" name="eventDate" type="date" min={today} className={inputClass} {...accessibility("eventDate")} />
            <FieldError field="eventDate" errors={errors} />
          </div>
        </div>
      </fieldset>

      <fieldset disabled={busy} className="min-w-0 space-y-4 border-t border-gold/20 pt-5">
        <legend className="pr-3 text-base font-semibold text-carbon">Your details</legend>
        <div>
          <label htmlFor="enquiry-name" className={labelClass}>Name</label>
          <input id="enquiry-name" name="name" required autoComplete="name" maxLength={100} className={inputClass} {...accessibility("name")} />
          <FieldError field="name" errors={errors} />
        </div>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="enquiry-mobile" className={labelClass}>Mobile</label>
            <div className="relative"><span aria-hidden="true" className="pointer-events-none absolute bottom-3 left-4 text-[15px] text-ink-light">+91</span>
              <input id="enquiry-mobile" name="mobile" aria-label="Mobile, +91 India" type="tel" inputMode="numeric" required autoComplete="tel-national" maxLength={10} value={mobile} onChange={event => setMobile(normaliseMobile(event.target.value))} onPaste={event => {
                const pasted = normaliseMobile(event.clipboardData.getData("text"));
                if (isValidIndianMobile(pasted)) { event.preventDefault(); setMobile(pasted); }
              }} className={`${inputClass} pl-14`} {...accessibility("mobile")} />
            </div><FieldError field="mobile" errors={errors} />
          </div>
          <div className="min-w-0">
            <label htmlFor="enquiry-email" className={labelClass}>Email</label>
            <input id="enquiry-email" name="email" type="email" autoComplete="email" className={inputClass} {...accessibility("email", "enquiry-email-hint")} />
            <p id="enquiry-email-hint" className={hintClass}>Optional</p><FieldError field="email" errors={errors} />
          </div>
        </div>
      </fieldset>

      <div className="border-y border-gold/20 py-4">
        <button type="button" disabled={busy} aria-expanded={budgetOpen} aria-controls="enquiry-budget" onClick={() => setBudgetOpen(value => !value)} className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-carbon">
          Add a budget (optional)<ChevronDown size={16} aria-hidden="true" className={`shrink-0 transition-transform motion-reduce:transition-none ${budgetOpen ? "rotate-180" : ""}`} />
        </button>
        <Reveal id="enquiry-budget" open={budgetOpen}>
          <div className="pt-4">
            <label htmlFor="enquiry-budgetPerUnit" className={labelClass}>Budget per piece</label>
            <input id="enquiry-budgetPerUnit" name="budgetPerUnit" type="number" inputMode="decimal" min={0} step="0.01" disabled={!budgetOpen || busy} value={budget} onChange={event => setBudget(event.target.value)} className={inputClass} {...accessibility("budgetPerUnit")} />
            <FieldError field="budgetPerUnit" errors={errors} />
            {total != null ? <p className="mt-3 text-sm text-ink-mid"><span aria-hidden="true">Estimated total ₹<span ref={totalRef}>{formatInr(total)}</span></span><span className="sr-only" role="status">Estimated total ₹{formatInr(total)}</span></p> : <p className={hintClass}>Add a quantity and budget to see an estimated total.</p>}
          </div>
        </Reveal>
      </div>
      <div>
        <label htmlFor="enquiry-message" className={labelClass}>Anything we should know?</label>
        <textarea id="enquiry-message" name="message" rows={4} maxLength={2000} disabled={busy} defaultValue={buildEnquiryMessage(enquiryProduct, "")} className={`${inputClass} resize-y`} {...accessibility("message", "enquiry-message-hint")} />
        <p id="enquiry-message-hint" className={hintClass}>Design numbers, finishes, delivery city.</p><FieldError field="message" errors={errors} />
      </div>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px]" />
      <div className="space-y-3">
        {submitError !== null ? <div role="alert" className="rounded-xl border border-maroon/20 bg-white px-4 py-3 text-sm text-maroon">
          {submitError || <>We could not send your enquiry. Please try again or <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">message us on WhatsApp</a>.</>}
        </div> : null}
        <button type="submit" disabled={busy} className="w-full rounded-full bg-carbon px-6 py-3 text-sm font-semibold text-white transition hover:bg-carbon-dark disabled:cursor-wait disabled:opacity-60">{busy ? "Sending…" : "Send enquiry"}</button>
        <p className="text-center text-xs text-ink-light">Our team will call or message you back.</p>
      </div>
    </form>
  );
}
