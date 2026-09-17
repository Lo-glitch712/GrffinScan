"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarcodeFormat,
  BrowserMultiFormatReader,
  DecodeHintType,
} from "@zxing/library";
import {
  addAttendance,
  findAttendance,
  findStudentByBarcode,
  getEvents,
  isHostSessionValid,
} from "../../lib/db";
import AppShell from "../../components/AppShell";
import Select from "../../components/Select";

function createBarcodeReader() {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
    BarcodeFormat.ITF,
    BarcodeFormat.CODABAR,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints, 300);
}

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
    codeReaderRef.current = createBarcodeReader();
    const startTimer = setTimeout(() => {
      startScanner();
    }, 0);

    const interval = setInterval(() => {
      void (async () => {
        const session = JSON.parse(sessionStorage.getItem("hostInfo"));
        if (!session?.id) {
          clearInterval(interval);
          router.push("/host");
          return;
        }

        if (!(await isHostSessionValid(session))) {
          sessionStorage.removeItem("hostInfo");
          clearInterval(interval);
          alert("You have been logged out by the admin.");
          router.push("/host");
        }
      })();
    }, 5000);

    return () => {
      clearTimeout(startTimer);
      if (codeReaderRef.current) codeReaderRef.current.reset();
      clearInterval(interval);
    };
  }, [router]);

  const fetchEvents = async () => {
    const openEvents = (await getEvents()).filter((evt) => evt.is_open);
    setEvents(openEvents);
    if (openEvents.length > 0) setSelectedEvent(openEvents[0].id);
  };

  const startScanner = async () => {
    if (!videoRef.current || !codeReaderRef.current) return;

    try {
      await codeReaderRef.current.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        async (result, err) => {
          if (err && err.name !== "NotFoundException") console.error(err);
          if (result && !scanLockRef.current) {
            scanLockRef.current = true;
            await handleScan(result.getText());
          }
        }
      );
    } catch (err) {
      console.error(err);
      showPopup("error", "Camera could not start. Allow camera access and try again.");
    }
  };

  const handleScan = async (scannedText) => {
    const eventId = selectedEventRef.current;
    if (!eventId) {
      showPopup("error", "Please select an open event first.");
      scanLockRef.current = false;
      return false;
    }

    try {
      const student = await findStudentByBarcode(scannedText);

      if (!student) {
        showPopup("error", "Student ID not found in GriffinScan.");
        scanLockRef.current = false;
        return false;
      }

      const existing = await findAttendance(student.id, eventId);

      if (existing) {
        setScannedStudent(student);
        showPopup("already", "Student already attended this event.");
        scanLockRef.current = false;
        return false;
      }

      await addAttendance(student.id, eventId);

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
    <AppShell title="Scan Barcode">
      <div className="stack">
        {events.length > 0 ? (
          <Select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            placeholder="Select event"
            options={events.map((evt) => ({
              value: evt.id,
              label: evt.starts_at
                ? `${evt.name} · ${new Date(evt.starts_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                : evt.name,
            }))}
          />
        ) : (
          <p className="muted">No open events available.</p>
        )}

        <div className="scan-stage">
          <video
            ref={videoRef}
            className="scan-video"
            muted
            playsInline
            autoPlay
          />
          <div className="scan-overlay" aria-hidden="true">
            <div className="scan-window" />
          </div>
        </div>
        <p className="muted scan-hint">Align the barcode on the student ID</p>

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
                <p className="muted">{scannedStudent.id}</p>
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
