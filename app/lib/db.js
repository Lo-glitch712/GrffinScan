import { requireSupabase } from "./supabase";
import { passwordsMatch, studentLoginPassword } from "./studentFormat";

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

const STUDENT_VAULT_ID = "__gs_vault__";
const STUDENT_PROFILE_ID = "__gs_profile__";
let passwordColumnEnabled;
let profileColumnsEnabled;

function isInternalStudentId(id) {
  return String(id || "").startsWith("__gs_");
}

async function hasStudentPasswordColumn() {
  if (passwordColumnEnabled !== undefined) return passwordColumnEnabled;
  const supabase = requireSupabase();
  const { error } = await supabase.from("students").select("password").limit(0);
  passwordColumnEnabled = !error;
  return passwordColumnEnabled;
}

async function readPasswordVault() {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("students")
    .select("lastname")
    .eq("id", STUDENT_VAULT_ID)
    .maybeSingle();
  await throwIf(error);
  try {
    const parsed = JSON.parse(data?.lastname || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function writePasswordVault(vault) {
  await writeInternalStudentRow(STUDENT_VAULT_ID, JSON.stringify(vault));
}

async function storeStudentPassword(studentId, password) {
  if (await hasStudentPasswordColumn()) {
    const supabase = requireSupabase();
    const { error } = await supabase.from("students").update({ password }).eq("id", studentId);
    await throwIf(error);
    return;
  }
  const vault = await readPasswordVault();
  vault[studentId] = password;
  await writePasswordVault(vault);
}

async function studentPasswordMatches(studentId, password, rowPassword) {
  if (await hasStudentPasswordColumn()) {
    return Boolean(rowPassword) && rowPassword === password;
  }
  const vault = await readPasswordVault();
  return vault[studentId] === password;
}

async function studentHasPassword(studentId, rowPassword) {
  if (await hasStudentPasswordColumn()) return Boolean(rowPassword);
  const vault = await readPasswordVault();
  return Boolean(vault[studentId]);
}

async function removeStoredStudentPassword(studentId) {
  if (await hasStudentPasswordColumn()) return;
  const vault = await readPasswordVault();
  if (!(studentId in vault)) return;
  delete vault[studentId];
  await writePasswordVault(vault);
}

async function hasStudentProfileColumns() {
  if (profileColumnsEnabled !== undefined) return profileColumnsEnabled;
  const supabase = requireSupabase();
  const { error } = await supabase.from("students").select("middlename,sex").limit(0);
  profileColumnsEnabled = !error;
  return profileColumnsEnabled;
}

async function readProfileVault() {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("students")
    .select("lastname")
    .eq("id", STUDENT_PROFILE_ID)
    .maybeSingle();
  await throwIf(error);
  try {
    const parsed = JSON.parse(data?.lastname || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function writeInternalStudentRow(id, lastname) {
  const supabase = requireSupabase();
  const row = {
    id,
    lastname,
    firstname: "system",
    course: "SYS",
    yearsection: "SYS",
  };
  const { data: existing, error: findError } = await supabase
    .from("students")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  await throwIf(findError);
  if (existing) {
    const { error } = await supabase.from("students").update({ lastname }).eq("id", id);
    await throwIf(error);
    return;
  }
  const { error } = await supabase.from("students").insert(row);
  await throwIf(error);
}

async function writeProfileVault(vault) {
  await writeInternalStudentRow(STUDENT_PROFILE_ID, JSON.stringify(vault));
}

function applyProfile(student, vault) {
  if (!student) return student;
  const extra = vault?.[student.id];
  return {
    ...student,
    middlename: student.middlename || extra?.middlename || "",
    sex: student.sex || extra?.sex || "",
  };
}

async function withProfiles(students) {
  const list = students || [];
  if (!list.length) return list;
  if (await hasStudentProfileColumns()) {
    return list.map((student) => ({
      ...student,
      middlename: student.middlename || "",
      sex: student.sex || "",
    }));
  }
  const vault = await readProfileVault();
  return list.map((student) => applyProfile(student, vault));
}

async function withProfile(student) {
  if (!student) return null;
  const [mapped] = await withProfiles([student]);
  return mapped;
}

async function storeStudentProfile(studentId, fields) {
  if (await hasStudentProfileColumns()) return;
  const vault = await readProfileVault();
  const current = vault[studentId] || {};
  vault[studentId] = {
    middlename:
      "middlename" in fields ? String(fields.middlename || "").trim() : current.middlename || "",
    sex: "sex" in fields ? String(fields.sex || "").trim() : current.sex || "",
  };
  await writeProfileVault(vault);
}

async function removeStoredStudentProfiles(ids) {
  if (await hasStudentProfileColumns()) return;
  const list = [...new Set((ids || []).map((id) => String(id)))];
  if (!list.length) return;
  const vault = await readProfileVault();
  let changed = false;
  for (const id of list) {
    if (id in vault) {
      delete vault[id];
      changed = true;
    }
  }
  if (changed) await writeProfileVault(vault);
}

async function fetchAllRows(table, columns = "*", orderColumn = "id") {
  const supabase = requireSupabase();
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(orderColumn, { ascending: true })
      .range(from, from + pageSize - 1);
    await throwIf(error);
    const chunk = data || [];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return rows;
}

export async function getStudents() {
  const data = await fetchAllRows("students");
  return withProfiles(
    data.filter((student) => !isInternalStudentId(student.id)).map((student) => withoutPassword(student))
  );
}

async function getStudentsByIds(ids) {
  const list = [...new Set((ids || []).map((id) => String(id).trim()).filter(Boolean))];
  if (!list.length) return [];

  const supabase = requireSupabase();
  const found = [];
  const chunkSize = 100;
  for (let i = 0; i < list.length; i += chunkSize) {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .in("id", list.slice(i, i + chunkSize));
    await throwIf(error);
    found.push(...(data || []));
  }
  return withProfiles(
    found.filter((student) => !isInternalStudentId(student.id)).map((student) => withoutPassword(student))
  );
}

export async function findStudentById(id) {
  if (isInternalStudentId(id)) return null;
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  await throwIf(error);
  if (!data || isInternalStudentId(data.id)) return null;
  return withProfile(withoutPassword(data));
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
  const candidates = barcodeIdCandidates(raw);
  for (const id of candidates) {
    const student = await findStudentById(id);
    if (student) return student;
  }

  const students = await getStudents();
  return (
    students.find((student) => {
      const sid = String(student.id || "").trim();
      const sidDigits = sid.replace(/\D/g, "");
      return candidates.some((candidate) => sid === candidate || (sidDigits && sidDigits === candidate));
    }) || null
  );
}

export async function loginStudent(id, password) {
  const supabase = requireSupabase();
  const studentId = String(id || "").trim();
  if (!studentId || isInternalStudentId(studentId)) return null;

  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .maybeSingle();
  await throwIf(error);
  if (!data || isInternalStudentId(data.id)) return null;

  const generated = studentLoginPassword(data.firstname, data.lastname, data.id);
  const storedOk = await studentPasswordMatches(studentId, password, data.password);
  if (!storedOk && !passwordsMatch(password, generated)) return null;
  return withProfile(withoutPassword(data));
}

export async function registerStudent(student) {
  const supabase = requireSupabase();
  const id = String(student.id).trim();
  if (isInternalStudentId(id)) {
    throw new Error("That Student ID cannot be used.");
  }

  const hasPasswordCol = await hasStudentPasswordColumn();
  const { data: existing, error: findError } = await supabase
    .from("students")
    .select(
      hasPasswordCol
        ? "id, lastname, firstname, course, yearsection, password, created_at"
        : "id, lastname, firstname, course, yearsection, created_at"
    )
    .eq("id", id)
    .maybeSingle();
  await throwIf(findError);

  if (existing && (await studentHasPassword(id, existing.password))) return null;

  const record = {
    id,
    lastname: student.lastname,
    firstname: student.firstname,
    course: student.course,
    yearsection: student.yearsection,
    created_at: existing?.created_at || student.created_at || new Date().toISOString(),
  };
  if (hasPasswordCol) record.password = student.password;

  let saved;
  if (existing) {
    const { data, error } = await supabase
      .from("students")
      .update({
        lastname: record.lastname,
        firstname: record.firstname,
        course: record.course,
        yearsection: record.yearsection,
        ...(hasPasswordCol ? { password: student.password } : {}),
      })
      .eq("id", id)
      .select()
      .single();
    await throwIf(error);
    saved = data;
  } else {
    const { data, error } = await supabase.from("students").insert([record]).select().single();
    await throwIf(error);
    saved = data;
  }

  await storeStudentPassword(id, student.password);
  if ("middlename" in student || "sex" in student) {
    await storeStudentProfile(id, student);
  }
  return withProfile(withoutPassword(saved));
}

export async function saveStudent(student) {
  const supabase = requireSupabase();
  const { password, middlename, sex, ...rest } = student;
  const record = {
    ...rest,
    created_at: student.created_at || new Date().toISOString(),
  };
  if (password && (await hasStudentPasswordColumn())) {
    record.password = password;
  }
  if (await hasStudentProfileColumns()) {
    record.middlename = middlename || "";
    record.sex = sex || "";
  }
  const { data, error } = await supabase
    .from("students")
    .insert([record])
    .select()
    .single();
  await throwIf(error);
  if (middlename || sex) {
    await storeStudentProfile(data.id, { middlename, sex });
  }
  return withProfile(withoutPassword(data));
}

export async function updateStudent(id, fields) {
  const supabase = requireSupabase();
  const attempts = [fields];
  if ("middlename" in fields || "sex" in fields) {
    const { middlename, sex, ...rest } = fields;
    attempts.push(rest);
  }
  let lastError = null;
  for (const payload of attempts) {
    const { error } = await supabase.from("students").update(payload).eq("id", id);
    if (!error) {
      if ("middlename" in fields || "sex" in fields) {
        await storeStudentProfile(id, fields);
      }
      return;
    }
    lastError = error;
  }
  await throwIf(lastError);
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
  await removeStoredStudentPassword(id);
  await removeStoredStudentProfiles([id]);
}

export async function deleteStudentsByIds(ids) {
  const list = [...new Set((ids || []).map((id) => String(id).trim()).filter(Boolean))];
  if (!list.length) return;

  const supabase = requireSupabase();
  const { error: attendanceError } = await supabase
    .from("attendance")
    .delete()
    .in("student_id", list);
  await throwIf(attendanceError);
  const { error } = await supabase.from("students").delete().in("id", list);
  await throwIf(error);
  await Promise.all(list.map((id) => removeStoredStudentPassword(id)));
  await removeStoredStudentProfiles(list);
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
  const unused = (students || []).filter(
    (student) =>
      !isInternalStudentId(student.id) && !attendedIds.has(String(student.id))
  );
  if (!unused.length) return;

  const unusedIds = unused.map((student) => student.id);
  const { error } = await supabase.from("students").delete().in("id", unusedIds);
  await throwIf(error);
  await removeStoredStudentProfiles(unusedIds);
}

export async function clearAllAttendance() {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("attendance")
    .delete()
    .not("student_id", "is", null);
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
  await updateEvent(id, { starts_at, ends_at });
}

export async function updateEvent(id, { name, starts_at, ends_at }) {
  const supabase = requireSupabase();
  const next = applyEventSchedule(
    {
      starts_at: starts_at || null,
      ends_at: ends_at || null,
    },
    Date.now()
  );
  const fields = {
    starts_at: next.starts_at,
    ends_at: next.ends_at,
    is_open: next.is_open,
  };
  if (name != null) fields.name = String(name).trim();
  const { error } = await supabase.from("events").update(fields).eq("id", id);
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
  const { data, error } = await supabase
    .from("hosts")
    .select("id, username, current_session");
  await throwIf(error);
  return data || [];
}

export async function addHost(username, password) {
  const name = String(username || "").trim();
  const pass = String(password || "");
  if (!name || !pass) throw new Error("Username and password are required.");

  const supabase = requireSupabase();
  const { data: existing, error: findError } = await supabase
    .from("hosts")
    .select("id")
    .eq("username", name)
    .maybeSingle();
  await throwIf(findError);
  if (existing) throw new Error("That username is already taken.");

  const { error } = await supabase.from("hosts").insert({ username: name, password: pass });
  await throwIf(error);
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

let attendanceCreatedAtEnabled;

async function hasAttendanceCreatedAtColumn() {
  if (attendanceCreatedAtEnabled !== undefined) return attendanceCreatedAtEnabled;
  const supabase = requireSupabase();
  const { error } = await supabase.from("attendance").select("created_at").limit(0);
  attendanceCreatedAtEnabled = !error;
  return attendanceCreatedAtEnabled;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date) {
  const day = startOfDay(date);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

function attendanceDate(row, eventsById) {
  const scanned = row?.created_at ? new Date(row.created_at) : null;
  if (scanned && !Number.isNaN(scanned.getTime())) return scanned;
  const eventId = Number(row?.event_id);
  const event =
    eventsById.get(Number.isNaN(eventId) ? row?.event_id : eventId) ||
    eventsById.get(String(row?.event_id));
  const scheduled = event?.starts_at ? new Date(event.starts_at) : null;
  if (scheduled && !Number.isNaN(scheduled.getTime())) return scheduled;
  return null;
}

function eventKey(eventId) {
  const numericId = Number(eventId);
  return Number.isNaN(numericId) ? eventId : numericId;
}

function sortStudents(students) {
  return [...students].sort((a, b) => {
    const last = (a.lastname || "").localeCompare(b.lastname || "");
    if (last !== 0) return last;
    return (a.firstname || "").localeCompare(b.firstname || "");
  });
}

function filterStudents(students, { course, yearSection, search } = {}) {
  let next = students;
  if (course) next = next.filter((student) => student.course === course);
  if (yearSection) next = next.filter((student) => student.yearsection === yearSection);
  const query = String(search || "").trim().toLowerCase();
  if (!query) return next;
  return next.filter((student) => {
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

function attachEvents(students, attendance) {
  return students.map((student) => ({
    ...student,
    events: attendance
      .filter((row) => sameId(row.student_id, student.id))
      .map((row) => eventKey(row.event_id)),
  }));
}

export function countPrograms(students) {
  const counts = new Map();
  for (const student of students) {
    const name = String(student.course || "Unknown").trim() || "Unknown";
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function periodMeta(date, groupBy) {
  if (!date) {
    return { key: "undated", label: "Undated", sortAt: 0 };
  }

  if (groupBy === "day") {
    const start = startOfDay(date);
    return {
      key: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`,
      label: start.toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      sortAt: start.getTime(),
    };
  }

  if (groupBy === "week") {
    const start = startOfWeek(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const sameMonth = start.getMonth() === end.getMonth();
    const startText = start.toLocaleDateString([], { month: "short", day: "numeric" });
    const endText = end.toLocaleDateString([], sameMonth
      ? { day: "numeric", year: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" });
    return {
      key: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`,
      label: `${startText} – ${endText}`,
      sortAt: start.getTime(),
    };
  }

  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  return {
    key: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}`,
    label: start.toLocaleDateString([], { month: "long", year: "numeric" }),
    sortAt: start.getTime(),
  };
}

export function groupAttendanceByPeriod(students, attendance, events, groupBy) {
  const eventsById = new Map();
  for (const event of events || []) {
    eventsById.set(event.id, event);
    eventsById.set(String(event.id), event);
    eventsById.set(Number(event.id), event);
  }

  const studentById = new Map((students || []).map((student) => [String(student.id), student]));
  const buckets = new Map();

  for (const row of attendance || []) {
    const student = studentById.get(String(row.student_id));
    if (!student) continue;

    const meta = periodMeta(attendanceDate(row, eventsById), groupBy);
    if (!buckets.has(meta.key)) {
      buckets.set(meta.key, {
        ...meta,
        studentMap: new Map(),
        eventIdsByStudent: new Map(),
      });
    }

    const bucket = buckets.get(meta.key);
    bucket.studentMap.set(String(student.id), student);
    const ids = bucket.eventIdsByStudent.get(String(student.id)) || [];
    ids.push(eventKey(row.event_id));
    bucket.eventIdsByStudent.set(String(student.id), ids);
  }

  return [...buckets.values()]
    .sort((a, b) => b.sortAt - a.sortAt)
    .map((bucket) => {
      const list = sortStudents([...bucket.studentMap.values()]);
      return {
        key: bucket.key,
        label: bucket.label,
        total: list.length,
        programs: countPrograms(list),
        students: list.map((student) => ({
          ...student,
          events: bucket.eventIdsByStudent.get(String(student.id)) || [],
        })),
      };
    });
}

export function studentAttendedEvent(student, eventId) {
  return (student?.events || []).some((id) => String(id) === String(eventId));
}

export async function getAttendance() {
  const data = await fetchAllRows("attendance", "*", "student_id");
  return data.filter(
    (row) => row?.student_id != null && row?.event_id != null && !isInternalStudentId(row.student_id)
  );
}

function emptyAttendanceView(events, groupBy) {
  return {
    events,
    stats: { total: 0, programs: [] },
    groups: groupBy && groupBy !== "all" ? [] : null,
    records: [],
    hasMore: false,
    courses: [],
    yearSections: [],
  };
}

export async function getAttendanceView({
  course,
  yearSection,
  search,
  page = 0,
  pageSize,
  limit,
  groupBy = "all",
} = {}) {
  const [attendance, events] = await Promise.all([getAttendance(), getEvents()]);
  if (!attendance.length) return emptyAttendanceView(events, groupBy);

  const scanned = await getStudentsByIds(attendance.map((row) => row.student_id));
  const courses = [...new Set(scanned.map((student) => student.course).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const yearSections = [...new Set(
    scanned
      .filter((student) => !course || student.course === course)
      .map((student) => student.yearsection)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  const filtered = sortStudents(filterStudents(scanned, { course, yearSection, search }));
  const allowed = new Set(filtered.map((student) => String(student.id)));
  const rows = attendance.filter((row) => allowed.has(String(row.student_id)));
  const stats = {
    total: filtered.length,
    programs: countPrograms(filtered),
  };

  if (groupBy && groupBy !== "all") {
    return {
      events,
      stats,
      groups: groupAttendanceByPeriod(filtered, rows, events, groupBy),
      records: [],
      hasMore: false,
      courses,
      yearSections,
    };
  }

  let sliced = filtered;
  if (limit) sliced = filtered.slice(0, limit);
  else if (pageSize) sliced = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return {
    events,
    stats,
    groups: null,
    records: attachEvents(sliced, rows),
    hasMore: Boolean(pageSize) && filtered.length > (page + 1) * pageSize,
    courses,
    yearSections,
  };
}

export async function getStudentRecords(options = {}) {
  const view = await getAttendanceView(options);
  if (view.groups) {
    return view.groups.flatMap((group) => group.students);
  }
  return view.records;
}

export async function findAttendance(studentId, eventId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("student_id", String(studentId))
    .eq("event_id", Number(eventId) || eventId)
    .maybeSingle();
  await throwIf(error);
  return data || null;
}

export async function addAttendance(studentId, eventId) {
  const supabase = requireSupabase();
  const row = {
    student_id: String(studentId),
    event_id: Number(eventId) || eventId,
  };
  if (await hasAttendanceCreatedAtColumn()) {
    row.created_at = new Date().toISOString();
  }
  const { error } = await supabase.from("attendance").insert([row]);
  await throwIf(error);
}

export async function isHostSessionValid(hostInfo) {
  if (!hostInfo?.id) return false;
  const host = await getHostSession(hostInfo.id);
  return Boolean(host && host.current_session === hostInfo.current_session);
}
