"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { findStudentById, saveStudent } from "../lib/db";
import AppShell from "../components/AppShell";
import Select from "../components/Select";

export default function StudentPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    id: "",
    lastname: "",
    firstname: "",
    course: "",
    yearSection: ""
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleLogin = async () => {
    let { id, lastname, firstname, course, yearSection } = formData;

    if (!id || !lastname || !firstname || !course || !yearSection) {
      alert("Please complete all fields");
      return;
    }

    id = id.trim();
    lastname = lastname.trim();
    firstname = firstname.trim();

    try {
      const existingStudentById = await findStudentById(id);

      if (existingStudentById) {
        if (
          existingStudentById.lastname !== lastname ||
          existingStudentById.firstname !== firstname ||
          existingStudentById.course !== course ||
          existingStudentById.yearsection !== yearSection
        ) {
          alert(
            "Student ID already exists but the provided details do not match the existing record."
          );
          return;
        }

        setStudentLocal(existingStudentById);
        return;
      }

      const inserted = await saveStudent({
        id,
        lastname,
        firstname,
        course,
        yearsection: yearSection
      });
      setStudentLocal(inserted);
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to save student.");
    }
  };

  const setStudentLocal = (studentRecord) => {
    const studentData = {
      id: studentRecord.id,
      firstname: studentRecord.firstname,
      lastname: studentRecord.lastname,
      course: studentRecord.course,
      yearsection: studentRecord.yearsection
    };

    localStorage.setItem("studentInfo", JSON.stringify(studentData));
    router.push("/student/qr");
  };

  return (
    <AppShell title="Student">
      <div className="stack">
        <input
          className="field"
          type="text"
          name="id"
          placeholder="Student ID"
          value={formData.id}
          onChange={handleChange}
        />
        <input
          className="field"
          type="text"
          name="lastname"
          placeholder="Last Name"
          value={formData.lastname}
          onChange={handleChange}
        />
        <input
          className="field"
          type="text"
          name="firstname"
          placeholder="First Name"
          value={formData.firstname}
          onChange={handleChange}
        />
        <Select
          name="course"
          value={formData.course}
          onChange={handleChange}
          placeholder="Select Course"
          options={[
            { value: "BSCE", label: "BSCE" },
            { value: "BSSE", label: "BSSE" },
            { value: "BSCS", label: "BSCS" },
            { value: "BSIT", label: "BSIT" },
            { value: "BAT", label: "BAT" },
            { value: "RAC", label: "RAC" },
            { value: "EET", label: "EET" },
            { value: "BET-MET-AUTO", label: "BET-MET-AUTO" },
            { value: "BSMATH", label: "BSMATH" },
          ]}
        />
        <Select
          name="yearSection"
          value={formData.yearSection}
          onChange={handleChange}
          placeholder="Select Year & Section"
          options={[
            "1A","1B","1C","1D","1E",
            "2A","2B","2C","2D","2E",
            "3A","3B","3C","3D","3E",
            "4A","4B","4C","4D","4E"
          ].map((ys) => ({ value: ys, label: ys }))}
        />
        <button className="btn" onClick={handleLogin}>
          Login
        </button>
        <button className="btn btn-ghost" onClick={() => router.push("/")}>
          Back
        </button>
      </div>
    </AppShell>
  );
}
