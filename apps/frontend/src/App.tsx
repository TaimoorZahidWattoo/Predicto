import axios from "axios";
import {useUser} from "./hooks/useUser"
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useState } from "react";

function App(){
  const [supabase, _setSupabase] = useState(createClient("https://vqjtztoejtjlavueomdh.supabase.co", "sb_publishable_ai5jq9C3TakVyJ3awa__Gg_j2V7cNtS"));
    return <AppWrapper supabase={supabase} />
}

function AppWrapper({supabase}: {supabase: SupabaseClient}) {

  const { claims } = useUser(supabase);

  return (
  <div>
    {window.solflare != null && !claims && (
      <button
        onClick={async () => {
          console.log("Sign in button clicked");

          const { data, error } = await supabase.auth.signInWithWeb3({
            chain: "solana",
            statement: "I confirm that I am signing in to Prediction Market YT",
            wallet: window.solflare,
          });
          console.log("Sign in data:", data);
          console.log("Sign in error:", error);

        }}
      >
        Sign in with Solfare
      </button>
    )}
    {/* {window.phantom.solana &&!claims && (
      <button
        onClick={async () => {
          console.log("Sign in button clicked");

          const { data, error } = await supabase.auth.signInWithWeb3({
            chain: "solana",
            statement: "I confirm that I am signing in to Prediction Market YT",
            wallet: window.phantom.solana,
          });

        }}
      >
        Sign in with Phantom
      </button>
    )} */}

    {claims && (
      <button
        onClick={async () => {
          console.log("Logout clicked");

          await supabase.auth.signOut();
        }}
      >
        LogOut
      </button>
    )}
    <button onClick={async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        console.log("No active session");
        return;
      }

      console.log(session.access_token);
      try {
  const response = await axios.post(
    "http://localhost:3000/buy",
    {},
    {
      headers: {
        Authorization: session.access_token
      }
    }
  );

  console.log("Backend Response:", response.data);
} catch (err) {
  console.error("Axios Error:", err);
}
    }}>Click to Buy</button>

  </div>
);
}
export default App
