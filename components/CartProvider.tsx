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
 * CART STATE
 * ----------
 * Global cart via React Context. Wrapped around the app in layout.tsx so the
 * navbar, product cards and cart page all read/write the same cart.
 * Persisted to localStorage so the cart survives a page refresh.
 */

/** A snapshot of a product plus its quantity, stored in the cart. */
export interface CartItem {
  slug: string;
  name: string;
  price: number;
  image: string;
  emoji: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: "ADD"; product: Product }
  | { type: "REMOVE"; slug: string }
  | { type: "SET_QTY"; slug: string; quantity: number }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; items: CartItem[] };

const STORAGE_KEY = "shahi-cards-cart";

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD": {
      const existing = state.items.find(
        (i) => i.slug === action.product.slug,
      );
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.slug === action.product.slug
              ? { ...i, quantity: i.quantity + 1 }
              : i,
          ),
        };
      }
      return {
        items: [
          ...state.items,
          {
            slug: action.product.slug,
            name: action.product.name,
            price: action.product.price,
            image: action.product.images[0] ?? "",
            emoji: action.product.emoji,
            quantity: 1,
          },
        ],
      };
    }
    case "REMOVE":
      return { items: state.items.filter((i) => i.slug !== action.slug) };
    case "SET_QTY":
      if (action.quantity < 1) {
        return { items: state.items.filter((i) => i.slug !== action.slug) };
      }
      return {
        items: state.items.map((i) =>
          i.slug === action.slug ? { ...i, quantity: action.quantity } : i,
        ),
      };
    case "CLEAR":
      return { items: [] };
    case "HYDRATE":
      return { items: action.items };
    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  addItem: (product: Product) => void;
  removeItem: (slug: string) => void;
  setQuantity: (slug: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  // Skip persisting on the very first render (the empty initial state),
  // otherwise it would overwrite a saved cart before hydration runs.
  const isFirstPersist = useRef(true);

  // Load saved cart from localStorage on mount (client only).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        dispatch({ type: "HYDRATE", items: JSON.parse(stored) as CartItem[] });
      }
    } catch {
      // ignore corrupt or unavailable storage
    }
  }, []);

  // Persist on every cart change.
  useEffect(() => {
    if (isFirstPersist.current) {
      isFirstPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      // ignore quota / private-mode errors
    }
  }, [state.items]);

  const totalItems = state.items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = state.items.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0,
  );

  const value: CartContextValue = {
    items: state.items,
    addItem: (product) => dispatch({ type: "ADD", product }),
    removeItem: (slug) => dispatch({ type: "REMOVE", slug }),
    setQuantity: (slug, quantity) =>
      dispatch({ type: "SET_QTY", slug, quantity }),
    clearCart: () => dispatch({ type: "CLEAR" }),
    totalItems,
    totalPrice,
  };

  return (
    <CartContext.Provider value={value}>{children}</CartContext.Provider>
  );
}

/** Hook to read and mutate the cart. Must be used inside <CartProvider>. */
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used inside <CartProvider>");
  }
  return ctx;
}