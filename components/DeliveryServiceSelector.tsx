"use client";

import dynamic from "next/dynamic";
import { isValidIndianPincode, type ShippingSelection } from "@/lib/shipping";

const DeliveryLocationPicker = dynamic(() => import("@/components/DeliveryLocationPicker"), {
  ssr: false,
  loading: () => <p className="mt-3 text-sm text-ink-mid">Loading delivery map…</p>,
});

type Props = {
  selection: ShippingSelection;
  onChange: (selection: ShippingSelection) => void;
  pincode: string;
  locationResetKey?: string;
  disabled?: boolean;
};

export default function DeliveryServiceSelector({ selection, onChange, pincode, locationResetKey = "", disabled = false }: Props) {
  const updateSelection = (next: ShippingSelection) => { if (!disabled) onChange(next); };
  return (
    <fieldset disabled={disabled} className="mt-5 rounded-2xl border border-gold/20 p-4">
      <legend className="px-1 text-sm font-semibold text-maroon">Delivery service</legend>
      <div className="space-y-3 text-sm">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="radio" name="delivery-service" value="standard" checked={selection.service === "standard"} onChange={() => updateSelection({ service: "standard" })} className="mt-1 accent-maroon" />
          <span><strong className="block text-maroon">Standard delivery</strong><span className="text-ink-mid">Courier delivery after your order is ready.</span></span>
        </label>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="radio" name="delivery-service" value="quick" checked={selection.service === "quick"} onChange={() => updateSelection({ service: "quick" })} className="mt-1 accent-maroon" />
          <span><strong className="block text-maroon">Shiprocket Quick</strong><span className="text-ink-mid">Local delivery once your invitations are ready. Subject to availability.</span></span>
        </label>
      </div>
      {selection.service === "quick" && (isValidIndianPincode(pincode) ? (
        <DeliveryLocationPicker key={`${pincode}:${locationResetKey}`} disabled={disabled} value={selection.deliveryLocation} onConfirm={(deliveryLocation) => updateSelection({ service: "quick", deliveryLocation })} onInvalidate={() => {
          if (selection.deliveryLocation) updateSelection({ service: "quick" });
        }} />
      ) : <p className="mt-3 text-sm text-ink-mid">Enter a valid delivery pincode, then pin your exact delivery location.</p>)}
    </fieldset>
  );
}
