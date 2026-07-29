import type { JwtPayload, SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

export function useUser(supabase: SupabaseClient) {
  const [claims, setClaims] = useState<JwtPayload | null>(null);

  useEffect(() => {
    const loadClaims = () => {
      supabase.auth.getClaims().then(({ data }) => {
        setClaims(data?.claims ?? null);
      });
    };

    loadClaims();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadClaims();
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  return {
    claims,
  };
}
