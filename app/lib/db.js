import { requireSupabase } from "./supabase";

if (typeof window !== "undefined") {
  try {
    localStorage.removeItem("itona-local-db");
  } catch {
    /* ignore */
  }
}

function sameId(a, b) {
  return String(a) === String(b);
}

export function createSessionToken() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    /* HTTP / non-secure mobile browsers */
  }

  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function applyEventSchedule(event, now) {
  const start = event.starts_at ? new Date(event.starts_at).getTime() : null;
  const end = event.ends_at ? new Date(event.ends_at).getTime() : null;
  if (!start && !end) return event;

  const afterStart = !start || now >= start;
  const beforeEnd = !end || now < end;
  return { ...event, is_open: afterStart && beforeEnd };
}

async function throwIf(error) {
  if (error) throw error;
}

function withoutPassword(student) {
  if (!student) return null;
  const { password, ...safe } = student;
  return safe;
}

function throwStudentAuthError(error) {
  if (!error) return;
  const message = error.message || "";
  if (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /password/i.test(message)
  ) {
    throw new Error(
      "Student passwords need a database update. In Supabase → SQL Editor, run: alter table public.students add column if not exists password text not null default '';"
    );
  }
  throw error;
}

export async function getStudents() {
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("students").select("*");
  await throwIf(error);
  return (data || []).map((student) => withoutPassword(student));
}

export async function findStudentById(id) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  await throwIf(error);
  return withoutPassword(data);
}

function barcodeIdCandidates(raw) {
  const text = String(raw || "").trim();
  const ids = [];
  const add = (value) => {
    const next = String(value || "").trim();
    if (next && !ids.includes(next)) ids.push(next);
  };

  if (text.startsWith("{") && text.endsWith("}")) {
    try {
      add(JSON.parse(text).id);
    } catch {
      /* ignore invalid json */
    }
  }

  add(text);
  add(text.replace(/\s+/g, ""));
  const digits = text.replace(/\D/g, "");
  add(digits);
  const longDigits = text.match(/\d{7,}/);
  if (longDigits) add(longDigits[0]);
  return ids;
}

export async function findStudentByBarcode(raw) {
  for (const id of barcodeIdCandidates(raw)) {
    const student = await findStudentById(id);
    if (student) return student;
  }
  return null;
}

export async function loginStudent(id, password) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("students")
    .select("id, lastname, firstname, course, yearsection, password")
    .eq("id", String(id).trim())
    .maybeSingle();
  throwStudentAuthError(error);
  if (!data || !data.password || data.password !== password) return null;
  return withoutPassword(data);
}

export async function registerStudent(student) {
  const supabase = requireSupabase();
  const id = String(student.id).trim();
  const { data: existing, error: findError } = await supabase
    .from("students")
    .select("id, lastname, firstname, course, yearsection, password, created_at")
    .eq("id", id)
    .maybeSingle();
  throwStudentAuthError(findError);

  if (existing?.password) return null;

  const record = {
    id,
    lastname: student.lastname,
    firstname: student.firstname,
    course: student.course,
    yearsection: student.yearsection,
    password: student.password,
    created_at: existing?.created_at || student.created_at || new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabase
      .from("students")
      .update({
        lastname: record.lastname,
        firstname: record.firstname,
        course: record.course,
        yearsection: record.yearsection,
        password: record.password,
      })
      .eq("id", id)
      .select()
      .single();
    throwStudentAuthError(error);
    return withoutPassword(data);
  }

  const { data, error } = await supabase.from("students").insert([record]).select().single();
  throwStudentAuthError(error);
  return withoutPassword(data);
}

