"use client";

import { useCallback, useRef, useState } from "react";

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);

    if (window.Razorpay) return resolve(true);

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );

    if (existing) {
      if (existing.dataset.loaded === "true") return resolve(true);

      if (existing.dataset.error === "true") {
        existing.remove();
      } else {
        const onLoad = () => {
          existing.dataset.loaded = "true";
          cleanup();
          resolve(true);
        };

        const onError = () => {
          existing.dataset.error = "true";
          cleanup();
          resolve(false);
        };

        const cleanup = () => {
          existing.removeEventListener("load", onLoad);
          existing.removeEventListener("error", onError);
        };

        existing.addEventListener("load", onLoad);
        existing.addEventListener("error", onError);
        return;
      }
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;

    script.onload = () => {
      script.dataset.loaded = "true";
      resolve(true);
    };

    script.onerror = () => {
      script.dataset.error = "true";
      resolve(false);
    };

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

  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;

  notes?: string;
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

        const orderRes = await fetch("/api/razorpay/order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            items: args.items,
            customer: args.customer,
          }),
        });

        const orderData = await orderRes.json();

        if (!orderRes.ok) {
          throw new Error(orderData?.error || "Couldn't start checkout.");
        }

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
          notes: {
            customer_name: args.customer?.name || "",
            customer_email: args.customer?.email || "",
            customer_contact: args.customer?.contact || "",
            city: args.customer?.city || "",
            state: args.customer?.state || "",
            pincode: args.customer?.pincode || "",
          },
          theme: {
            color: "#7B1C2E",
          },
          modal: {
            ondismiss: () => {
              reset();
              args.onDismiss?.();
            },
          },
          handler: async (response: any) => {
            try {
              const verifyRes = await fetch("/api/razorpay/verify", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
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
                e instanceof Error
                  ? e.message
                  : "Payment verification failed.",
              );
            } finally {
              reset();
            }
          },
        });

        rzp.on("payment.failed", (resp: any) => {
          reset();
          args.onError?.(
            resp?.error?.description ||
              "Payment failed. Please try again.",
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

  return {
    startCheckout,
    loading,
  };
}