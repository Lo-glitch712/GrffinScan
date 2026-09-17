"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell from "./components/AppShell";
import { ensureDefaultAccounts } from "./lib/db";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    ensureDefaultAccounts().catch((err) => console.error(err));
  }, []);

  return (
    <AppShell home>
      <div className="home-hero">
        <img src="/griffin.png" alt="" className="griffin" />
      </div>
      <div className="stack">
        <button className="btn" onClick={() => router.push("/student")}>
          Student
        </button>
        <button className="btn btn-white" onClick={() => router.push("/host")}>
          Host
        </button>
      </div>
    </AppShell>
  );
}
