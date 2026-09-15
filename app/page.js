"use client";

import { useRouter } from "next/navigation";
import AppShell from "./components/AppShell";

export default function Home() {
  const router = useRouter();

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
