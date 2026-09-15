"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell from "../components/AppShell";

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    const adminInfo = sessionStorage.getItem("adminInfo");
    if (!adminInfo) {
      router.push("/host");
    }
  }, [router]);

  return (
    <AppShell title="Admin">
      <div className="stack">
        <p className="lede">Manage events, people, and records.</p>
        <button className="btn" onClick={() => router.push("/admin/events")}>
          Events
        </button>
        <button className="btn" onClick={() => router.push("/admin/attendance")}>
          Attendance
        </button>
        <button className="btn" onClick={() => router.push("/admin/host")}>
          Hosts
        </button>
        <button className="btn" onClick={() => router.push("/admin/students")}>
          Students
        </button>
        <button className="btn btn-ghost" onClick={() => router.push("/host")}>
          Back
        </button>
      </div>
    </AppShell>
  );
}
