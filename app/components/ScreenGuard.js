"use client";

import { useEffect } from "react";

function block() {
  document.documentElement.classList.add("screenshot-blocked");
}

function unblock() {
  document.documentElement.classList.remove("screenshot-blocked");
}

export default function ScreenGuard({ children }) {
  useEffect(() => {
    unblock();

    const onVisibility = () => {
      if (document.hidden) block();
      else unblock();
    };

    const onKey = (event) => {
      const isPrintScreen = event.key === "PrintScreen";
      const isMacCapture =
        event.metaKey &&
        event.shiftKey &&
        ["3", "4", "5"].includes(event.key);

      if (!isPrintScreen && !isMacCapture) return;

      event.preventDefault();
      block();
      navigator.clipboard?.writeText?.("").catch(() => {});
      window.setTimeout(unblock, 800);
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", block);
    window.addEventListener("pageshow", unblock);
    document.addEventListener("keydown", onKey);
    window.addEventListener("beforeprint", block);
    window.addEventListener("afterprint", unblock);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", block);
      window.removeEventListener("pageshow", unblock);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeprint", block);
      window.removeEventListener("afterprint", unblock);
      unblock();
    };
  }, []);

  return children;
}
