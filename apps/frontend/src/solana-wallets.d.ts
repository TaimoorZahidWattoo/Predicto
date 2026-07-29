import type { SolanaWallet } from "@supabase/supabase-js";

export {};

declare global {
  interface Window {
    solflare?: SolanaWallet;
    phantom?: {
      solana?: SolanaWallet;
    };
  }
}
