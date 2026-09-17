"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addHost, deleteHost, getHosts, setSession } from "../../lib/db";
import AppShell from "../../components/AppShell";

function HostCard({ host, armed, onArm, onDisarm, onForceLogout, onDelete, isActive }) {
  const pressTimer = useRef(0);
  const pressed = useRef(false);
  const pressStart = useRef({ x: 0, y: 0 });
  const justArmed = useRef(false);

  const startPress = (event) => {
    if (armed) return;
    if (event.target.closest("button")) return;
    pressed.current = true;
    pressStart.current = { x: event.clientX, y: event.clientY };
    window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      if (pressed.current) {
        justArmed.current = true;
        onArm();
      }
    }, 520);
  };

  const movePress = (event) => {
    const dx = event.clientX - pressStart.current.x;
    const dy = event.clientY - pressStart.current.y;
    if (Math.hypot(dx, dy) > 10) cancelPress();
  };

  const cancelPress = () => {
    pressed.current = false;
    window.clearTimeout(pressTimer.current);
  };

  return (
    <div
      className={armed ? "card att-card is-armed" : "card att-card"}
      onPointerDown={startPress}
      onPointerMove={movePress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => {
        if (justArmed.current) {
          justArmed.current = false;
          return;
        }
        if (armed) onDisarm();
      }}
    >
      <p><strong>{host.username}</strong></p>
      <p className="muted">{isActive ? "Active" : "Offline"}</p>
      {armed ? (
        <div className="row">
          <button
            className="btn btn-danger"
            onClick={(event) => {
              event.stopPropagation();
              onForceLogout(host);
            }}
            disabled={!isActive}
          >
            Force Logout
          </button>
          <button
            className="btn btn-ghost"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(host.id);
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminHostsPage() {
  const router = useRouter();
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [armedId, setArmedId] = useState(null);
  const [form, setForm] = useState({ username: "", password: "" });

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
    const data = await getHosts();
    const sortedHosts = [...data].sort((a, b) => {
      const aActive = a.current_session ? 1 : 0;
      const bActive = b.current_session ? 1 : 0;
      return bActive - aActive;
    });
    setHosts(sortedHosts);
    setLoading(false);
  };

  const handleAdd = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await addHost(form.username, form.password);
      setForm({ username: "", password: "" });
      await fetchHosts();
    } catch (err) {
      alert(err?.message || "Could not add host.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this host?")) return;
    await deleteHost(id);
    setArmedId(null);
    fetchHosts();
  };

  const forceLogout = async (host) => {
    if (!confirm(`Force logout ${host.username}?`)) return;
    await setSession("hosts", host.id, null);
    setArmedId(null);
    fetchHosts();
  };

  const isHostActive = (host) => {
    return host.current_session ? true : false;
  };

  return (
    <AppShell title="Hosts" backTo="/admin">
      <div className="stack">
        <form className="card" onSubmit={handleAdd}>
          <h3>Add Host</h3>
          <input
            className="field"
            name="username"
            value={form.username}
            onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
            placeholder="Username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
          />
          <input
            className="field"
            name="password"
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="Password"
            autoComplete="new-password"
          />
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Adding..." : "Add Host"}
          </button>
        </form>

        {loading ? (
          <p className="muted">Loading hosts...</p>
        ) : hosts.length === 0 ? (
          <p className="muted">No hosts found.</p>
        ) : (
          hosts.map((host) => (
            <HostCard
              key={host.id}
              host={host}
              armed={armedId === host.id}
              onArm={() => setArmedId(host.id)}
              onDisarm={() => setArmedId(null)}
              onForceLogout={forceLogout}
              onDelete={handleDelete}
              isActive={isHostActive(host)}
            />
          ))
        )}
      </div>
    </AppShell>
  );
}
