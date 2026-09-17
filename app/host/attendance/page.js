"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAttendanceView,
  isHostSessionValid,
  studentAttendedEvent,
} from "../../lib/db";
import { downloadAttendancePdf } from "../../lib/attendancePdf";
import AppShell from "../../components/AppShell";
import AttendanceSummary from "../../components/AttendanceSummary";
import Select from "../../components/Select";
import { formatStudentName } from "../../lib/studentFormat";

const PAGE_SIZE = 50;
const DOWNLOAD_LIMIT = 60;
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

  useEffect(() => {
    const hostInfo = sessionStorage.getItem("hostInfo");
    if (!hostInfo) {
      router.push("/host");
      return;
    }

    const interval = setInterval(() => {
      void (async () => {
        const hostInfo = JSON.parse(sessionStorage.getItem("hostInfo"));
        if (!hostInfo?.id) {
          clearInterval(interval);
          router.push("/host");
          return;
        }

        if (!(await isHostSessionValid(hostInfo))) {
          sessionStorage.removeItem("hostInfo");
          clearInterval(interval);
          alert("You have been logged out by the admin.");
          router.push("/host");
        }
      })();
    }, 5000);

    return () => clearInterval(interval);
  }, [router]);

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

  const downloadPDF = async () => {
    const view = await fetchViewForDownload();
    try {
      downloadAttendancePdf({
        view,
        events,
        filter,
        groupLabel: GROUP_OPTIONS.find((option) => option.value === filter.groupBy)?.label || "All",
      });
    } catch (err) {
      alert(err.message || "No records to export.");
    }
  };

  const renderStudent = (student) => (
    <div key={student.id} className="card">
      <div>
        <strong>{formatStudentName(student)}</strong>
        <p className="muted">{student.course} · {student.yearsection}</p>
      </div>
      <div className="row">
        {events.map((evt) => {
          if (!studentAttendedEvent(student, evt.id)) return null;
          return (
            <span key={evt.id} className="badge is-on">
              {evt.name}
            </span>
          );
        })}
      </div>
    </div>
  );

  const empty = filter.groupBy === "all" ? records.length === 0 : !groups?.length;

  return (
    <AppShell
      title="Attendance"
      wide
      backTo="/host/dashboard"
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

        {loading ? (
          <p className="muted">Loading...</p>
        ) : empty ? (
          <p className="muted">No attendance yet. Students show up here after their ID is scanned.</p>
        ) : filter.groupBy === "all" ? (
          <>
            <AttendanceSummary total={stats.total} programs={stats.programs} />
            {records.map(renderStudent)}
            <div className="row" style={{ justifyContent: "center", alignItems: "center" }}>
              <button className="btn btn-sm btn-ghost" onClick={() => setPage(p => Math.max(p - 1, 0))} disabled={page === 0}>Previous</button>
              <span className="muted">Page {page + 1}</span>
              <button className="btn btn-sm btn-ghost" onClick={() => hasMore && setPage(p => p + 1)} disabled={!hasMore}>Next</button>
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
    </AppShell>
  );
}
