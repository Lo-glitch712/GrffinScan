"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { isHostSessionValid, setSession } from "../../lib/db";
import AppShell from "../../components/AppShell";

export default function HostDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    const verifyHost = async () => {
      const hostInfo = JSON.parse(sessionStorage.getItem("hostInfo"));

      if (!hostInfo?.id) {
        router.push("/host");
        return;
      }

      setLoading(false);
    };

    verifyHost();

    const interval = setInterval(() => {
      const hostInfo = JSON.parse(sessionStorage.getItem("hostInfo"));
      if (!hostInfo?.id) {
        clearInterval(interval);
        router.push("/host");
        return;
      }

      if (!(await isHostSessionValid(hostInfo))) {
        sessionStorage.removeItem("hostInfo");
        clearInterval(interval);
        alert("You have been logged out by the admin.");
        router.push("/host");
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [router]);

  const handleLogout = async () => {
    const hostInfo = JSON.parse(sessionStorage.getItem("hostInfo"));

    if (hostInfo?.id) {
      await setSession("hosts", hostInfo.id, null);
    }

    sessionStorage.removeItem("hostInfo");
    router.push("/host");
  };

  if (loading) {
    return (
      <AppShell title="Host">
        <p className="muted">Loading...</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Host">
      <div className="stack">
        <p className="lede">Scan students or review attendance.</p>
        <button className="btn" onClick={() => router.push("/host/scan")}>
          Scan QR Code
        </button>
        <button className="btn" onClick={() => router.push("/host/attendance")}>
          Attendance
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
              <button className="btn" onClick={handleLogout}>
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
