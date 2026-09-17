"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
    BarcodeFormat.QR_CODE,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints, 250);
}

function studentLabel(student) {
  if (!student) return "";
  return `${student.lastname}, ${student.firstname}`;
}

export default function ScanPage() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [popupType, setPopupType] = useState(null);
  const [popupMessage, setPopupMessage] = useState("");
  const [scannedStudent, setScannedStudent] = useState(null);
  const [ready, setReady] = useState(false);

  const selectedEventRef = useRef(selectedEvent);
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const scanLockRef = useRef(false);
  const handleScanRef = useRef(null);

  useEffect(() => {
    selectedEventRef.current = selectedEvent;
  }, [selectedEvent]);

  const showResult = (type, message, student = null) => {
    setPopupType(type);
    setPopupMessage(message);
    setScannedStudent(student);
    if (type === "success") {
      try {
        navigator.vibrate?.(180);
      } catch {
        /* ignore */
      }
    }
  };

  const handleScan = async (scannedText) => {
    const eventId = selectedEventRef.current;
    if (!eventId) {
      showResult("error", "Please select an open event first.");
      return;
    }

    try {
      const student = await findStudentByBarcode(scannedText);

      if (!student) {
        showResult("error", `Student ID not found. Scanned: ${String(scannedText || "").trim() || "empty"}`);
        return;
      }

      const existing = await findAttendance(student.id, eventId);

      if (existing) {
        showResult("already", "Already in attendance for this event.", student);
        return;
      }

      await addAttendance(student.id, eventId);
      showResult("success", "Attendance recorded.", student);
    } catch (err) {
      console.error(err);
      showResult("error", err?.message || "Failed to mark attendance.");
    }
  };

  handleScanRef.current = handleScan;

  useEffect(() => {
    const hostInfo = sessionStorage.getItem("hostInfo");
    if (!hostInfo) {
      router.push("/host");
      return;
    }

    let cancelled = false;
    const reader = createBarcodeReader();
    codeReaderRef.current = reader;

    const onDecode = async (result, err) => {
      if (err && err.name !== "NotFoundException") console.error(err);
      if (!result || scanLockRef.current) return;
      scanLockRef.current = true;
      await handleScanRef.current?.(result.getText());
    };

    const startScanner = async () => {
      if (cancelled || !videoRef.current) return;
      try {
        await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoRef.current,
          onDecode
        );
        if (!cancelled) setReady(true);
      } catch (err) {
        console.error(err);
        try {
          await reader.decodeFromVideoDevice(null, videoRef.current, onDecode);
          if (!cancelled) setReady(true);
        } catch (fallbackErr) {
          console.error(fallbackErr);
          if (!cancelled) {
            showResult("error", "Camera could not start. Allow camera access and try again.");
          }
        }
      }
    };

    fetchEvents();
    const startTimer = window.setTimeout(startScanner, 150);

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
      cancelled = true;
      clearTimeout(startTimer);
      reader.reset();
      clearInterval(interval);
    };
  }, [router]);

  const fetchEvents = async () => {
    const openEvents = (await getEvents()).filter((evt) => evt.is_open);
    setEvents(openEvents);
    if (openEvents.length > 0) setSelectedEvent(String(openEvents[0].id));
  };

  const closePopup = () => {
    setPopupType(null);
    setPopupMessage("");
    scanLockRef.current = false;
  };

  const resultClass =
    popupType === "success"
      ? "is-success"
      : popupType === "already"
        ? "is-already"
        : popupType === "error"
          ? "is-error"
          : "is-idle";

  return (
    <AppShell title="Scan Barcode">
      <div className="stack">
        {events.length > 0 ? (
          <Select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            placeholder="Select event"
            options={events.map((evt) => ({
              value: String(evt.id),
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
        <p className="muted scan-hint">
          {ready ? "Align the barcode on the student ID" : "Starting camera..."}
        </p>

        <div className={`scan-result ${resultClass}`}>
          {popupType ? (
            <>
              {popupMessage}
              {scannedStudent ? <strong>{studentLabel(scannedStudent)} · {scannedStudent.id}</strong> : null}
            </>
          ) : (
            "Scan a student ID to record attendance"
          )}
        </div>

        <button className="btn btn-ghost" onClick={() => router.push("/host/dashboard")}>
          Back
        </button>
      </div>

      {popupType && typeof document !== "undefined" && createPortal(
        <div className="overlay" onClick={closePopup}>
          <div className="modal modal-solid confirm-dialog" onClick={(event) => event.stopPropagation()}>
            <h3>{popupMessage}</h3>
            {scannedStudent && (
              <div className="info">
                <p><strong>{studentLabel(scannedStudent)}</strong></p>
                <p className="muted">{scannedStudent.id}</p>
                <p className="muted">{scannedStudent.course} · {scannedStudent.yearsection}</p>
              </div>
            )}
            <button className="btn" onClick={closePopup}>
              OK
            </button>
          </div>
        </div>,
        document.body
      )}
    </AppShell>
  );
}
