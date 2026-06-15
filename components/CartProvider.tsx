"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from "react";

import type { Product } from "@/types";

export const MIN_QTY = 50;

export type QuantityStep = 25 | 50;

export type CartProduct = Product & {
  itemCode?: string;
  subject?: string;
};

/**
 * Quantity rules based only on the ERPNext Subject field:
 *
 * Subject = "Shagun Envelopes" → step 50
 * Every other subject → step 25
 */
export function getQuantityStepFromSubject(
  subject?: string,
): QuantityStep {
  const normalizedSubject = (subject ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (
    normalizedSubject === "shagun envelopes" ||
    normalizedSubject === "shagun envelope"
  ) {
    return 50;
  }

  return 25;
}

export interface CartItem {
  slug: string;
  itemCode: string;
  subject: string;
  name: string;
  price: number;
  image: string;
  emoji: string;
  quantity: number;
  quantityStep: QuantityStep;
}

interface CartState {
  items: CartItem[];
}

type CartAction =
  | {
      type: "ADD";
      product: CartProduct;
      quantity: number;
    }
  | {
      type: "REMOVE";
      slug: string;
    }
  | {
      type: "SET_QTY";
      slug: string;
      quantity: number;
    }
  | {
      type: "CLEAR";
    }
  | {
      type: "HYDRATE";
      items: CartItem[];
    };

/**
 * New storage key prevents previously stored cart items—which did not
 * contain the Subject field—from continuing to use the wrong step.
 */
const STORAGE_KEY = "beyond-invitation-cart-v2";

function sanitizeQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) {
    return MIN_QTY;
  }

  return Math.max(MIN_QTY, Math.floor(quantity));
}

function cartReducer(
  state: CartState,
  action: CartAction,
): CartState {
  switch (action.type) {
    case "ADD": {
      const quantityToAdd = sanitizeQuantity(
        action.quantity,
      );

      const subject = action.product.subject ?? "";

      const quantityStep =
        getQuantityStepFromSubject(subject);

      const existingItem = state.items.find(
        (item) =>
          item.slug === action.product.slug,
      );

      if (existingItem) {
        return {
          items: state.items.map((item) =>
            item.slug === action.product.slug
              ? {
                  ...item,
                  itemCode:
                    action.product.itemCode ??
                    item.itemCode,
                  subject:
                    action.product.subject ??
                    item.subject,
                  quantityStep,
                  quantity:
                    item.quantity +
                    quantityToAdd,
                }
              : item,
          ),
        };
      }

      return {
        items: [
          ...state.items,
          {
            slug: action.product.slug,
            itemCode:
              action.product.itemCode ?? "",
            subject,
            name: action.product.name,
            price: action.product.price,
            image:
              action.product.images[0] ?? "",
            emoji: action.product.emoji,
            quantity: quantityToAdd,
            quantityStep,
          },
        ],
      };
    }

    case "REMOVE": {
      return {
        items: state.items.filter(
          (item) =>
            item.slug !== action.slug,
        ),
      };
    }

    case "SET_QTY": {
      const nextQuantity = sanitizeQuantity(
        action.quantity,
      );

      return {
        items: state.items.map((item) =>
          item.slug === action.slug
            ? {
                ...item,
                quantity: nextQuantity,
              }
            : item,
        ),
      };
    }

    case "CLEAR": {
      return {
        items: [],
      };
    }

    case "HYDRATE": {
      return {
        items: action.items.map((item) => {
          const subject =
            item.subject ?? "";

          return {
            ...item,
            itemCode: item.itemCode ?? "",
            subject,
            quantity: sanitizeQuantity(
              Number(item.quantity),
            ),

            /**
             * Always calculate it again from Subject.
             * Do not trust an older stored quantityStep.
             */
            quantityStep:
              getQuantityStepFromSubject(
                subject,
              ),
          };
        }),
      };
    }

    default: {
      return state;
    }
  }
}

interface CartContextValue {
  items: CartItem[];

  addItem: (
    product: CartProduct,
    quantity?: number,
  ) => void;

  removeItem: (slug: string) => void;

  setQuantity: (
    slug: string,
    quantity: number,
  ) => void;

  clearCart: () => void;

  totalItems: number;

  totalPrice: number;
}

const CartContext =
  createContext<CartContextValue | null>(null);

export function CartProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(
    cartReducer,
    {
      items: [],
    },
  );

  const isFirstPersist = useRef(true);

  useEffect(() => {
    try {
      const storedCart =
        localStorage.getItem(STORAGE_KEY);

      if (!storedCart) {
        return;
      }

      const parsedCart =
        JSON.parse(storedCart);

      if (!Array.isArray(parsedCart)) {
        return;
      }

      dispatch({
        type: "HYDRATE",
        items: parsedCart as CartItem[],
      });
    } catch {
      // Ignore invalid or unavailable localStorage.
    }
  }, []);

  useEffect(() => {
    if (isFirstPersist.current) {
      isFirstPersist.current = false;
      return;
    }

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state.items),
      );
    } catch {
      // Ignore quota or private-mode errors.
    }
  }, [state.items]);

  const totalItems = state.items.reduce(
    (sum, item) =>
      sum + item.quantity,
    0,
  );

  const totalPrice = state.items.reduce(
    (sum, item) =>
      sum +
      item.price * item.quantity,
    0,
  );

  const value: CartContextValue = {
    items: state.items,

    /**
     * Default quantity is 50 because that is the minimum
     * order quantity used by ProductBuyBox.
     */
    addItem: (
      product,
      quantity = MIN_QTY,
    ) => {
      dispatch({
        type: "ADD",
        product,
        quantity,
      });
    },

    removeItem: (slug) => {
      dispatch({
        type: "REMOVE",
        slug,
      });
    },

    setQuantity: (
      slug,
      quantity,
    ) => {
      dispatch({
        type: "SET_QTY",
        slug,
        quantity,
      });
    },

    clearCart: () => {
      dispatch({
        type: "CLEAR",
      });
    },

    totalItems,

    totalPrice,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart must be used inside <CartProvider>",
    );
  }

  return context;
}