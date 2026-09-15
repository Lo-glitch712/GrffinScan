"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStudents, updateStudent } from "../../lib/db";
import AppShell from "../../components/AppShell";

export default function AdminStudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState([]);
  const [editing, setEditing] = useState(null);

  const [formData, setFormData] = useState({
    id: "",
    firstname: "",
    lastname: "",
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
      s.lastname.toLowerCase().includes(search.toLowerCase())
    );
    setFiltered(result);
  }, [search, students]);

  const handleEdit = (student) => {
    setEditing(student);
    setFormData(student);
  };

  const handleUpdate = async () => {
    await updateStudent(formData.id, {
      firstname: formData.firstname,
      lastname: formData.lastname,
      course: formData.course,
      yearsection: formData.yearsection,
    });
    alert("Student updated!");
    setEditing(null);
    fetchStudents();
  };

  return (
    <AppShell title="Students" wide>
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
          <h3>Student List</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Last name</th>
                  <th>First name</th>
                  <th>Course</th>
                  <th>Year & Section</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student) => (
                  <tr key={student.id}>
                    <td>{student.id}</td>
                    <td>{student.lastname}</td>
                    <td>{student.firstname}</td>
                    <td>{student.course}</td>
                    <td>{student.yearsection}</td>
                    <td>
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

        <button className="btn btn-ghost" onClick={() => router.push("/admin")}>
          Back
        </button>
      </div>

      {editing && (
        <div className="overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Student</h3>
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
              value={formData.lastname}
              onChange={(e) =>
                setFormData({ ...formData, lastname: e.target.value })
              }
              placeholder="Last name"
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
    </AppShell>
  );
}
