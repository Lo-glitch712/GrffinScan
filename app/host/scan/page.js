"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrowserMultiFormatReader } from "@zxing/library";
import {
  addAttendance,
  findAttendance,
  findStudentById,
  getEvents,
  isHostSessionValid,
} from "../../lib/db";
import AppShell from "../../components/AppShell";
import Select from "../../components/Select";

export default function ScanPage() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [popupType, setPopupType] = useState(null);
  const [popupMessage, setPopupMessage] = useState("");
  const [scannedStudent, setScannedStudent] = useState(null);

  const selectedEventRef = useRef(selectedEvent);
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const scanLockRef = useRef(false);

  useEffect(() => {
    selectedEventRef.current = selectedEvent;
  }, [selectedEvent]);

  useEffect(() => {
    const hostInfo = sessionStorage.getItem("hostInfo");
    if (!hostInfo) {
      router.push("/host");
      return;
    }

    fetchEvents();
    codeReaderRef.current = new BrowserMultiFormatReader();
    startScanner();

    const interval = setInterval(() => {
      const hostInfo = JSON.parse(sessionStorage.getItem("hostInfo"));
      if (!hostInfo?.id) {
        clearInterval(interval);
        router.push("/host");
        return;
      }

      if (!isHostSessionValid(hostInfo)) {
        sessionStorage.removeItem("hostInfo");
        clearInterval(interval);
        alert("You have been logged out by the admin.");
        router.push("/host");
      }
    }, 5000);

    return () => {
      if (codeReaderRef.current) codeReaderRef.current.reset();
      clearInterval(interval);
    };
  }, [router]);

  const fetchEvents = async () => {
    const openEvents = getEvents().filter((evt) => evt.is_open);
    setEvents(openEvents);
    if (openEvents.length > 0) setSelectedEvent(openEvents[0].id);
  };

  const startScanner = async () => {
    if (!videoRef.current) return;

    await codeReaderRef.current.decodeFromVideoDevice(
      null,
      videoRef.current,
      async (result, err) => {
        if (err && err.name !== "NotFoundException") console.error(err);
        if (result && !scanLockRef.current) {
          scanLockRef.current = true;
          await handleScan(result.getText());
        }
      }
    );
  };

  const handleScan = async (scannedText) => {
    const eventId = selectedEventRef.current;
    if (!eventId) {
      showPopup("error", "Please select an open event first.");
      scanLockRef.current = false;
      return false;
    }

    let studentId = scannedText?.trim();

    if (studentId.startsWith("{") && studentId.endsWith("}")) {
      try {
        const data = JSON.parse(studentId);
        studentId = data.id?.trim();
      } catch {
        // Invalid JSON, continue with the plain text
      }
    }

    if (!studentId) {
      showPopup("error", "Invalid QR Code format.");
      scanLockRef.current = false;
      return false;
    }

    try {
      const student = findStudentById(studentId);

      if (!student) {
        showPopup("error", "Student not found.");
        scanLockRef.current = false;
        return false;
      }

      const existing = findAttendance(studentId, eventId);

      if (existing) {
        setScannedStudent(student);
        showPopup("already", "Student already attended this event.");
        scanLockRef.current = false;
        return false;
      }

      addAttendance(studentId, eventId);

      setScannedStudent(student);
      showPopup("success", "Attendance successfully recorded.");
      scanLockRef.current = false;
      return true;
    } catch (err) {
      console.error(err);
      showPopup("error", "Failed to mark attendance.");
      scanLockRef.current = false;
      return false;
    }
  };

  const showPopup = (type, message) => {
    setPopupType(type);
    setPopupMessage(message);
  };

  const closePopup = () => {
    setPopupType(null);
    setPopupMessage("");
    setScannedStudent(null);
    scanLockRef.current = false;
  };

  return (
    <AppShell title="Scan">
      <div className="stack">
        {events.length > 0 ? (
          <Select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            placeholder="Select event"
            options={events.map((evt) => ({ value: evt.id, label: evt.name }))}
          />
        ) : (
          <p className="muted">No open events available.</p>
        )}

        <video ref={videoRef} className="scan-video" />

        <button className="btn btn-ghost" onClick={() => router.push("/host/dashboard")}>
          Back
        </button>
      </div>

      {popupType && (
        <div className="overlay" onClick={closePopup}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{popupMessage}</h2>
            {scannedStudent && (
              <div className="info">
                <p><strong>{scannedStudent.lastname}, {scannedStudent.firstname}</strong></p>
                <p className="muted">{scannedStudent.course} · {scannedStudent.yearsection}</p>
              </div>
            )}
            <p className="muted">Tap anywhere to close</p>
          </div>
        </div>
      )}
    </AppShell>
  );
}
