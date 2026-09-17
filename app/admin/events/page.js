"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addEvent as createEvent,
  deleteEvent as removeEvent,
  getEvents,
  updateEvent,
} from "../../lib/db";
import AppShell from "../../components/AppShell";
import DateTimePicker from "../../components/DateTimePicker";
import Select from "../../components/Select";

function pad(value) {
  return String(value).padStart(2, "0");
}

function splitStamp(iso) {
  if (!iso) return { date: "", time: "" };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function toStamp(date, time) {
  if (!date || !time) return "";
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

function buildSchedule(date, time, endTime) {
  if (!date && !time && !endTime) return { starts_at: "", ends_at: "" };
  if (!date || !time || !endTime) {
    return { error: "Pick Event date, Time, and End Time." };
  }
  if (endTime <= time) {
    return { error: "End Time must be after Time." };
  }
  return {
    starts_at: toStamp(date, time),
    ends_at: toStamp(date, endTime),
  };
}

function formatTime(iso) {
  if (!iso) return "Not set";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function eventStatus(event) {
  const now = Date.now();
  const start = event.starts_at ? new Date(event.starts_at).getTime() : null;
  const end = event.ends_at ? new Date(event.ends_at).getTime() : null;

  if (start || end) {
    if (start && now < start) return "Scheduled";
    if (end && now >= end) return "Ended";
    return "Live";
  }

  return event.is_open ? "Open" : "Closed";
}

function eventDay(event) {
  const iso = event.starts_at || event.ends_at;
  if (!iso) return { key: "undated", label: "No date", sortAt: 0 };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { key: "undated", label: "No date", sortAt: 0 };
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return {
    key: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    label: start.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    sortAt: start.getTime(),
  };
}

function groupEventsByDay(events) {
  const buckets = new Map();
  for (const event of events) {
    const meta = eventDay(event);
    if (!buckets.has(meta.key)) buckets.set(meta.key, { ...meta, events: [] });
    buckets.get(meta.key).events.push(event);
  }
  return [...buckets.values()].sort((a, b) => b.sortAt - a.sortAt);
}

function ScheduleFields({ date, time, endTime, onDate, onTime, onEndTime }) {
  return (
    <>
      <label className="field-label">Event date</label>
      <DateTimePicker
        mode="date"
        value={date}
        onChange={onDate}
        placeholder="Pick event date"
      />
      <div className="time-pair">
        <div className="time-pair-field">
          <label className="field-label">Time</label>
          <DateTimePicker
            mode="time"
            value={time}
            onChange={onTime}
            placeholder="Start"
          />
        </div>
        <div className="time-pair-field">
          <label className="field-label">End Time</label>
          <DateTimePicker
            mode="time"
            value={endTime}
            onChange={onEndTime}
            placeholder="End"
          />
        </div>
      </div>
    </>
  );
}

function EventCard({ event, armed, onArm, onDisarm, onEdit, onDelete }) {
  const pressTimer = useRef(0);
  const pressed = useRef(false);
  const pressStart = useRef({ x: 0, y: 0 });
  const justArmed = useRef(false);

  const startPress = (eventObj) => {
    if (armed) return;
    if (eventObj.target.closest("button")) return;
    pressed.current = true;
    pressStart.current = { x: eventObj.clientX, y: eventObj.clientY };
    window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      if (pressed.current) {
        justArmed.current = true;
        onArm();
      }
    }, 520);
  };

  const movePress = (eventObj) => {
    const dx = eventObj.clientX - pressStart.current.x;
    const dy = eventObj.clientY - pressStart.current.y;
    if (Math.hypot(dx, dy) > 10) cancelPress();
  };

  const cancelPress = () => {
    pressed.current = false;
    window.clearTimeout(pressTimer.current);
  };

  return (
    <div
      className={armed ? "card att-card is-armed" : "card att-card"}
      onPointerDown={startPress}
      onPointerMove={movePress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      onContextMenu={(eventObj) => eventObj.preventDefault()}
      onClick={() => {
        if (justArmed.current) {
          justArmed.current = false;
          return;
        }
        if (armed) onDisarm();
      }}
    >
      <div>
        <strong>{event.name}</strong>
        <p className="muted">
          {eventStatus(event)}
          {event.starts_at || event.ends_at
            ? ` · ${formatTime(event.starts_at)} → ${formatTime(event.ends_at)}`
            : ""}
        </p>
      </div>
      {armed ? (
        <div className="row">
          <button
            className="btn btn-sm"
            onClick={(eventObj) => {
              eventObj.stopPropagation();
              onEdit(event);
            }}
          >
            Edit
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={(eventObj) => {
              eventObj.stopPropagation();
              onDelete(event);
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function EventsPage() {
  const [activeTab, setActiveTab] = useState("add");
  const [events, setEvents] = useState([]);
  const [sortBy, setSortBy] = useState("day");
  const [newEventName, setNewEventName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [armedId, setArmedId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", date: "", time: "", endTime: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setEvents(await getEvents());
  };

  const addEvent = async () => {
    if (!newEventName.trim()) return alert("Enter event name");
    const schedule = buildSchedule(newDate, newTime, newEndTime);
    if (schedule.error) return alert(schedule.error);

    setLoading(true);
    await createEvent(newEventName.trim(), {
      starts_at: schedule.starts_at,
      ends_at: schedule.ends_at,
    });
    alert("Event added!");
    setNewEventName("");
    setNewDate("");
    setNewTime("");
    setNewEndTime("");
    fetchEvents();
    setLoading(false);
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      await removeEvent(pendingDelete.id);
      setPendingDelete(null);
      setArmedId(null);
      await fetchEvents();
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to delete event.");
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (event) => {
    const start = splitStamp(event.starts_at);
    const end = splitStamp(event.ends_at);
    setEditing(event);
    setEditForm({
      name: event.name || "",
      date: start.date || end.date,
      time: start.time,
      endTime: end.time,
    });
  };

  const saveEdit = async () => {
    if (!editing || saving) return;
    if (!editForm.name.trim()) return alert("Enter event name");
    const schedule = buildSchedule(editForm.date, editForm.time, editForm.endTime);
    if (schedule.error) return alert(schedule.error);
    setSaving(true);
    try {
      await updateEvent(editing.id, {
        name: editForm.name.trim(),
        starts_at: schedule.starts_at,
        ends_at: schedule.ends_at,
      });
      setEditing(null);
      setArmedId(null);
      await fetchEvents();
    } catch (err) {
      alert(err.message || "Failed to save event.");
    } finally {
      setSaving(false);
    }
  };

  const eventCard = (event) => (
    <EventCard
      key={event.id}
      event={event}
      armed={armedId === event.id}
      onArm={() => setArmedId(event.id)}
      onDisarm={() => setArmedId(null)}
      onEdit={openEdit}
      onDelete={setPendingDelete}
    />
  );

  const grouped = sortBy === "day" ? groupEventsByDay(events) : null;

  return (
    <AppShell title="Events" backTo="/admin">
      <div className="stack">
        <div className="tabs">
          <button
            className={activeTab === "add" ? "tab is-on" : "tab"}
            onClick={() => setActiveTab("add")}
          >
            Add
          </button>
          <button
            className={activeTab === "manage" ? "tab is-on" : "tab"}
            onClick={() => setActiveTab("manage")}
          >
            Manage
          </button>
        </div>

        {activeTab === "add" && (
          <div className="card">
            <h2>Add Event</h2>
            <input
              className="field"
              type="text"
              placeholder="Event Name"
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
            />
            <ScheduleFields
              date={newDate}
              time={newTime}
              endTime={newEndTime}
              onDate={setNewDate}
              onTime={setNewTime}
              onEndTime={setNewEndTime}
            />
            <p className="muted">
              Event opens at Time. At End Time it closes, ready to move to your spreadsheet.
            </p>
            <button className="btn" onClick={addEvent} disabled={loading}>
              {loading ? "Adding..." : "Add Event"}
            </button>
          </div>
        )}

        {activeTab === "manage" && (
          <>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              placeholder="Sort by"
              options={[
                { value: "all", label: "All" },
                { value: "day", label: "By day" },
              ]}
            />

            {events.length === 0 ? (
              <p className="muted">No events available.</p>
            ) : grouped ? (
              grouped.map((group) => (
                <section key={group.key} className="stack">
                  <h3>{group.label}</h3>
                  {group.events.map(eventCard)}
                </section>
              ))
            ) : (
              events.map(eventCard)
            )}
          </>
        )}
      </div>

      {editing && createPortal(
        <div className="overlay" onClick={() => setEditing(null)}>
          <div className="modal modal-solid" onClick={(event) => event.stopPropagation()}>
            <h3>Edit Event</h3>
            <input
              className="field"
              type="text"
              placeholder="Event Name"
              value={editForm.name}
              onChange={(e) => setEditForm((current) => ({ ...current, name: e.target.value }))}
            />
            <ScheduleFields
              date={editForm.date}
              time={editForm.time}
              endTime={editForm.endTime}
              onDate={(value) => setEditForm((current) => ({ ...current, date: value }))}
              onTime={(value) => setEditForm((current) => ({ ...current, time: value }))}
              onEndTime={(value) => setEditForm((current) => ({ ...current, endTime: value }))}
            />
            <div className="confirm-actions">
              <button className="btn btn-ghost" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </button>
              <button className="btn" onClick={saveEdit} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {pendingDelete && createPortal(
        <div className="overlay" onClick={() => setPendingDelete(null)}>
          <div className="modal modal-solid confirm-dialog" onClick={(event) => event.stopPropagation()}>
            <h3>Are you sure you want to delete this event?</h3>
            <p className="muted">{pendingDelete.name}</p>
            <div className="confirm-actions">
              <button className="btn btn-ghost" onClick={() => setPendingDelete(null)} disabled={deleting}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </AppShell>
  );
}
