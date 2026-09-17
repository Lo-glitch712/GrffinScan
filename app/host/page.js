"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSessionToken, ensureDefaultAccounts, findAccount, setSession } from "../lib/db";
import AppShell from "../components/AppShell";

export default function HostLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    ensureDefaultAccounts().catch((err) => console.error(err));
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const match = await findAccount(username, password);

      if (match?.type === "admin") {
        const sessionToken = createSessionToken();
        await setSession("admins", match.account.id, sessionToken);
        sessionStorage.setItem(
          "adminInfo",
          JSON.stringify({
            id: match.account.id,
            username: match.account.username,
            current_session: sessionToken,
          })
        );
        router.push("/admin");
        return;
      }

      if (match?.type === "host") {
        const hostSessionToken = createSessionToken();
        await setSession("hosts", match.account.id, hostSessionToken);
        sessionStorage.setItem(
          "hostInfo",
          JSON.stringify({
            id: match.account.id,
            username: match.account.username,
            current_session: hostSessionToken,
          })
        );
        router.push("/host/dashboard");
        return;
      }

      alert("Invalid username or password");
    } catch (err) {
      console.error(err);
      alert(err?.message || "Login failed");
    }

    setLoading(false);
  };

  return (
    <AppShell title="Host">
      <form className="stack" onSubmit={handleLogin}>
        <input
          className="field"
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          required
        />
        <input
          className="field"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => router.push("/")}>
          Back
        </button>
      </form>
    </AppShell>
  );
}
