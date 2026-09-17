const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");

function studentLoginPassword(firstname, lastname, studentId) {
  const first = String(firstname || "").trim().charAt(0).toUpperCase();
  const last = String(lastname || "").trim().replace(/\s+/g, "");
  const lastNumber = String(studentId || "").replace(/\D/g, "").slice(-1);
  return `${first}${last}${lastNumber}`;
}

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
  }
  return env;
}

function yearSectionFromRow(row) {
  const section = String(row.Section || "").trim().toUpperCase();
  const fromSection = section.match(/(\d+[A-Z]?)\s*$/);
  if (fromSection?.[1]) return fromSection[1];
  return String(row.Year ?? "").trim();
}

function parseEnrollment(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { range: 8, defval: "" });
  const byId = new Map();

  for (const row of rows) {
    const id = String(row.Code || "").trim();
    const lastname = String(row["Last Name"] || "").trim();
    const firstname = String(row["First Name"] || "").trim();
    if (!id || !lastname || !firstname) continue;
    byId.set(id, {
      id,
      lastname,
      firstname,
      middlename: String(row["Middle Name"] || "").trim(),
      sex: String(row.Sex || "").trim(),
      course: String(row.Course || "").trim(),
      yearsection: yearSectionFromRow(row),
      password: studentLoginPassword(firstname, lastname, id),
    });
  }

  return [...byId.values()];
}

function toRows(students, { extra, password, mergeName }) {
  return students.map((student) => {
    const firstname = mergeName
      ? [student.firstname, student.middlename].filter(Boolean).join(" ")
      : student.firstname;
    const row = {
      id: student.id,
      lastname: student.lastname,
      firstname,
      course: student.course,
      yearsection: student.yearsection,
    };
    if (extra) {
      row.middlename = student.middlename;
      row.sex = student.sex;
    }
    if (password) row.password = student.password;
    return row;
  });
}

async function upsertAll(supabase, students, options) {
  const chunkSize = 80;
  const rows = toRows(students, options);
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("students").upsert(chunk, { onConflict: "id" });
    if (error) throw error;
    console.log(`Saved ${Math.min(i + chunkSize, rows.length)} / ${rows.length}`);
  }
}

async function main() {
  const env = loadEnv();
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://evxtsgaalqdfsueuxfgr.supabase.co";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "sb_publishable_nxZC6BKIy5O3QmBgKhudLA_eHNYSv2O";
  const file = process.argv[2] || "d:/Enrollment List.xlsx";

  if (!fs.existsSync(file)) {
    throw new Error(`Enrollment file not found: ${file}`);
  }

  const students = parseEnrollment(file);
  console.log(`Parsed ${students.length} students from enrollment list`);
  const sample = students[0];
  if (sample) {
    console.log(`Sample: ${sample.id} ${sample.lastname}, ${sample.firstname} ${sample.middlename} · ${sample.course} ${sample.yearsection}`);
  }

  const supabase = createClient(url, key);
  const attempts = [
    { extra: true, password: true, mergeName: false },
    { extra: false, password: true, mergeName: true },
    { extra: false, password: false, mergeName: true },
  ];

  let lastError;
  for (const options of attempts) {
    try {
      await upsertAll(supabase, students, options);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      console.warn(`Retrying (${error.message || error})`);
    }
  }
  if (lastError) throw lastError;

  const { count, error } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .not("id", "like", "__gs_%");
  if (error) throw error;
  console.log(`Students in database: ${count}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
