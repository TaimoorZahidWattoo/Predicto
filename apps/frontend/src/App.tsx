import { useState, useEffect } from "react";
import { useUser } from "./hooks/useUser";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Market } from "./types";
import { MarketList } from "./components/MarketList";
import { MarketDetail } from "./components/MarketDetail";
import { OrderForm } from "./components/OrderForm";
import { Balance } from "./components/Balance";
import { Positions } from "./components/Positions";
import { OrderHistory } from "./components/OrderHistory";
import { SplitMerge } from "./components/SplitMerge";
import "./App.css";

declare global {
  interface Window {
    solflare?: any;
  }
}

function App() {
  const [supabase] = useState(createClient(
    "https://sgvenstbkiedwlmctkym.supabase.co",
    "sb_publishable_UzrNN841hMRh49RkCtCvbA_5ayRmeRN"
  ));
  return <AppWrapper supabase={supabase} />;
}

function AppWrapper({ supabase }: { supabase: SupabaseClient }) {
  const { claims } = useUser(supabase);
  const [token, setToken] = useState<string>("");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [activeTab, setActiveTab] = useState<string>("markets");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) {
          setToken(session.access_token);
        }
      });
    }
  }, [supabase, claims]);

  useEffect(() => {
    fetchMarkets();
  }, []);

  const fetchMarkets = async () => {
    try {
      const response = await fetch("http://localhost:3000/markets");
      const data = await response.json();
      const nextMarkets = data.markets || [];
      setMarkets(nextMarkets);
      setSelectedMarket((current) => (
        current ? nextMarkets.find((market: Market) => market.id === current.id) || current : current
      ));
    } catch (err) {
      console.error("Failed to fetch markets:", err);
    }
  };

  const handleSignIn = async () => {
    if (window.solflare) {
      await supabase.auth.signInWithWeb3({
        chain: 'solana',
        statement: 'I accept the Terms of Service at https://example.com/tos',
        wallet: window.solflare,
      });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setToken("");
    setSelectedMarket(null);
    setActiveTab("markets");
  };

  const handleSelectMarket = (marketId: string) => {
    const market = markets.find(m => m.id === marketId);
    if (market) {
      setSelectedMarket(market);
      setActiveTab("trading");
    }
  };

  const handleActionComplete = () => {
    setRefreshKey(prev => prev + 1);
    fetchMarkets();
  };

  if (!claims) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <h1>Prediction Market</h1>
          <p>Please sign in to access the market</p>
          {window.solflare && (
            <button onClick={handleSignIn} className="signin-button">
              Sign in with Solflare
            </button>
          )}
          {!window.solflare && (
            <p>Please install Solflare wallet to continue</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Prediction Market</h1>
        <button onClick={handleSignOut} className="logout-button">
          Logout
        </button>
      </header>

      <nav className="app-nav">
        <button
          className={activeTab === "markets" ? "active" : ""}
          onClick={() => {
            setActiveTab("markets");
            setSelectedMarket(null);
          }}
        >
          Markets
        </button>
        <button
          className={activeTab === "trading" ? "active" : ""}
          onClick={() => setActiveTab("trading")}
          disabled={!selectedMarket}
        >
          Trading
        </button>
        <button
          className={activeTab === "balance" ? "active" : ""}
          onClick={() => setActiveTab("balance")}
        >
          Balance
        </button>
        <button
          className={activeTab === "positions" ? "active" : ""}
          onClick={() => setActiveTab("positions")}
        >
          Positions
        </button>
        <button
          className={activeTab === "history" ? "active" : ""}
          onClick={() => setActiveTab("history")}
        >
          History
        </button>
      </nav>

      <main className="app-main">
        {activeTab === "markets" && (
          <MarketList markets={markets} onSelectMarket={handleSelectMarket} />
        )}

        {activeTab === "trading" && selectedMarket && (
          <div className="trading-container">
            <MarketDetail
              market={selectedMarket}
              onBack={() => {
                setActiveTab("markets");
                setSelectedMarket(null);
              }}
            />
            <aside className="trade-sidebar">
              <OrderForm
                market={selectedMarket}
                token={token}
                onOrderPlaced={handleActionComplete}
              />
              <SplitMerge
                market={selectedMarket}
                token={token}
                onActionComplete={handleActionComplete}
              />
            </aside>
          </div>
        )}

        {activeTab === "balance" && <Balance token={token} key={refreshKey} />}

        {activeTab === "positions" && (
          <Positions token={token} markets={markets} key={refreshKey} />
        )}

        {activeTab === "history" && (
          <OrderHistory token={token} markets={markets} key={refreshKey} />
        )}

      </main>
    </div>
  );
}

export default App;
