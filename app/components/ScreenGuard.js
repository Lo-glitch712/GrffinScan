"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function block() {
  document.documentElement.classList.add("screenshot-blocked");
}

function unblock() {
  document.documentElement.classList.remove("screenshot-blocked");
}

function isCaptureKey(event, winHeld) {
  const key = event.key;
  const code = event.code;
  if (key === "PrintScreen" || code === "PrintScreen") return true;
  if (event.metaKey && event.shiftKey && ["3", "4", "5", "6"].includes(key)) return true;
  if (winHeld && event.shiftKey && key.toLowerCase() === "s") return true;
  return false;
}

export default function ScreenGuard({ children }) {
  const pathname = usePathname();
  const qrScreen = pathname === "/student/qr";

  useEffect(() => {
    unblock();

    let winHeld = false;
    let holdTimer = 0;

    const flashBlack = () => {
      block();
      navigator.clipboard?.writeText?.("").catch(() => {});
      window.clearTimeout(holdTimer);
      holdTimer = window.setTimeout(unblock, 1200);
    };

    const onVisibility = () => {
      if (document.hidden) block();
      else unblock();
    };

    const onKeyDown = (event) => {
      if (event.key === "Meta" || event.key === "OS") winHeld = true;
      if (!isCaptureKey(event, winHeld)) return;
      event.preventDefault();
      flashBlack();
    };

    const onKeyUp = (event) => {
      if (event.key === "Meta" || event.key === "OS") winHeld = false;
      if (event.key === "PrintScreen" || event.code === "PrintScreen") flashBlack();
    };

    const blockSave = (event) => {
      if (!qrScreen) return;
      event.preventDefault();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", block);
    window.addEventListener("pageshow", unblock);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    window.addEventListener("beforeprint", block);
    window.addEventListener("afterprint", unblock);
    document.addEventListener("freeze", block);
    document.addEventListener("resume", unblock);

    if (qrScreen) {
      document.documentElement.classList.add("qr-screen");
      document.addEventListener("copy", blockSave);
      document.addEventListener("cut", blockSave);
      document.addEventListener("contextmenu", blockSave);
      document.addEventListener("dragstart", blockSave);
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", block);
      window.removeEventListener("pageshow", unblock);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("beforeprint", block);
      window.removeEventListener("afterprint", unblock);
      document.removeEventListener("freeze", block);
      document.removeEventListener("resume", unblock);
      document.removeEventListener("copy", blockSave);
      document.removeEventListener("cut", blockSave);
      document.removeEventListener("contextmenu", blockSave);
      document.removeEventListener("dragstart", blockSave);
      document.documentElement.classList.remove("qr-screen");
      window.clearTimeout(holdTimer);
      unblock();
    };
  }, [qrScreen]);

  return children;
}
