const KEY = "itona-local-db";

function seed() {
  return {
    students: [],
    events: [{ id: 1, name: "Orientation", is_open: true }],
    hosts: [{ id: 1, username: "host", password: "host", current_session: null }],
    admins: [{ id: 1, username: "admin", password: "admin", current_session: null }],
    attendance: [],
  };
}

function read() {
  if (typeof window === "undefined") return seed();

  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const initial = seed();
      localStorage.setItem(KEY, JSON.stringify(initial));
      return initial;
    }

    const parsed = JSON.parse(raw);
    return {
      students: parsed.students || [],
      events: parsed.events?.length ? parsed.events : seed().events,
      hosts: parsed.hosts?.length ? parsed.hosts : seed().hosts,
      admins: parsed.admins?.length ? parsed.admins : seed().admins,
      attendance: parsed.attendance || [],
    };
  } catch {
    return seed();
  }
}

function write(db) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

function sameId(a, b) {
  return String(a) === String(b);
}

export function getStudents() {
  return read().students;
}

export function findStudentById(id) {
  return read().students.find((student) => sameId(student.id, id)) || null;
}

export function saveStudent(student) {
  const db = read();
  const record = {
    ...student,
    created_at: student.created_at || new Date().toISOString(),
  };
  db.students.push(record);
  write(db);
  return record;
}

export function updateStudent(id, fields) {
  const db = read();
  db.students = db.students.map((student) =>
    sameId(student.id, id) ? { ...student, ...fields } : student
  );
  write(db);
}

export function deleteStudent(id) {
  const db = read();
  db.students = db.students.filter((student) => !sameId(student.id, id));
  db.attendance = db.attendance.filter((row) => !sameId(row.student_id, id));
  write(db);
}

export function deleteStudentsWithoutAttendance() {
  const db = read();
  const attendedIds = new Set(db.attendance.map((row) => String(row.student_id)));
  db.students = db.students.filter((student) => attendedIds.has(String(student.id)));
  write(db);
}

export function clearAllAttendance() {
  const db = read();
  db.attendance = [];
  db.students = [];
  write(db);
}

export function getEvents() {
  const db = read();
  const now = Date.now();
  let changed = false;
  const events = db.events.map((event) => {
    const next = applyEventSchedule(event, now);
    if (next.is_open !== event.is_open) changed = true;
    return next;
  });
  if (changed) {
    db.events = events;
    write(db);
  }
  return [...events].sort((a, b) => a.id - b.id);
}

export function getCurrentEvent() {
  const events = getEvents();
  const open = events.filter((event) => event.is_open);
  if (open.length) return open[0];

  const now = Date.now();
  const upcoming = events
    .filter((event) => event.starts_at && new Date(event.starts_at).getTime() > now)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  return upcoming[0] || null;
}

function applyEventSchedule(event, now) {
  const start = event.starts_at ? new Date(event.starts_at).getTime() : null;
  const end = event.ends_at ? new Date(event.ends_at).getTime() : null;
  if (!start && !end) return event;

  const afterStart = !start || now >= start;
  const beforeEnd = !end || now < end;
  return { ...event, is_open: afterStart && beforeEnd };
}

export function addEvent(name, { starts_at = "", ends_at = "" } = {}) {
  const db = read();
  const id = db.events.reduce((max, event) => Math.max(max, Number(event.id) || 0), 0) + 1;
  const event = {
    id,
    name,
    starts_at: starts_at || null,
    ends_at: ends_at || null,
    is_open: true,
  };
  db.events.push(applyEventSchedule(event, Date.now()));
  write(db);
}

export function setEventTime(id, { starts_at, ends_at }) {
  const db = read();
  db.events = db.events.map((event) => {
    if (!sameId(event.id, id)) return event;
    const next = {
      ...event,
      starts_at: starts_at || null,
      ends_at: ends_at || null,
    };
    return applyEventSchedule(next, Date.now());
  });
  write(db);
}

export function setEventOpen(id, isOpen) {
  const db = read();
  db.events = db.events.map((event) =>
    sameId(event.id, id) ? { ...event, is_open: isOpen } : event
  );
  write(db);
}

export function deleteEvent(id) {
  const db = read();
  db.events = db.events.filter((event) => !sameId(event.id, id));
  db.attendance = db.attendance.filter((row) => !sameId(row.event_id, id));
  write(db);
}

export function getHosts() {
  return read().hosts;
}

export function deleteHost(id) {
  const db = read();
  db.hosts = db.hosts.filter((host) => !sameId(host.id, id));
  write(db);
}

export function findAccount(username, password) {
  const db = read();
  const admin = db.admins.find(
    (row) => row.username === username && row.password === password
  );
  if (admin) return { type: "admin", account: admin };

  const host = db.hosts.find(
    (row) => row.username === username && row.password === password
  );
  if (host) return { type: "host", account: host };

  return null;
}

export function setSession(table, id, token) {
  const db = read();
  db[table] = db[table].map((row) =>
    sameId(row.id, id) ? { ...row, current_session: token } : row
  );
  write(db);
}

export function getHostSession(id) {
  return read().hosts.find((host) => sameId(host.id, id)) || null;
}

export function getAttendance() {
  return read().attendance;
}

export function getStudentRecords({ course, yearSection, search, page = 0, pageSize, limit } = {}) {
  let students = [...read().students];

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

  const attendance = read().attendance;
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

export function findAttendance(studentId, eventId) {
  return (
    read().attendance.find(
      (row) => sameId(row.student_id, studentId) && sameId(row.event_id, eventId)
    ) || null
  );
}

export function addAttendance(studentId, eventId) {
  const db = read();
  db.attendance.push({ student_id: studentId, event_id: eventId });
  write(db);
}

export function isHostSessionValid(hostInfo) {
  if (!hostInfo?.id) return false;
  const host = getHostSession(hostInfo.id);
  return Boolean(host && host.current_session === hostInfo.current_session);
}
