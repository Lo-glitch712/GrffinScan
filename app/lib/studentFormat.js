export function studentLoginPassword(firstname, lastname, studentId) {
  const first = String(firstname || "").trim().charAt(0).toUpperCase();
  const last = String(lastname || "").trim().replace(/\s+/g, "");
  const lastNumber = String(studentId || "").replace(/\D/g, "").slice(-1);
  return `${first}${last}${lastNumber}`;
}

export function formatStudentName(student) {
  if (!student) return "";
  const last = String(student.lastname || "").trim();
  const first = String(student.firstname || "").trim();
  const middle = String(student.middlename || "").trim();
  const given = [first, middle].filter(Boolean).join(" ");
  if (last && given) return `${last}, ${given}`;
  return last || given;
}

export function passwordsMatch(input, expected) {
  return String(input || "").trim().toLowerCase() === String(expected || "").trim().toLowerCase();
}
