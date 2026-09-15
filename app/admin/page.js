"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { setSession } from "../lib/db";
import AppShell from "../components/AppShell";

export default function AdminPage() {
  const router = useRouter();
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    const adminInfo = sessionStorage.getItem("adminInfo");
    if (!adminInfo) {
      router.push("/host");
    }
  }, [router]);

  const logout = () => {
    try {
      const adminInfo = JSON.parse(sessionStorage.getItem("adminInfo"));
      if (adminInfo?.id) setSession("admins", adminInfo.id, null);
    } catch {
      /* ignore */
    }
    sessionStorage.removeItem("adminInfo");
    router.push("/host");
  };

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
        <button className="btn btn-ghost" onClick={() => setConfirmLogout(true)}>
          Logout
        </button>
      </div>

      {confirmLogout && createPortal(
        <div className="overlay" onClick={() => setConfirmLogout(false)}>
          <div className="modal modal-solid confirm-dialog" onClick={(event) => event.stopPropagation()}>
            <h3>Are you sure you want to logout?</h3>
            <div className="confirm-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmLogout(false)}>
                Cancel
              </button>
              <button className="btn" onClick={logout}>
                Logout
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </AppShell>
  );
}
