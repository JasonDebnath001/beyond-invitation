"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const AuthContext = createContext<{ user: User | null; ready: boolean }>({
  user: null,
  ready: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ user: User | null; ready: boolean }>({
    user: null,
    ready: false,
  });

  useEffect(() => {
    let active = true;
    let changed = false;
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        changed = true;
        if (active) setState({ user: session?.user ?? null, ready: true });
      });
      void supabase.auth
        .getUser()
        .then(({ data }) => {
          if (active && !changed) setState({ user: data.user, ready: true });
        })
        .catch(() => {
          if (active && !changed) setState({ user: null, ready: true });
        });
      return () => {
        active = false;
        subscription.unsubscribe();
      };
    } catch {
      setState({ user: null, ready: true });
      return () => {
        active = false;
      };
    }
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
