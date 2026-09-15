"use client";

import QRCode from "react-qr-code";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "../../components/AppShell";

export default function QRPage() {
  const router = useRouter();
  const [student, setStudent] = useState(null);

  useEffect(() => {
    const data = localStorage.getItem("studentInfo");
    if (!data) {
      router.push("/student");
    } else {
      setStudent(JSON.parse(data));
    }
  }, [router]);

  if (!student) return null;

  return (
    <AppShell title="Your QR">
      <div className="stack">
        <div className="secure-qr">
          <QRCode
            value={student.id}
            size={220}
            bgColor="#FFFFFF"
            fgColor="#000000"
          />
          <div className="secure-qr-shield" />
        </div>

        <div className="card info center">
          <p><strong>{student.lastname}, {student.firstname}</strong></p>
          <p className="muted">{student.id}</p>
          <p className="muted">{student.course} · {student.yearsection}</p>
        </div>

        <button className="btn btn-ghost" onClick={() => router.push("/student")}>
          Back
        </button>
      </div>
    </AppShell>
  );
}
