"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addEvent as createEvent,
  deleteEvent as removeEvent,
  getEvents,
  setEventOpen,
} from "../../lib/db";
import AppShell from "../../components/AppShell";

export default function EventsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("add");
  const [events, setEvents] = useState([]);
  const [newEventName, setNewEventName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setEvents(getEvents());
  };

  const addEvent = async () => {
    if (!newEventName.trim()) return alert("Enter event name");

    setLoading(true);
    createEvent(newEventName.trim());
    alert("Event added!");
    setNewEventName("");
    fetchEvents();
    setLoading(false);
  };

  const closeEvent = async (id) => {
    setEventOpen(id, false);
    alert("Event closed");
    fetchEvents();
  };

  const openEvent = async (id) => {
    setEventOpen(id, true);
    alert("Event reopened");
    fetchEvents();
  };

  const deleteEvent = async (id) => {
    const confirmDelete = confirm(
      "Are you sure you want to delete this event? This cannot be undone."
    );

    if (!confirmDelete) return;

    removeEvent(id);
    alert("Event deleted");
    fetchEvents();
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
                <div key={evt.id} className="row-between">
                  <span>
                    {evt.name}
                    <span className="muted"> {evt.is_open ? "· Open" : "· Closed"}</span>
                  </span>
                  <div className="row">
                    {evt.is_open ? (
                      <button className="btn btn-sm btn-ghost" onClick={() => closeEvent(evt.id)}>
                        Close
                      </button>
                    ) : (
                      <button className="btn btn-sm" onClick={() => openEvent(evt.id)}>
                        Open
                      </button>
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
