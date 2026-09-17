"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  clearAllAttendance,
  deleteStudent as removeStudent,
  getAttendanceView,
  studentAttendedEvent,
} from "../../lib/db";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import AppShell from "../../components/AppShell";
import AttendanceSummary from "../../components/AttendanceSummary";
import Select from "../../components/Select";
import { formatStudentName } from "../../lib/studentFormat";

const PAGE_SIZE = 50;
const DOWNLOAD_LIMIT = 100;
const GROUP_OPTIONS = [
  { value: "all", label: "All" },
  { value: "day", label: "By day" },
  { value: "week", label: "By week" },
  { value: "month", label: "By month" },
];

export default function AttendancePage() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [records, setRecords] = useState([]);
  const [groups, setGroups] = useState(null);
  const [stats, setStats] = useState({ total: 0, programs: [] });
  const [hasMore, setHasMore] = useState(false);
  const [courses, setCourses] = useState([]);
  const [yearSections, setYearSections] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ course: "", yearSection: "", search: "", groupBy: "all" });
  const [armedId, setArmedId] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const pressTimer = useRef(0);
  const pressedId = useRef(null);
  const pressStart = useRef({ x: 0, y: 0 });
  const justArmed = useRef(false);

  useEffect(() => {
    fetchAttendance();
  }, [filter, page]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const grouped = filter.groupBy !== "all";
      const view = await getAttendanceView({
        course: filter.course,
        yearSection: filter.yearSection,
        search: filter.search,
        groupBy: filter.groupBy,
        page: grouped ? 0 : page,
        pageSize: grouped ? undefined : PAGE_SIZE,
      });
      setEvents(view.events);
      setStats(view.stats);
      setGroups(view.groups);
      setRecords(view.records);
      setHasMore(view.hasMore);
      setCourses(view.courses || []);
      setYearSections(view.yearSections || []);
    } catch (err) {
      console.error("Fetch error:", err);
    }
    setLoading(false);
  };

  const deleteStudent = async (studentId) => {
    if (!confirm("Are you sure you want to delete this student?")) return;
    await removeStudent(studentId);
    setArmedId(null);
    fetchAttendance();
  };

  const removeAllAttendance = async () => {
    await clearAllAttendance();
    setConfirmClear(false);
    setArmedId(null);
    fetchAttendance();
  };

  const startPress = (studentId, event) => {
    if (armedId === studentId) return;
    pressedId.current = studentId;
    pressStart.current = { x: event.clientX, y: event.clientY };
    window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      if (pressedId.current === studentId) {
        justArmed.current = true;
        setArmedId(studentId);
      }
    }, 520);
  };

  const movePress = (event) => {
    const dx = event.clientX - pressStart.current.x;
    const dy = event.clientY - pressStart.current.y;
    if (Math.hypot(dx, dy) > 10) cancelPress();
  };

  const cancelPress = () => {
    pressedId.current = null;
    window.clearTimeout(pressTimer.current);
  };

  const fetchViewForDownload = async () => {
    try {
      return await getAttendanceView({
        course: filter.course,
        yearSection: filter.yearSection,
        search: filter.search,
        groupBy: filter.groupBy,
        limit: filter.groupBy === "all" ? DOWNLOAD_LIMIT : undefined,
      });
    } catch (err) {
      console.error("Download fetch error:", err);
      return null;
    }
  };

  const addTable = (doc, eventsList, students, startY) => {
    autoTable(doc, {
      head: [[
        "Last Name",
        "First Name",
        "Course",
        "YearSection",
        ...eventsList.map((evt) => evt.name),
      ]],
      body: students.map((student) => [
        student.lastname,
        student.firstname,
        student.course,
        student.yearsection,
        ...eventsList.map((evt) => studentAttendedEvent(student, evt.id) ? "Attended" : ""),
      ]),
      startY,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [196, 160, 53] },
      margin: { left: 20, right: 20 },
      tableWidth: "auto",
    });
  };

  const downloadPDF = async () => {
    const view = await fetchViewForDownload();
    const exportGroups = view?.groups;
    const exportRecords = view?.records || [];
    if (!view || (!exportGroups?.length && !exportRecords.length)) {
      alert("No records to export.");
      return;
    }

    const doc = new jsPDF("l", "pt", "a4");
    const eventsList = view.events || events;
    const groupLabel = GROUP_OPTIONS.find((option) => option.value === filter.groupBy)?.label || "All";
    doc.setFontSize(14);
    doc.text(`Attendance · ${groupLabel} · ${view.stats.total} students`, 40, 40);
    const programLine = view.stats.programs.map((program) => `${program.name} ${program.count}`).join("  ·  ");
    if (programLine) {
      doc.setFontSize(10);
      doc.text(programLine, 40, 58);
    }

    if (exportGroups?.length) {
      exportGroups.forEach((group, index) => {
        if (index > 0) doc.addPage();
        const top = index === 0 ? 80 : 40;
        doc.setFontSize(12);
        doc.text(`${group.label} — ${group.total} students`, 40, top);
        addTable(doc, eventsList, group.students, top + 16);
      });
    } else {
      addTable(doc, eventsList, exportRecords, programLine ? 76 : 60);
    }

    const coursePart = filter.course ? filter.course.replace(/\s+/g, "_") : "AllCourses";
    const yearSectionPart = filter.yearSection ? filter.yearSection.replace(/\s+/g, "_") : "AllYearSections";
    const fileName = `Attendance_${filter.groupBy}_${coursePart}_${yearSectionPart}.pdf`;

    doc.save(fileName);
  };

  const renderStudent = (student) => (
    <div
      key={student.id}
      className={armedId === student.id ? "card att-card is-armed" : "card att-card"}
      onPointerDown={(event) => startPress(student.id, event)}
      onPointerMove={movePress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => {
        if (justArmed.current) {
          justArmed.current = false;
          return;
        }
        if (armedId) setArmedId(null);
      }}
    >
      <div>
        <strong>{formatStudentName(student)}</strong>
        <p className="muted">{student.course} · {student.yearsection}</p>
      </div>
      <div className="row">
        {events.map((evt) => {
          const attended = studentAttendedEvent(student, evt.id);
          if (!attended) return null;
          return (
            <span
              key={evt.id}
              className="badge is-on"
            >
              {evt.name}
            </span>
          );
        })}
      </div>
      {armedId === student.id && (
        <button
          className="btn btn-sm btn-danger"
          onClick={(event) => {
            event.stopPropagation();
            deleteStudent(student.id);
          }}
        >
          Delete
        </button>
      )}
    </div>
  );

  const empty = filter.groupBy === "all" ? records.length === 0 : !groups?.length;

  return (
    <AppShell
      title="Attendance"
      wide
      backTo="/admin"
      footer={
        <div className="bottom-bar">
          <button className="btn" onClick={downloadPDF}>
            Download PDF
          </button>
        </div>
      }
    >
      <div className="stack-wide">
        <Select
          value={filter.groupBy}
          onChange={(e) => { setPage(0); setFilter({ ...filter, groupBy: e.target.value }); }}
          placeholder="Sort by"
          options={GROUP_OPTIONS}
        />

        <div className="row">
          <Select
            value={filter.course}
            onChange={(e) => { setPage(0); setFilter({ ...filter, course: e.target.value, yearSection: "" }); }}
            placeholder="Courses"
            options={[
              { value: "", label: "Courses" },
              ...courses.map((c) => ({ value: c, label: c })),
            ]}
          />
          <Select
            value={filter.yearSection}
            onChange={(e) => { setPage(0); setFilter({ ...filter, yearSection: e.target.value }); }}
            placeholder="Year & Section"
            options={[
              { value: "", label: "Year & Section" },
              ...yearSections.map((ys) => ({ value: ys, label: ys })),
            ]}
          />
        </div>

        <div className="search-row">
          <input
            className="field"
            type="search"
            placeholder="Search"
            value={filter.search}
            onChange={(e) => {
              setPage(0);
              setFilter({ ...filter, search: e.target.value });
            }}
          />
          <button
            type="button"
            className="icon-btn"
            aria-label="Remove all attendance"
            onClick={() => setConfirmClear(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 7h14M10 6V4.8A1.8 1.8 0 0 1 11.8 3h.4A1.8 1.8 0 0 1 14 4.8V6M8 7l.8 13h6.4L16 7" fill="none" stroke="#16140f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {loading ? (
          <p className="muted">Loading...</p>
        ) : empty ? (
          <p className="muted">No attendance yet. Students show up here after their ID is scanned.</p>
        ) : filter.groupBy === "all" ? (
          <>
            <AttendanceSummary total={stats.total} programs={stats.programs} />
            {records.map(renderStudent)}
            <div className="row" style={{ justifyContent: "center", alignItems: "center" }}>
              <button className="btn btn-sm btn-ghost" onClick={() => setPage((p) => Math.max(p - 1, 0))} disabled={page === 0}>Previous</button>
              <span className="muted">Page {page + 1}</span>
              <button className="btn btn-sm btn-ghost" onClick={() => hasMore && setPage((p) => p + 1)} disabled={!hasMore}>Next</button>
            </div>
          </>
        ) : (
          groups.map((group) => (
            <section key={group.key} className="att-group">
              <AttendanceSummary
                label={group.label}
                total={group.total}
                programs={group.programs}
              />
              {group.students.map(renderStudent)}
            </section>
          ))
        )}
      </div>

      {confirmClear && createPortal(
        <div className="overlay" onClick={() => setConfirmClear(false)}>
          <div className="modal modal-solid confirm-dialog" onClick={(event) => event.stopPropagation()}>
            <h3>Remove all attendance?</h3>
            <p className="muted">This will clear scan records only. Student accounts stay in the list.</p>
            <div className="confirm-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmClear(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={removeAllAttendance}>
                Remove
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </AppShell>
  );
}
