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

/*
 * QUANTITY RULES
 * --------------
 * Shagun/Sagun Envelopes: increment/decrement by 50
 * Wedding Cards and everything else: increment/decrement by 25
 */
export const MIN_ORDER_QUANTITY = 50;

export type QuantityStep = 25 | 50;

type CartProduct = Product & {
  itemCode?: string;
  itemGroup?: string;
};

/*
 * Converts text into a predictable lowercase format.
 */
function normalizeText(value?: string): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * Detects the correct quantity step.
 *
 * ERPNext itemGroup is checked first.
 * Product name, slug and item code are included as fallbacks.
 */
export function getProductQuantityStep(
  product: {
    name: string;
    slug: string;
    itemCode?: string;
    itemGroup?: string;
  },
): QuantityStep {
  const itemGroup = normalizeText(product.itemGroup);

  if (
    itemGroup.includes("shagun") ||
    itemGroup.includes("sagun")
  ) {
    return 50;
  }

  const fallbackText = normalizeText(
    [
      product.name,
      product.slug,
      product.itemCode,
    ]
      .filter(Boolean)
      .join(" "),
  );

  if (
    fallbackText.includes("shagun") ||
    fallbackText.includes("sagun")
  ) {
    return 50;
  }

  return 25;
}

/*
 * CART STATE
 * ----------
 * Global cart via React Context.
 *
 * The provider is wrapped around the application in layout.tsx so the
 * navbar, product pages and cart page use the same cart.
 *
 * The cart is persisted in localStorage.
 */

export interface CartItem {
  slug: string;
  itemCode: string;
  itemGroup?: string;
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

const STORAGE_KEY = "beyond-invitation-cart";

function sanitizeQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) {
    return 1;
  }

  return Math.max(1, Math.floor(quantity));
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

      const quantityStep = getProductQuantityStep(
        action.product,
      );

      const existing = state.items.find(
        (item) =>
          item.slug === action.product.slug,
      );

      if (existing) {
        return {
          items: state.items.map((item) =>
            item.slug === action.product.slug
              ? {
                  ...item,
                  itemCode:
                    action.product.itemCode ??
                    item.itemCode,
                  itemGroup:
                    action.product.itemGroup ??
                    item.itemGroup,
                  quantity:
                    item.quantity + quantityToAdd,
                  quantityStep,
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
            itemGroup:
              action.product.itemGroup ?? "",
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
          (item) => item.slug !== action.slug,
        ),
      };
    }

    case "SET_QTY": {
      const nextQuantity = Math.floor(
        action.quantity,
      );

      if (
        !Number.isFinite(nextQuantity) ||
        nextQuantity < 1
      ) {
        return {
          items: state.items.filter(
            (item) => item.slug !== action.slug,
          ),
        };
      }

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
      /*
       * Older localStorage cart items will not have itemGroup or
       * quantityStep. Infer the step from the information available.
       */
      const hydratedItems = action.items.map(
        (item) => ({
          ...item,
          itemCode: item.itemCode ?? "",
          itemGroup: item.itemGroup ?? "",
          quantity: sanitizeQuantity(
            Number(item.quantity),
          ),
          quantityStep:
            item.quantityStep === 50 ||
            item.quantityStep === 25
              ? item.quantityStep
              : getProductQuantityStep(item),
        }),
      );

      return {
        items: hydratedItems,
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

  /*
   * Skip the first persistence operation so an empty initial cart
   * does not overwrite the saved localStorage cart before hydration.
   */
  const isFirstPersist = useRef(true);

  /*
   * Load the saved cart after the component mounts.
   */
  useEffect(() => {
    try {
      const stored =
        localStorage.getItem(STORAGE_KEY);

      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored);

      if (!Array.isArray(parsed)) {
        return;
      }

      dispatch({
        type: "HYDRATE",
        items: parsed as CartItem[],
      });
    } catch {
      /*
       * Ignore corrupt JSON, unavailable storage or private-mode
       * localStorage errors.
       */
    }
  }, []);

  /*
   * Save the cart whenever it changes.
   */
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
      /*
       * Ignore quota and private-mode storage errors.
       */
    }
  }, [state.items]);

  const totalItems = state.items.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  const totalPrice = state.items.reduce(
    (sum, item) =>
      sum + item.price * item.quantity,
    0,
  );

  const value: CartContextValue = {
    items: state.items,

    /*
     * quantity defaults to 1 to remain compatible with the existing
     * ProductBuyBox implementation, which currently calls addItem()
     * repeatedly.
     *
     * It also supports addItem(product, 50) when the ProductBuyBox
     * is later changed to add the entire quantity in one operation.
     */
    addItem: (product, quantity = 1) => {
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

    setQuantity: (slug, quantity) => {
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

/*
 * Hook to read and mutate the cart.
 * Must be used inside <CartProvider>.
 */
export function useCart(): CartContextValue {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart must be used inside <CartProvider>",
    );
  }

  return context;
}