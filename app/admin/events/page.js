"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addEvent as createEvent,
  deleteEvent as removeEvent,
  getEvents,
  setEventOpen,
  setEventTime,
} from "../../lib/db";
import AppShell from "../../components/AppShell";
import DateTimePicker from "../../components/DateTimePicker";

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

export default function EventsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("add");
  const [events, setEvents] = useState([]);
  const [newEventName, setNewEventName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [times, setTimes] = useState({});

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    const list = getEvents();
    setEvents(list);
    setTimes(
      Object.fromEntries(
        list.map((event) => {
          const start = splitStamp(event.starts_at);
          const end = splitStamp(event.ends_at);
          return [
            event.id,
            {
              date: start.date || end.date,
              time: start.time,
              endTime: end.time,
            },
          ];
        })
      )
    );
  };

  const addEvent = async () => {
    if (!newEventName.trim()) return alert("Enter event name");
    const schedule = buildSchedule(newDate, newTime, newEndTime);
    if (schedule.error) return alert(schedule.error);

    setLoading(true);
    createEvent(newEventName.trim(), {
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

  const saveTime = (id) => {
    const current = times[id] || {};
    const schedule = buildSchedule(current.date, current.time, current.endTime);
    if (schedule.error) return alert(schedule.error);
    setEventTime(id, {
      starts_at: schedule.starts_at,
      ends_at: schedule.ends_at,
    });
    alert("Event time saved");
    fetchEvents();
  };

  const closeEvent = async (id) => {
    setEventOpen(id, false);
    fetchEvents();
  };

  const openEvent = async (id) => {
    setEventOpen(id, true);
    fetchEvents();
  };

  const deleteEvent = async (id) => {
    if (!confirm("Are you sure you want to delete this event? This cannot be undone.")) return;
    removeEvent(id);
    fetchEvents();
  };

  const updateTime = (id, key, value) => {
    setTimes((current) => ({
      ...current,
      [id]: { ...current[id], [key]: value },
    }));
  };

  return (
    <AppShell title="Events">
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
          <div className="card">
            <h2>Manage Events</h2>
            {events.length === 0 ? (
              <p className="muted">No events available.</p>
            ) : (
              events.map((evt) => (
                <div key={evt.id} className="event-item">
                  <div>
                    <strong>{evt.name}</strong>
                    <p className="muted">
                      {eventStatus(evt)}
                      {evt.starts_at || evt.ends_at
                        ? ` · ${formatTime(evt.starts_at)} → ${formatTime(evt.ends_at)}`
                        : ""}
                    </p>
                  </div>
                  <ScheduleFields
                    date={times[evt.id]?.date || ""}
                    time={times[evt.id]?.time || ""}
                    endTime={times[evt.id]?.endTime || ""}
                    onDate={(value) => updateTime(evt.id, "date", value)}
                    onTime={(value) => updateTime(evt.id, "time", value)}
                    onEndTime={(value) => updateTime(evt.id, "endTime", value)}
                  />
                  <div className="row">
                    <button className="btn btn-sm" onClick={() => saveTime(evt.id)}>
                      Save time
                    </button>
                    {!(evt.starts_at || evt.ends_at) && (
                      evt.is_open ? (
                        <button className="btn btn-sm btn-ghost" onClick={() => closeEvent(evt.id)}>
                          Close
                        </button>
                      ) : (
                        <button className="btn btn-sm" onClick={() => openEvent(evt.id)}>
                          Open
                        </button>
                      )
                    )}
                    <button className="btn btn-sm btn-danger" onClick={() => deleteEvent(evt.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <button className="btn btn-ghost" onClick={() => router.push("/admin")}>
          Back
        </button>
      </div>
    </AppShell>
  );
}
