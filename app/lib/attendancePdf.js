import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { studentAttendedEvent } from "./db";

function formatPdfDate(date = new Date()) {
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatPdfTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function stampPage(doc, printed) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(printed, 40, 24);
  const page = doc.internal.getNumberOfPages();
  doc.text(`Page ${page}`, pageWidth - 40, pageHeight - 24, { align: "right" });
  doc.setTextColor(20);
}

export function downloadAttendancePdf({ view, events = [], filter = {}, groupLabel = "All" }) {
  const exportGroups = view?.groups;
  const exportRecords = view?.records || [];
  if (!view || (!exportGroups?.length && !exportRecords.length)) {
    throw new Error("No records to export.");
  }

  const now = new Date();
  const printed = `${formatPdfDate(now)} · ${formatPdfTime(now)}`;
  const eventsList = view.events || events;
  const doc = new jsPDF("l", "pt", "a4");
  const programLine = (view.stats?.programs || [])
    .map((program) => `${program.name} ${program.count}`)
    .join("  ·  ");

  const drawHeader = (title, extraY = 42) => {
    doc.setFontSize(14);
    doc.setTextColor(20);
    doc.text(title, 40, extraY);
    if (programLine && extraY <= 48) {
      doc.setFontSize(10);
      doc.setTextColor(90);
      doc.text(programLine, 40, extraY + 16);
      doc.setTextColor(20);
      return extraY + 28;
    }
    return extraY + 12;
  };

  const addTable = (students, startY) => {
    autoTable(doc, {
      head: [[
        "Last Name",
        "First Name",
        "Course",
        "Year & Section",
        ...eventsList.map((evt) => evt.name),
      ]],
      body: students.map((student) => [
        student.lastname,
        student.firstname,
        student.course,
        student.yearsection,
        ...eventsList.map((evt) => (studentAttendedEvent(student, evt.id) ? "Attended" : "")),
      ]),
      startY,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [196, 160, 53], textColor: 20 },
      margin: { left: 40, right: 40, top: 36, bottom: 36 },
      tableWidth: "auto",
      didDrawPage: () => stampPage(doc, printed),
    });
  };

  const mainTitle = `GriffinScan Attendance · ${groupLabel} · ${view.stats.total} students`;
  if (exportGroups?.length) {
    exportGroups.forEach((group, index) => {
      if (index > 0) doc.addPage();
      const tableTop = drawHeader(`${mainTitle}`, 42);
      doc.setFontSize(12);
      doc.text(`${group.label} — ${group.total} students`, 40, tableTop + 6);
      addTable(group.students, tableTop + 14);
    });
  } else {
    addTable(exportRecords, drawHeader(mainTitle, 42));
  }

  const datePart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const coursePart = filter.course ? filter.course.replace(/\s+/g, "_") : "AllCourses";
  const yearSectionPart = filter.yearSection ? filter.yearSection.replace(/\s+/g, "_") : "AllYearSections";
  doc.save(`Attendance_${datePart}_${filter.groupBy || "all"}_${coursePart}_${yearSectionPart}.pdf`);
}
