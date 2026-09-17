"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "../../components/AppShell";
import Select from "../../components/Select";
import { registerStudent } from "../../lib/db";

const COURSE_OPTIONS = [
  { value: "BSIT", label: "BSIT" },
  { value: "BSCS", label: "BSCS" },
  { value: "BSIS", label: "BSIS" },
];

const YEAR_OPTIONS = [
  { value: "1A", label: "1A" },
  { value: "1B", label: "1B" },
  { value: "2A", label: "2A" },
  { value: "2B", label: "2B" },
  { value: "3A", label: "3A" },
  { value: "3B", label: "3B" },
  { value: "4A", label: "4A" },
  { value: "4B", label: "4B" },
];

export default function RegisterStudentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    id: "",
    lastname: "",
    firstname: "",
    course: "",
    yearSection: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    const {
      id,
      lastname,
      firstname,
      course,
      yearSection,
      password,
      confirmPassword,
    } = form;

    if (
      !id.trim() ||
      !lastname.trim() ||
      !firstname.trim() ||
      !course ||
      !yearSection ||
      !password
    ) {
      alert("Please complete all fields.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const student = await registerStudent({
        id: id.trim(),
        lastname: lastname.trim(),
        firstname: firstname.trim(),
        course,
        yearsection: yearSection,
        password,
      });

      if (!student) {
        alert("Student ID is already registered. Log in instead.");
        return;
      }

      localStorage.setItem("studentInfo", JSON.stringify(student));
      router.push("/student/qr");
    } catch (err) {
      console.error(err);
      alert(err.message || "Could not create account. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="Register Student" backTo="/student">
      <form className="card stack" onSubmit={handleRegister}>
        <label className="field-label">Student ID</label>
        <input
          className="field"
          name="id"
          value={form.id}
          onChange={handleChange}
          placeholder="Student ID"
          autoComplete="username"
        />
        <label className="field-label">Last Name</label>
        <input
          className="field"
          name="lastname"
          value={form.lastname}
          onChange={handleChange}
          placeholder="Last name"
        />
        <label className="field-label">First Name</label>
        <input
          className="field"
          name="firstname"
          value={form.firstname}
          onChange={handleChange}
          placeholder="First name"
        />
        <label className="field-label">Course</label>
        <Select
          name="course"
          value={form.course}
          onChange={handleChange}
          placeholder="Select Course"
          options={COURSE_OPTIONS}
        />
        <label className="field-label">Year & Section</label>
        <Select
          name="yearSection"
          value={form.yearSection}
          onChange={handleChange}
          placeholder="Select Year & Section"
          options={YEAR_OPTIONS}
        />
        <label className="field-label">Password</label>
        <input
          className="field"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Password"
          autoComplete="new-password"
        />
        <label className="field-label">Confirm Password</label>
        <input
          className="field"
          name="confirmPassword"
          type="password"
          value={form.confirmPassword}
          onChange={handleChange}
          placeholder="Confirm password"
          autoComplete="new-password"
        />
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </button>
        <p className="auth-note">
          Are you already registered in GriffinScan?{" "}
          <button type="button" onClick={() => router.push("/student")}>
            Log in
          </button>
        </p>
        <button className="btn btn-ghost" type="button" onClick={() => router.push("/student")}>
          Back
        </button>
      </form>
    </AppShell>
  );
}
