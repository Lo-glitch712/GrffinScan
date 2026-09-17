"use client";

import QRCode from "react-qr-code";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "../../components/AppShell";
import { getCurrentEvent } from "../../lib/db";
import { formatStudentName } from "../../lib/studentFormat";

function formatEventTime(event) {
  if (!event?.starts_at && !event?.ends_at) return "";
  const start = event.starts_at ? new Date(event.starts_at) : null;
  const end = event.ends_at ? new Date(event.ends_at) : null;
  const when = start || end;
  const datePart = when.toLocaleDateString([], { month: "short", day: "numeric" });
  const timePart = (date) =>
    date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (start && end) return `${datePart} · ${timePart(start)} – ${timePart(end)}`;
  if (start) return `${datePart} · ${timePart(start)}`;
  return `${datePart} · until ${timePart(end)}`;
}

export default function QRPage() {
  const router = useRouter();
  const [student, setStudent] = useState(null);
  const [event, setEvent] = useState(null);

  useEffect(() => {
    const data = localStorage.getItem("studentInfo");
    if (!data) {
      router.push("/student");
    } else {
      setStudent(JSON.parse(data));
    }
  }, [router]);

  useEffect(() => {
    const loadEvent = async () => {
      try {
        setEvent(await getCurrentEvent());
      } catch (err) {
        console.error(err);
      }
    };
    loadEvent();
    const timer = setInterval(loadEvent, 10000);
    return () => clearInterval(timer);
  }, []);

  if (!student) return null;

  return (
    <AppShell
      title={event?.name || "No event"}
      subtitle={formatEventTime(event)}
      backTo="/student"
    >
      <div className="qr-page">
        <div className="qr-stage">
          <div
            className="secure-qr"
            onContextMenu={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()}
          >
            <QRCode
              value={student.id}
              size={220}
              bgColor="#FFFFFF"
              fgColor="#000000"
            />
            <div className="secure-qr-shield" />
          </div>

          <div className="qr-id">
            <p className="qr-id-name">{formatStudentName(student)}</p>
            <p>{student.id}</p>
            <p>{student.course}{student.yearsection ? ` · ${student.yearsection}` : ""}</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
