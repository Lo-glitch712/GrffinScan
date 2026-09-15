"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getEvents,
  getStudentRecords,
  getStudents,
  isHostSessionValid,
} from "../../lib/db";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import AppShell from "../../components/AppShell";
import Select from "../../components/Select";

const PAGE_SIZE = 50;
const DOWNLOAD_LIMIT = 60;

export default function AttendancePage() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [records, setRecords] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ course: "", yearSection: "" });

  useEffect(() => {
    const hostInfo = sessionStorage.getItem("hostInfo");
    if (!hostInfo) {
      router.push("/host");
      return;
    }

    fetchEvents();
    fetchAllStudents();

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

    return () => clearInterval(interval);
  }, [router]);

  const fetchEvents = async () => {
    setEvents(getEvents());
  };

  const fetchAllStudents = async () => {
    setAllStudents(getStudents());
  };

  useEffect(() => {
    fetchAttendance();
  }, [filter, page]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const merged = getStudentRecords({
        course: filter.course,
        yearSection: filter.yearSection,
        page,
        pageSize: PAGE_SIZE,
      });
      setRecords(merged);
    } catch (err) {
      console.error("Fetch error:", err);
    }
    setLoading(false);
  };

  const fetchAllForDownload = async () => {
    try {
      return getStudentRecords({
        course: filter.course,
        yearSection: filter.yearSection,
        limit: DOWNLOAD_LIMIT,
      });
    } catch (err) {
      console.error("Download fetch error:", err);
      return [];
    }
  };

  const downloadPDF = async () => {
    if (events.length === 0) {
      alert("Events not loaded yet.");
      return;
    }

    const allRecords = await fetchAllForDownload();
    if (allRecords.length === 0) {
      alert("No records to export.");
      return;
    }

    const doc = new jsPDF("l", "pt", "a4");

    const tableHead = [[
      "Last Name",
      "First Name",
      "Course",
      "YearSection",
      "Total",
      ...events.map((evt) => evt.name),
    ]];

    const tableBody = allRecords.map((student) => [
      student.lastname,
      student.firstname,
      student.course,
      student.yearsection,
      student.events.length,
      ...events.map((evt) => (student.events.includes(evt.id) ? "Attended" : "")),
    ]);

    doc.setFontSize(14);
    doc.text(`Attendance Records (Showing ${allRecords.length} students)`, 40, 40);

    autoTable(doc, {
      head: tableHead,
      body: tableBody,
      startY: 60,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [196, 160, 53] },
      margin: { left: 20, right: 20 },
      tableWidth: "auto",
    });

    const coursePart = filter.course ? filter.course.replace(/\s+/g, "_") : "AllCourses";
    const yearSectionPart = filter.yearSection ? filter.yearSection.replace(/\s+/g, "_") : "AllYearSections";
    const fileName = `Attendance_${coursePart}_${yearSectionPart}.pdf`;

    doc.save(fileName);
  };

  const uniqueCourses = [...new Set(allStudents.map((s) => s.course))].sort((a, b) => a.localeCompare(b));
  const uniqueYearSections = [...new Set(
    allStudents
      .filter(s => !filter.course || s.course === filter.course)
      .map(s => s.yearsection)
  )].sort((a, b) => a.localeCompare(b));

  return (
    <AppShell
      title="Attendance"
      wide
      footer={
        <div className="bottom-bar">
          <button className="btn btn-white" onClick={() => router.push("/host/dashboard")}>
            Back
          </button>
          <button className="btn" onClick={downloadPDF}>
            Download PDF
          </button>
        </div>
      }
    >
      <div className="stack-wide">
        <div className="row">
          <Select
            value={filter.course}
            onChange={(e) => setFilter({ ...filter, course: e.target.value, yearSection: "" })}
            placeholder="Courses"
            options={[
              { value: "", label: "Courses" },
              ...uniqueCourses.map((c) => ({ value: c, label: c })),
            ]}
          />
          <Select
            value={filter.yearSection}
            onChange={(e) => setFilter({ ...filter, yearSection: e.target.value })}
            placeholder="Year & Section"
            options={[
              { value: "", label: "Year & Section" },
              ...uniqueYearSections.map((ys) => ({ value: ys, label: ys })),
            ]}
          />
        </div>

        {loading ? (
          <p className="muted">Loading...</p>
        ) : records.length === 0 ? (
          <p className="muted">No attendance records.</p>
        ) : (
          <>
            {records.map(student => (
              <div key={student.id} className="card">
                <div>
                  <strong>{student.lastname}, {student.firstname}</strong>
                  <p className="muted">{student.course} · {student.yearsection}</p>
                </div>
                <div className="row">
                  {events.map(evt => (
                    <span
                      key={evt.id}
                      className={student.events.includes(evt.id) ? "badge is-on" : "badge"}
                    >
                      {evt.name}
                    </span>
                  ))}
                </div>
                <div>Total: {student.events.length}</div>
              </div>
            ))}

            <div className="row" style={{ justifyContent: "center", alignItems: "center" }}>
              <button className="btn btn-sm btn-ghost" onClick={() => setPage(p => Math.max(p - 1, 0))} disabled={page === 0}>Previous</button>
              <span className="muted">Page {page + 1}</span>
              <button className="btn btn-sm btn-ghost" onClick={() => records.length === PAGE_SIZE && setPage(p => p + 1)} disabled={records.length < PAGE_SIZE}>Next</button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
