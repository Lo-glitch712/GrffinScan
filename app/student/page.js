"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "../components/AppShell";
import { loginStudent } from "../lib/db";

export default function StudentPage() {
  const router = useRouter();
  const [form, setForm] = useState({ id: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    if (!form.id.trim() || !form.password) {
      alert("Enter your Student ID and password.");
      return;
    }

    setLoading(true);
    try {
      const student = await loginStudent(form.id, form.password);
      if (!student) {
        alert("Invalid Student ID or password.");
        return;
      }

      localStorage.setItem("studentInfo", JSON.stringify(student));
      router.push("/student/qr");
    } catch (err) {
      console.error(err);
      alert(err.message || "Login failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="Student" backTo="/">
      <form className="card stack" onSubmit={handleLogin}>
        <label className="field-label">Student ID</label>
        <input
          className="field"
          name="id"
          value={form.id}
          onChange={handleChange}
          placeholder="Student ID"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <label className="field-label">Password</label>
        <input
          className="field"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Password"
          autoComplete="current-password"
        />
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
        <p className="auth-note">
          Not registered in GriffinScan yet?{" "}
          <button type="button" onClick={() => router.push("/student/register")}>
            Create account
          </button>
        </p>
        <button className="btn btn-ghost" type="button" onClick={() => router.push("/")}>
          Back
        </button>
      </form>
    </AppShell>
  );
}
