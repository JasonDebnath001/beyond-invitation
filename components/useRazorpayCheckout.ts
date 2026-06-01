"use client";

import { useCallback, useRef, useState } from "react";

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export interface CheckoutItem {
  itemCode?: string;
  slug?: string;
  quantity: number;
}

export interface CheckoutCustomer {
  name?: string;
  email?: string;
  contact?: string;
}

interface StartArgs {
  items: CheckoutItem[];
  customer?: CheckoutCustomer;
  onSuccess?: (r: {
    paymentId: string;
    erpOrder: string | null;
    fulfilmentPending: boolean;
  }) => void;
  onError?: (message: string) => void;
  onDismiss?: () => void;
}

export function useRazorpayCheckout() {
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);

  const reset = useCallback(() => {
    setLoading(false);
    busy.current = false;
  }, []);

  const startCheckout = useCallback(
    async (args: StartArgs) => {
      if (busy.current) return;
      busy.current = true;
      setLoading(true);

      try {
        const ok = await loadRazorpayScript();
        if (!ok || !window.Razorpay) {
          throw new Error(
            "Couldn't load the Razorpay checkout. Check your connection and retry.",
          );
        }

        // 1) Server creates the Razorpay order + the draft ERP Sales Order.
        const orderRes = await fetch("/api/razorpay/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: args.items, customer: args.customer }),
        });
        const orderData = await orderRes.json();
        if (!orderRes.ok) {
          throw new Error(orderData?.error || "Couldn't start checkout.");
        }

        // 2) Open Razorpay Checkout.
        const rzp = new window.Razorpay({
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "Beyond Invitation",
          description: "Wedding & ceremony invitation cards",
          image: "/logo.png",
          order_id: orderData.orderId,
          prefill: {
            name: args.customer?.name,
            email: args.customer?.email,
            contact: args.customer?.contact,
          },
          theme: { color: "#7B1C2E" },
          modal: {
            ondismiss: () => {
              reset();
              args.onDismiss?.();
            },
          },
          handler: async (response) => {
            // 3) Verify signature server-side, which also fulfils the order.
            try {
              const verifyRes = await fetch("/api/razorpay/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(response),
              });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok || !verifyData.verified) {
                throw new Error(
                  verifyData?.error || "Payment could not be verified.",
                );
              }
              args.onSuccess?.({
                paymentId: verifyData.paymentId,
                erpOrder: verifyData.erpOrder ?? null,
                fulfilmentPending: !!verifyData.fulfilmentPending,
              });
            } catch (e) {
              args.onError?.(
                e instanceof Error ? e.message : "Payment verification failed.",
              );
            } finally {
              reset();
            }
          },
        });

        rzp.on("payment.failed", (resp: any) => {
          reset();
          args.onError?.(
            resp?.error?.description || "Payment failed. Please try again.",
          );
        });

        rzp.open();
      } catch (e) {
        reset();
        args.onError?.(
          e instanceof Error
            ? e.message
            : "Something went wrong starting checkout.",
        );
      }
    },
    [reset],
  );

  return { startCheckout, loading };
}