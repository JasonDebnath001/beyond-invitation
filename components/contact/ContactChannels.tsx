import Link from "next/link";
import {
  ArrowUpRight,
  createLucideIcon,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";
import { buildWhatsAppUrl, type EnquiryProduct } from "@/lib/contact";
import { BUSINESS_ADDRESS, CONTACT } from "@/lib/site-config";

const rowClass =
  "group flex min-w-0 items-center gap-4 rounded-2xl border border-gold/20 bg-white/80 px-5 py-4 transition hover:border-gold/50 hover:shadow-sm focus-within:border-gold/50";
const discClass =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper text-carbon";
const detailClass =
  "mt-0.5 block text-sm leading-6 text-ink-mid [overflow-wrap:anywhere]";

// Brand icons are no longer exported by the installed Lucide version.
const Instagram = createLucideIcon("Instagram", [
  ["rect", { x: "2", y: "2", width: "20", height: "20", rx: "5", key: "frame" }],
  ["circle", { cx: "12", cy: "12", r: "4", key: "lens" }],
  ["line", { x1: "17.5", y1: "6.5", x2: "17.51", y2: "6.5", key: "flash" }],
]);

function Arrow() {
  return (
    <ArrowUpRight
      aria-hidden="true"
      size={16}
      className="ml-auto shrink-0 text-ink-light transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-focus-within:-translate-y-0.5 group-focus-within:translate-x-0.5 motion-reduce:transform-none"
    />
  );
}

export default function ContactChannels({
  enquiryProduct,
}: {
  enquiryProduct: EnquiryProduct | null;
}) {
  const whatsappText = enquiryProduct
    ? `Hello Beyond Invitation, I would like a price for design ${enquiryProduct.designNo}.`
    : "Hello Beyond Invitation, I would like to know more.";
  const address = `${BUSINESS_ADDRESS.streetAddress}, ${BUSINESS_ADDRESS.addressLocality} ${BUSINESS_ADDRESS.postalCode}`;

  return (
    <nav aria-label="Contact channels" className="space-y-3">
      <a
        data-motion="channel"
        className={rowClass}
        href={buildWhatsAppUrl(CONTACT.whatsappNumber, whatsappText)}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className={discClass}>
          <MessageCircle size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="font-semibold text-carbon">WhatsApp</span>
          <span className={detailClass}>{CONTACT.displayPhone}</span>
        </span>
        <Arrow />
      </a>
      <div data-motion="channel" className={rowClass}>
        <span className={discClass}>
          <Phone size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-carbon">Call</p>
          <p className={detailClass}>
            <a
              href={`tel:+${CONTACT.whatsappNumber}`}
              className="whitespace-nowrap hover:underline"
            >
              {CONTACT.displayPhone}
            </a>
            {" or "}
            <a
              href={`tel:${CONTACT.landline.replace(/-/g, "")}`}
              className="whitespace-nowrap hover:underline"
            >
              {CONTACT.landline}
            </a>
          </p>
        </div>
        <Arrow />
      </div>
      <a
        data-motion="channel"
        className={rowClass}
        href={`mailto:${CONTACT.email}`}
      >
        <span className={discClass}>
          <Mail size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="font-semibold text-carbon">Email</span>
          <span className={detailClass}>{CONTACT.email}</span>
        </span>
        <Arrow />
      </a>
      <div data-motion="channel" className={rowClass}>
        <span className={discClass}>
          <MapPin size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:underline"
          >
            <span className="font-semibold text-carbon">Showroom</span>
            <span className={detailClass}>{address}</span>
          </a>
          <Link
            href="/visit-us"
            className="mt-1 inline-block text-xs font-semibold text-carbon underline decoration-gold/50 underline-offset-4 hover:decoration-carbon"
          >
            Visit us
          </Link>
        </div>
        <Arrow />
      </div>
      <a
        data-motion="channel"
        className={rowClass}
        href={CONTACT.instagram}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className={discClass}>
          <Instagram size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="font-semibold text-carbon">Instagram</span>
          <span className={detailClass}>{CONTACT.instagramHandle}</span>
        </span>
        <Arrow />
      </a>
    </nav>
  );
}
