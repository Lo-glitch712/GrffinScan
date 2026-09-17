"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const WHEEL_COPIES = 5;

function pad(value) {
  return String(value).padStart(2, "0");
}

function parseDateValue(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function parseTimeValue(value) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value || "");
  if (!match) return null;
  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date;
}

function toDateValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeValue(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateLabel(value) {
  const date = parseDateValue(value);
  if (!date) return "";
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatTimeLabel(value) {
  const date = parseTimeValue(value);
  if (!date) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function InfiniteWheel({ values, selected, onChange, format = pad }) {
  const colRef = useRef(null);
  const jumping = useRef(false);
  const timer = useRef(0);

  const items = useMemo(() => {
    const list = [];
    for (let copy = 0; copy < WHEEL_COPIES; copy += 1) {
      for (const value of values) list.push({ copy, value });
    }
    return list;
  }, [values]);

  const centerOn = (value) => {
    const col = colRef.current;
    if (!col) return;
    const buttons = col.querySelectorAll("button");
    const index = values.indexOf(value);
    const target = buttons[Math.floor(WHEEL_COPIES / 2) * values.length + Math.max(0, index)];
    if (!target) return;
    jumping.current = true;
    col.scrollTop = target.offsetTop - col.clientHeight / 2 + target.offsetHeight / 2;
    window.setTimeout(() => {
      jumping.current = false;
    }, 0);
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => centerOn(selected));
    return () => window.cancelAnimationFrame(frame);
  }, [selected]);

  const wrap = () => {
    const col = colRef.current;
    if (!col || !values.length) return;
    const itemHeight = col.querySelector("button")?.offsetHeight || 36;
    const loop = values.length * itemHeight;
    if (loop <= 0) return;
    if (col.scrollTop < loop) {
      jumping.current = true;
      col.scrollTop += loop;
      window.setTimeout(() => {
        jumping.current = false;
      }, 0);
    } else if (col.scrollTop > loop * (WHEEL_COPIES - 2)) {
      jumping.current = true;
      col.scrollTop -= loop;
      window.setTimeout(() => {
        jumping.current = false;
      }, 0);
    }
  };

  const snapNearest = () => {
    const col = colRef.current;
    if (!col) return;
    const center = col.scrollTop + col.clientHeight / 2;
    let best = null;
    let bestDist = Infinity;
    col.querySelectorAll("button").forEach((button) => {
      const mid = button.offsetTop + button.offsetHeight / 2;
      const dist = Math.abs(mid - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = button;
      }
    });
    if (!best) return;
    const next = Number(best.dataset.value);
    if (!Number.isNaN(next) && next !== selected) onChange(next);
    else centerOn(selected);
  };

  const onScroll = () => {
    if (jumping.current) return;
    wrap();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(snapNearest, 80);
  };

  return (
    <div className="time-col" ref={colRef} onScroll={onScroll}>
      {items.map((item) => (
        <button
          key={`${item.copy}-${item.value}`}
          type="button"
          data-value={item.value}
          className={item.value === selected ? "is-on" : ""}
          onClick={() => onChange(item.value)}
        >
          {format(item.value)}
        </button>
      ))}
    </div>
  );
}

export default function DateTimePicker({
  mode = "date",
  value,
  onChange,
  placeholder,
}) {
  const isTime = mode === "time";
  const rootRef = useRef(null);
  const popRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const selected = isTime
    ? parseTimeValue(value) || new Date()
    : parseDateValue(value) || new Date();
  const [view, setView] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1));

  useEffect(() => {
    const close = (event) => {
      if (rootRef.current?.contains(event.target) || popRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const place = (trigger) => {
    const rect = trigger.getBoundingClientRect();
    const width = isTime ? Math.max(rect.width, 168) : rect.width;
    setCoords({
      top: rect.bottom + 6,
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      width,
    });
  };

  useEffect(() => {
    if (!open) {
      setCoords(null);
      return undefined;
    }
    const trigger = rootRef.current?.querySelector(".datetime-trigger");
    const onPlace = (event) => {
      if (event?.target?.closest?.(".time-col, .cal-pop")) return;
      if (trigger) place(trigger);
    };
    onPlace();
    window.addEventListener("resize", onPlace);
    document.addEventListener("scroll", onPlace, true);
    return () => {
      window.removeEventListener("resize", onPlace);
      document.removeEventListener("scroll", onPlace, true);
    };
  }, [open, isTime]);

  const hour12 = ((selected.getHours() + 11) % 12) + 1;
  const minute = selected.getMinutes();
  const isPm = selected.getHours() >= 12;

  const days = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const start = first.getDay();
    const inMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < start; i += 1) {
      cells.push({
        date: new Date(view.getFullYear(), view.getMonth(), i - start + 1),
        outside: true,
      });
    }
    for (let day = 1; day <= inMonth; day += 1) {
      cells.push({ date: new Date(view.getFullYear(), view.getMonth(), day), outside: false });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const date = new Date(last);
      date.setDate(date.getDate() + 1);
      cells.push({ date, outside: true });
    }
    return cells;
  }, [view]);

  const currentTime = () => parseTimeValue(value) || new Date();

  const pickDay = (date) => {
    onChange?.(toDateValue(date));
    setOpen(false);
  };

  const setHour = (hour) => {
    const next = currentTime();
    next.setHours(isPm ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour);
    onChange?.(toTimeValue(next));
  };

  const setMinute = (mins) => {
    const next = currentTime();
    next.setMinutes(mins);
    onChange?.(toTimeValue(next));
  };

  const setPeriod = (pm) => {
    const next = currentTime();
    const hour = next.getHours() % 12;
    next.setHours(pm ? hour + 12 : hour);
    onChange?.(toTimeValue(next));
  };

  const pickToday = () => {
    const now = new Date();
    onChange?.(toDateValue(now));
    setView(new Date(now.getFullYear(), now.getMonth(), 1));
    setOpen(false);
  };

  const label = isTime ? formatTimeLabel(value) : formatDateLabel(value);
  const emptyText = placeholder || (isTime ? "Pick time" : "Pick date");

  return (
    <div className={open ? "datetime is-open" : "datetime"} ref={rootRef}>
      <button
        type="button"
        className="select-trigger datetime-trigger"
        onClick={(event) => {
          if (open) {
            setOpen(false);
            return;
          }
          if (!isTime) {
            const current = parseDateValue(value) || new Date();
            setView(new Date(current.getFullYear(), current.getMonth(), 1));
          }
          place(event.currentTarget);
          setOpen(true);
        }}
      >
        <span className={value ? "select-value" : "select-placeholder"}>
          {label || emptyText}
        </span>
        {isTime ? (
          <svg className="datetime-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.7" />
            <path d="M12 8v4.2l2.6 1.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        ) : (
          <svg className="datetime-icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
            <path d="M8 3.5v3.2M16 3.5v3.2M3.5 10h17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {open && coords && createPortal(
        <div
          className={isTime ? "cal-pop is-time" : "cal-pop"}
          ref={popRef}
          style={{ top: coords.top, left: coords.left, width: coords.width }}
        >
          {isTime ? (
            <div className="time-cols">
              <InfiniteWheel values={HOURS} selected={hour12} onChange={setHour} />
              <InfiniteWheel values={MINUTES} selected={minute} onChange={setMinute} />
              <div className="time-col time-period">
                <button
                  type="button"
                  className={!isPm ? "is-on" : ""}
                  onClick={() => setPeriod(false)}
                >
                  AM
                </button>
                <button
                  type="button"
                  className={isPm ? "is-on" : ""}
                  onClick={() => setPeriod(true)}
                >
                  PM
                </button>
              </div>
            </div>
          ) : (
            <div className="cal-main">
              <div className="cal-head">
                <strong>{MONTHS[view.getMonth()]} {view.getFullYear()}</strong>
                <div className="cal-navs">
                  <button
                    type="button"
                    className="cal-nav"
                    onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
                    aria-label="Previous month"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="cal-nav"
                    onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
                    aria-label="Next month"
                  >
                    ↓
                  </button>
                </div>
              </div>

              <div className="cal-week">
                {WEEKDAYS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className="cal-grid">
                {days.map(({ date, outside }) => {
                  const selectedDay = value && sameDay(date, selected);
                  const today = sameDay(date, new Date());
                  return (
                    <button
                      key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
                      type="button"
                      className={`cal-day${outside ? " is-out" : ""}${selectedDay ? " is-on" : ""}${today ? " is-today" : ""}`}
                      onClick={() => pickDay(date)}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>

              <div className="cal-foot">
                <button
                  type="button"
                  onClick={() => {
                    onChange?.("");
                    setOpen(false);
                  }}
                >
                  Clear
                </button>
                <button type="button" onClick={pickToday}>
                  Today
                </button>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
