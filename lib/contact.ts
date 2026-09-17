export type EnquiryProduct = {
  slug: string;
  designNo: string;
  name: string;
  image: string | null;
  subject: string;
  minOrderQty: number | null;
};

export const REQUIREMENTS = [
  { value: "Wedding Cards", label: "Wedding cards" },
  { value: "Sagun Envelopes", label: "Shagun envelopes" },
  { value: "Rakhi Packaging Item", label: "Rakhi packaging" },
] as const;

export const WEDDING_CARD_TYPES = [
  { value: "Hindu Wedding Cards", label: "Hindu wedding cards" },
  { value: "Muslim Wedding Cards", label: "Muslim wedding cards" },
  { value: "Christian Wedding Cards", label: "Christian wedding cards" },
  { value: "General Wedding Cards", label: "General wedding cards" },
  { value: "None Of The Above", label: "Not sure yet" },
] as const;

export function requirementFromSubject(subject: string) {
  switch (subject.trim()) {
    case "Hindu Wedding Card":
    case "Muslim Wedding Card":
    case "Christian Wedding Card":
      return { requirement: "Wedding Cards", subRequirement: `${subject.trim()}s` };
    case "Wedding Card":
    case "Wedding Box":
      return { requirement: "Wedding Cards", subRequirement: "General Wedding Cards" };
    case "Shagun Envelopes":
      return { requirement: "Sagun Envelopes", subRequirement: "" };
    case "Rakhi":
      return { requirement: "Rakhi Packaging Item", subRequirement: "" };
    default:
      return { requirement: "", subRequirement: "" };
  }
}

export function normaliseMobile(value: string) {
  const compact = value.replace(/[\s-]/g, "");
  if (compact.startsWith("+91")) return compact.slice(3);
  if (compact.length === 12 && compact.startsWith("91")) return compact.slice(2);
  if (compact.length === 11 && compact.startsWith("0")) return compact.slice(1);
  return compact;
}

export function isValidIndianMobile(value: string) {
  return /^[6-9]\d{9}$/.test(value);
}

export function buildWhatsAppUrl(number: string, text: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function buildEnquiryMessage(product: EnquiryProduct | null, message: string) {
  if (!product) return message.trim();
  const designLine = `Design no: ${product.designNo} — ${product.name}`;
  const remainder = message.split(/\r?\n/).filter(line => line.trim() !== designLine).join("\n").trim();
  return remainder ? `${designLine}\n${remainder}` : designLine;
}

export function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
}
