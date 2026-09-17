import { MapPin, Printer, Stamp, Truck } from "lucide-react";

const features = [
  {
    Icon: Printer,
    title: "Printed in Kolkata",
    detail: "Printing for your celebration.",
  },
  {
    Icon: Stamp,
    title: "Foil, emboss and die-cut finishes",
    detail: "Ask about options for your design.",
  },
  {
    Icon: MapPin,
    title: "Showroom at Jackson Lane, Canning Street",
    detail: "See the cards in person.",
  },
  {
    Icon: Truck,
    title: "Delivery across India",
    detail: "Timelines depend on your location.",
  },
];

export default function WeddingCardsFeatures() {
  return (
    <section
      aria-label="Printing and delivery"
      className="mx-auto grid max-w-7xl gap-7 border-y border-gold/20 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8"
    >
      {features.map(({ Icon, title, detail }) => (
        <div key={title} className="flex items-start gap-3">
          <Icon
            size={18}
            aria-hidden="true"
            className="mt-1 shrink-0 text-[#a7772d]"
          />
          <div>
            <h2 className="text-sm font-semibold text-carbon">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-ink-mid">{detail}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
