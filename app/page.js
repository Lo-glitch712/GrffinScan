"use client";

import { useEffect } from "react";
import Link from "next/link";
import AppShell from "./components/AppShell";
import { ensureDefaultAccounts } from "./lib/db";

export default function Home() {
  useEffect(() => {
    ensureDefaultAccounts().catch((err) => console.error(err));
  }, []);

  return (
    <AppShell home>
      <div className="home-hero">
        <img src="/griffin.png" alt="" className="griffin" />
      </div>
      <div className="stack">
        <Link href="/host" className="btn">
          Host
        </Link>
      </div>
    </AppShell>
  );
}
