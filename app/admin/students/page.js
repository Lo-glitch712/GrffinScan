"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { deleteStudentsByIds, getStudents, updateStudent } from "../../lib/db";
import AppShell from "../../components/AppShell";

export default function AdminStudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState([]);
  const [editing, setEditing] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const pressTimer = useRef(0);
  const pressedId = useRef(null);
  const pressStart = useRef({ x: 0, y: 0 });
  const justArmed = useRef(false);

  const [formData, setFormData] = useState({
    id: "",
    firstname: "",
    lastname: "",
    middlename: "",
    sex: "",
    course: "",
    yearsection: "",
  });

  useEffect(() => {
    const adminInfo = sessionStorage.getItem("adminInfo");
    if (!adminInfo) {
      router.push("/host");
    }
  }, [router]);

  const fetchStudents = async () => {
    const data = [...(await getStudents())].sort((a, b) =>
      String(b.created_at || "").localeCompare(String(a.created_at || ""))
    );
    setStudents(data);
    setFiltered(data);
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    const result = students.filter((s) =>
      String(s.id).toLowerCase().includes(search.toLowerCase()) ||
      s.firstname.toLowerCase().includes(search.toLowerCase()) ||
      s.lastname.toLowerCase().includes(search.toLowerCase()) ||
      String(s.middlename || "").toLowerCase().includes(search.toLowerCase())
    );
    setFiltered(result);
    setSelected((current) => current.filter((id) => result.some((student) => student.id === id)));
  }, [search, students]);

  const handleEdit = (student) => {
    setEditing(student);
    setFormData(student);
  };

  const handleUpdate = async () => {
    await updateStudent(formData.id, {
      firstname: formData.firstname,
      lastname: formData.lastname,
      middlename: formData.middlename || "",
      sex: formData.sex || "",
      course: formData.course,
      yearsection: formData.yearsection,
    });
    alert("Student updated!");
    setEditing(null);
    fetchStudents();
  };

  const enterSelectMode = (id) => {
    setSelecting(true);
    setSelected((current) => (current.includes(id) ? current : [...current, id]));
  };

  const toggleStudent = (id) => {
    if (!selecting) return;
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((student) => selected.includes(student.id));

  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      const visible = new Set(filtered.map((student) => student.id));
      setSelected((current) => current.filter((id) => !visible.has(id)));
      return;
    }
    setSelected((current) => [...new Set([...current, ...filtered.map((student) => student.id)])]);
  };

  const startPress = (studentId, event) => {
    if (selecting) return;
    if (event.target.closest("button, input, a")) return;
    pressedId.current = studentId;
    pressStart.current = { x: event.clientX, y: event.clientY };
    window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      if (pressedId.current === studentId) {
        justArmed.current = true;
        enterSelectMode(studentId);
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

  const deleteSelected = async () => {
    if (!selected.length || deleting) return;
    setDeleting(true);
    try {
      await deleteStudentsByIds(selected);
      setSelected([]);
      setSelecting(false);
      setConfirmDelete(false);
      await fetchStudents();
    } catch (err) {
      alert(err?.message || "Could not delete students.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell title="Students" wide backTo="/admin">
      <div className="stack-wide">
        <div className="card">
          <h3>Search</h3>
          <input
            className="field"
            type="text"
            placeholder="ID, first name, or last name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="card">
          <div className="row-between">
            <h3>Student List</h3>
            {selecting ? (
              <button
                className="btn btn-sm btn-danger"
                onClick={() => setConfirmDelete(true)}
                disabled={!selected.length}
              >
                Delete selected{selected.length ? ` (${selected.length})` : ""}
              </button>
            ) : null}
          </div>
          <div className="table-wrap">
            <table className={selecting ? "table is-selecting" : "table"}>
              <thead>
                <tr>
                  <th className="select-col">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleAllFiltered}
                      aria-label="Select all students"
                    />
                  </th>
                  <th>ID</th>
                  <th>Last name</th>
                  <th>First name</th>
                  <th>Middle name</th>
                  <th>Sex</th>
                  <th>Course</th>
                  <th>Year & Section</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student) => (
                  <tr
                    key={student.id}
                    className={selected.includes(student.id) ? "is-selected" : ""}
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
                      if (selecting) toggleStudent(student.id);
                    }}
                  >
                    <td className="select-col" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.includes(student.id)}
                        onChange={() => toggleStudent(student.id)}
                        aria-label={`Select ${student.id}`}
                      />
                    </td>
                    <td>{student.id}</td>
                    <td>{student.lastname}</td>
                    <td>{student.firstname}</td>
                    <td>{student.middlename || ""}</td>
                    <td>{student.sex || ""}</td>
                    <td>{student.course}</td>
                    <td>{student.yearsection}</td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <button className="btn btn-sm" onClick={() => handleEdit(student)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editing && (
        <div className="overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Student</h3>
            <input
              className="field"
              value={formData.lastname}
              onChange={(e) =>
                setFormData({ ...formData, lastname: e.target.value })
              }
              placeholder="Last name"
            />
            <input
              className="field"
              value={formData.firstname}
              onChange={(e) =>
                setFormData({ ...formData, firstname: e.target.value })
              }
              placeholder="First name"
            />
            <input
              className="field"
              value={formData.middlename || ""}
              onChange={(e) =>
                setFormData({ ...formData, middlename: e.target.value })
              }
              placeholder="Middle name"
            />
            <input
              className="field"
              value={formData.sex || ""}
              onChange={(e) =>
                setFormData({ ...formData, sex: e.target.value })
              }
              placeholder="Sex"
            />
            <input
              className="field"
              value={formData.course}
              onChange={(e) =>
                setFormData({ ...formData, course: e.target.value })
              }
              placeholder="Course"
            />
            <input
              className="field"
              value={formData.yearsection}
              onChange={(e) =>
                setFormData({ ...formData, yearsection: e.target.value })
              }
              placeholder="Year & Section"
            />
            <button className="btn" onClick={handleUpdate}>Save</button>
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      {confirmDelete && createPortal(
        <div className="overlay" onClick={() => setConfirmDelete(false)}>
          <div className="modal modal-solid confirm-dialog" onClick={(event) => event.stopPropagation()}>
            <h3>Delete selected students?</h3>
            <p className="muted">
              This will remove {selected.length} student{selected.length === 1 ? "" : "s"} and their attendance. It cannot be undone.
            </p>
            <div className="confirm-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={deleteSelected} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete selected"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </AppShell>
  );
}
