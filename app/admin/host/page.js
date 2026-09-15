"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteHost, getHosts, setSession } from "../../lib/db";
import AppShell from "../../components/AppShell";

export default function AdminHostsPage() {
  const router = useRouter();
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const adminInfo = sessionStorage.getItem("adminInfo");
    if (!adminInfo) {
      router.push("/host");
    } else {
      fetchHosts();
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchHosts();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const fetchHosts = async () => {
    setLoading(true);
    const data = getHosts();
    const sortedHosts = [...data].sort((a, b) => {
      const aActive = a.current_session ? 1 : 0;
      const bActive = b.current_session ? 1 : 0;
      return bActive - aActive;
    });
    setHosts(sortedHosts);
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this host?")) return;
    deleteHost(id);
    fetchHosts();
  };

  const forceLogout = async (host) => {
    if (!confirm(`Force logout ${host.username}?`)) return;
    setSession("hosts", host.id, null);
    fetchHosts();
  };

  const isHostActive = (host) => {
    return host.current_session ? true : false;
  };

  return (
    <AppShell title="Hosts">
      <div className="stack">
        {loading ? (
          <p className="muted">Loading hosts...</p>
        ) : hosts.length === 0 ? (
          <p className="muted">No hosts found.</p>
        ) : (
          hosts.map((host) => (
            <div key={host.id} className="card">
              <p><strong>{host.username}</strong></p>
              <p className="muted">{isHostActive(host) ? "Active" : "Offline"}</p>
              <div className="row">
                <button
                  className="btn btn-danger"
                  onClick={() => forceLogout(host)}
                  disabled={!isHostActive(host)}
                >
                  Force Logout
                </button>
                <button className="btn btn-ghost" onClick={() => handleDelete(host.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}

        <button className="btn btn-ghost" onClick={() => router.push("/admin")}>
          Back
        </button>
      </div>
    </AppShell>
  );
}