export async function saveStudent(student) {
  const supabase = requireSupabase();
  const record = {
    ...student,
    created_at: student.created_at || new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("students")
    .insert([record])
    .select()
    .single();
  await throwIf(error);
  return withoutPassword(data);
}

export async function updateStudent(id, fields) {
  const supabase = requireSupabase();
  const { error } = await supabase.from("students").update(fields).eq("id", id);
  await throwIf(error);
}

export async function deleteStudent(id) {
  const supabase = requireSupabase();
  const { error: attendanceError } = await supabase
    .from("attendance")
    .delete()
    .eq("student_id", id);
  await throwIf(attendanceError);
  const { error } = await supabase.from("students").delete().eq("id", id);
  await throwIf(error);
}

export async function deleteStudentsWithoutAttendance() {
  const supabase = requireSupabase();
  const [{ data: students, error: studentError }, { data: attendance, error: attendanceError }] =
    await Promise.all([
      supabase.from("students").select("id"),
      supabase.from("attendance").select("student_id"),
    ]);
  await throwIf(studentError);
  await throwIf(attendanceError);

  const attendedIds = new Set((attendance || []).map((row) => String(row.student_id)));
  const unused = (students || []).filter((student) => !attendedIds.has(String(student.id)));
  if (!unused.length) return;

  const { error } = await supabase
    .from("students")
    .delete()
    .in("id", unused.map((student) => student.id));
  await throwIf(error);
}

export async function clearAllAttendance() {
  const supabase = requireSupabase();
  const { error: attendanceError } = await supabase
    .from("attendance")
    .delete()
    .not("student_id", "is", null);
  await throwIf(attendanceError);
  const { error } = await supabase.from("students").delete().not("id", "is", null);
  await throwIf(error);
}

export async function getEvents() {
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("events").select("*").order("id", { ascending: true });
  await throwIf(error);

  const now = Date.now();
  const events = (data || []).map((event) => applyEventSchedule(event, now));
  await Promise.all(
    events
      .filter((event, index) => event.is_open !== data[index].is_open)
      .map((event) =>
        supabase.from("events").update({ is_open: event.is_open }).eq("id", event.id)
      )
  );
  return events;
}

export async function getCurrentEvent() {
  const events = await getEvents();
  const open = events.filter((event) => event.is_open);
  if (open.length) return open[0];

  const now = Date.now();
  const upcoming = events
    .filter((event) => event.starts_at && new Date(event.starts_at).getTime() > now)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  return upcoming[0] || null;
}

export async function addEvent(name, { starts_at = "", ends_at = "" } = {}) {
  const supabase = requireSupabase();
  const scheduled = applyEventSchedule(
    {
      name,
      starts_at: starts_at || null,
      ends_at: ends_at || null,
      is_open: true,
    },
    Date.now()
  );
  const { error } = await supabase.from("events").insert([scheduled]);
  await throwIf(error);
}

export async function setEventTime(id, { starts_at, ends_at }) {
  const supabase = requireSupabase();
  const next = applyEventSchedule(
    {
      starts_at: starts_at || null,
      ends_at: ends_at || null,
    },
    Date.now()
  );
  const { error } = await supabase
    .from("events")
    .update({
      starts_at: next.starts_at,
      ends_at: next.ends_at,
      is_open: next.is_open,
    })
    .eq("id", id);
  await throwIf(error);
}

export async function setEventOpen(id, isOpen) {
  const supabase = requireSupabase();
  const { error } = await supabase.from("events").update({ is_open: isOpen }).eq("id", id);
  await throwIf(error);
}

export async function deleteEvent(id) {
  const supabase = requireSupabase();
  const eventId = Number(id);
  const key = Number.isNaN(eventId) ? id : eventId;
  const { error: attendanceError } = await supabase.from("attendance").delete().eq("event_id", key);
  await throwIf(attendanceError);
  const { error } = await supabase.from("events").delete().eq("id", key);
  await throwIf(error);
}

export async function getHosts() {
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("hosts").select("*");
  await throwIf(error);
  return data || [];
}

export async function deleteHost(id) {
  const supabase = requireSupabase();
  const { error } = await supabase.from("hosts").delete().eq("id", id);
  await throwIf(error);
}

async function ensureAccount(table, username, password) {
  const supabase = requireSupabase();
  const { data: existing, error: findError } = await supabase
    .from(table)
    .select("id")
    .eq("username", username)
    .maybeSingle();
  await throwIf(findError);

  if (existing?.id) {
    const { error } = await supabase
      .from(table)
      .update({ password })
      .eq("id", existing.id);
    await throwIf(error);
    return;
  }

  const { error } = await supabase.from(table).insert({ username, password });
  await throwIf(error);
}

export async function ensureDefaultAccounts() {
  await ensureAccount("admins", "admin", "admin");
  await ensureAccount("hosts", "host", "host");
}

export async function findAccount(username, password) {
  const supabase = requireSupabase();
  const name = String(username || "").trim();
  const pass = String(password || "");

  try {
    await ensureDefaultAccounts();
  } catch (err) {
    console.error(err);
  }

  const { data: admin, error: adminError } = await supabase
    .from("admins")
    .select("*")
    .eq("username", name)
    .eq("password", pass)
    .maybeSingle();
  await throwIf(adminError);
  if (admin) return { type: "admin", account: admin };

  const { data: host, error: hostError } = await supabase
    .from("hosts")
    .select("*")
    .eq("username", name)
    .eq("password", pass)
    .maybeSingle();
  await throwIf(hostError);
  if (host) return { type: "host", account: host };

  return null;
}

export async function setSession(table, id, token) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from(table)
    .update({ current_session: token })
    .eq("id", id);
  await throwIf(error);
}

export async function getHostSession(id) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("hosts").select("*").eq("id", id).maybeSingle();
  await throwIf(error);
  return data || null;
}

export async function getAttendance() {
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("attendance").select("*");
  await throwIf(error);
  return data || [];
}

export async function getStudentRecords({ course, yearSection, search, page = 0, pageSize, limit } = {}) {
  let students = await getStudents();
  const attendance = await getAttendance();

  if (course) students = students.filter((student) => student.course === course);
  if (yearSection) students = students.filter((student) => student.yearsection === yearSection);

  const query = String(search || "").trim().toLowerCase();
  if (query) {
    students = students.filter((student) => {
      const hay = [
        student.lastname,
        student.firstname,
        student.id,
        student.course,
        student.yearsection,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }

  students.sort((a, b) => {
    const last = (a.lastname || "").localeCompare(b.lastname || "");
    if (last !== 0) return last;
    return (a.firstname || "").localeCompare(b.firstname || "");
  });

  if (limit) students = students.slice(0, limit);
  if (pageSize) students = students.slice(page * pageSize, (page + 1) * pageSize);

  return students.map((student) => ({
    ...student,
    events: attendance
      .filter((row) => sameId(row.student_id, student.id))
      .map((row) => {
        const numericId = Number(row.event_id);
        return Number.isNaN(numericId) ? row.event_id : numericId;
      }),
  }));
}

export async function findAttendance(studentId, eventId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("student_id", studentId)
    .eq("event_id", eventId)
    .maybeSingle();
  await throwIf(error);
  return data || null;
}

export async function addAttendance(studentId, eventId) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("attendance")
    .insert([{ student_id: studentId, event_id: eventId }]);
  await throwIf(error);
}

export async function isHostSessionValid(hostInfo) {
  if (!hostInfo?.id) return false;
  const host = await getHostSession(hostInfo.id);
  return Boolean(host && host.current_session === hostInfo.current_session);
}
