"use client";

import { useEffect, useRef, useState } from "react";

export default function Select({
  name,
  value,
  onChange,
  options = [],
  placeholder = "Select",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((option) => String(option.value) === String(value));

  useEffect(() => {
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const pick = (nextValue) => {
    setOpen(false);
    onChange?.({ target: { name, value: nextValue } });
  };

  return (
    <div className="select" ref={rootRef}>
      <button
        type="button"
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selected ? "select-value" : "select-placeholder"}>
          {selected ? selected.label : placeholder}
        </span>
        <span className={open ? "select-arrow is-open" : "select-arrow"} />
      </button>
      {open && (
        <ul className="select-menu" role="listbox">
          {options.map((option) => (
            <li key={String(option.value)}>
              <button
                type="button"
                role="option"
                className={String(option.value) === String(value) ? "is-on" : ""}
                aria-selected={String(option.value) === String(value)}
                onClick={() => pick(option.value)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
