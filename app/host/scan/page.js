"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  addAttendance,
  findAttendance,
  findStudentByBarcode,
  getEvents,
  isHostSessionValid,
} from "../../lib/db";
import { createBarcodeLoopReader, detectBarcodeFromVideo } from "../../lib/readBarcode";
import AppShell from "../../components/AppShell";
import Select from "../../components/Select";
import { formatStudentName } from "../../lib/studentFormat";

function ScanPage() {
  const router = useRouter();
  const scanMode = "barcode";
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [popupType, setPopupType] = useState(null);
  const [popupMessage, setPopupMessage] = useState("");
  const [scannedStudent, setScannedStudent] = useState(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);

  const selectedEventRef = useRef(selectedEvent);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scanLockRef = useRef(true);
  const handleScanRef = useRef(null);

  useEffect(() => {
    selectedEventRef.current = selectedEvent;
  }, [selectedEvent]);

  const showResult = (type, message, student = null) => {
    setPopupType(type);
    setPopupMessage(message);
    setScannedStudent(student);
    if (type === "success" || type === "already") {
      try {
        navigator.vibrate?.(type === "success" ? 180 : 80);
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
        showResult(
          "error",
          `Student ID not found. Scanned: ${String(scannedText || "").trim() || "empty"}`
        );
        return;
      }

      const existing = await findAttendance(student.id, eventId);

      if (existing) {
        showResult("already", "Already in attendance for this event.", student);
        return;
      }

      showResult("confirm", "Is this Student ID correct?", student);
    } catch (err) {
      console.error(err);
      showResult("error", err?.message || "Failed to read barcode.");
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
    let timer = 0;
    let stream;
    const reader = createBarcodeLoopReader(scanMode);

    const tick = async () => {
      if (cancelled || scanLockRef.current) return;
      const text = await detectBarcodeFromVideo(
        videoRef.current,
        canvasRef.current,
        reader,
        scanMode
      );
      if (!text || cancelled || scanLockRef.current) return;
      scanLockRef.current = true;
      await handleScanRef.current?.(text);
    };

    const startCamera = async () => {
      if (!videoRef.current) return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.muted = true;
        await video.play();
        if (!cancelled) {
          setReady(true);
          timer = window.setInterval(() => {
            void tick();
          }, 180);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          showResult("error", "Camera could not start. Allow camera access and try again.");
        }
      }
    };

    fetchEvents();
    const startTimer = window.setTimeout(startCamera, 80);

    const sessionTimer = setInterval(() => {
      void (async () => {
        const session = JSON.parse(sessionStorage.getItem("hostInfo"));
        if (!session?.id) {
          clearInterval(sessionTimer);
          router.push("/host");
          return;
        }
        if (!(await isHostSessionValid(session))) {
          sessionStorage.removeItem("hostInfo");
          clearInterval(sessionTimer);
          alert("You have been logged out by the admin.");
          router.push("/host");
        }
      })();
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      clearInterval(timer);
      clearInterval(sessionTimer);
      stream?.getTracks?.().forEach((track) => track.stop());
    };
  }, [router, scanMode]);

  const fetchEvents = async () => {
    const openEvents = (await getEvents()).filter((evt) => evt.is_open);
    setEvents(openEvents);
    if (openEvents.length > 0) setSelectedEvent(String(openEvents[0].id));
  };

  const closePopup = () => {
    setPopupType(null);
    setPopupMessage("");
    setSaving(false);
    if (!showTutorial) scanLockRef.current = false;
  };

  const dismissTutorial = () => {
    setShowTutorial(false);
    scanLockRef.current = false;
  };

  const confirmAttendance = async () => {
    const eventId = selectedEventRef.current;
    if (!scannedStudent || !eventId || saving) return;

    setSaving(true);
    try {
      const existing = await findAttendance(scannedStudent.id, eventId);
      if (existing) {
        showResult("already", "Already in attendance for this event.", scannedStudent);
        return;
      }
      await addAttendance(scannedStudent.id, eventId);
      showResult("success", "Attendance recorded.", scannedStudent);
    } catch (err) {
      console.error(err);
      showResult("error", err?.message || "Failed to mark attendance.");
    } finally {
      setSaving(false);
    }
  };

  const resultClass =
    popupType === "success"
      ? "is-success"
      : popupType === "already" || popupType === "confirm"
        ? "is-already"
        : popupType === "error"
          ? "is-error"
          : "is-idle";

  return (
    <AppShell title="Scan Barcode" backTo="/host/dashboard">
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
          <canvas ref={canvasRef} className="scan-canvas" />
        </div>
        <p className="muted scan-hint">
          {ready ? "Fill the gold box with the barcode on the ID" : "Starting camera..."}
        </p>

        <div className={`scan-result ${resultClass}`}>
          {popupType ? (
            <>
              {popupMessage}
              {scannedStudent ? (
                <strong>
                  {formatStudentName(scannedStudent)}
                  <span className="scan-result-id">{scannedStudent.id}</span>
                </strong>
              ) : null}
            </>
          ) : (
            "Scan a student ID to record attendance"
          )}
        </div>
      </div>

      {showTutorial && typeof document !== "undefined" && createPortal(
        <div className="overlay">
          <div className="modal modal-solid confirm-dialog tutorial-dialog" onClick={(event) => event.stopPropagation()}>
            <h3>How to scan</h3>
            <ol className="tutorial-steps">
              <li>Scan carefully. Keep the ID still and fill the gold box with the barcode.</li>
              <li>If the ID does not scan, take it out of its case.</li>
              <li>Use a clear, HD camera for the scanner.</li>
            </ol>
            <button className="btn" onClick={dismissTutorial}>
              Got it
            </button>
          </div>
        </div>,
        document.body
      )}

      {popupType && !showTutorial && typeof document !== "undefined" && createPortal(
        <div className="overlay" onClick={closePopup}>
          <div className="modal modal-solid confirm-dialog" onClick={(event) => event.stopPropagation()}>
            <h3>{popupMessage}</h3>
            {scannedStudent && (
              <div className="info scan-student">
                <p className="muted">Name</p>
                <p className="scan-name">{formatStudentName(scannedStudent)}</p>
                <p className="muted">Student Number</p>
                <p className="scan-id">{scannedStudent.id}</p>
                <p className="muted">
                  {scannedStudent.course}
                  {scannedStudent.yearsection ? ` · ${scannedStudent.yearsection}` : ""}
                </p>
              </div>
            )}
            {popupType === "confirm" ? (
              <div className="confirm-actions">
                <button className="btn btn-ghost" onClick={closePopup} disabled={saving}>
                  No
                </button>
                <button className="btn" onClick={confirmAttendance} disabled={saving}>
                  {saving ? "Saving..." : "Yes, confirm"}
                </button>
              </div>
            ) : (
              <button className="btn" onClick={closePopup}>
                OK
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </AppShell>
  );
}

export default ScanPage;
