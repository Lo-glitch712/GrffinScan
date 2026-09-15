"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function paintBlack() {
  document.documentElement.classList.add("screenshot-blocked");
  const veil = document.getElementById("screenshot-veil");
  if (veil) {
    veil.hidden = false;
    veil.style.opacity = "1";
  }
  void document.documentElement.offsetHeight;
  void document.body?.getBoundingClientRect();
}

function paintClear() {
  document.documentElement.classList.remove("screenshot-blocked");
  const veil = document.getElementById("screenshot-veil");
  if (veil) {
    veil.style.opacity = "0";
    veil.hidden = true;
  }
}

function isCaptureKey(event, winHeld) {
  const key = event.key;
  const code = event.code;
  if (key === "PrintScreen" || code === "PrintScreen") return true;
  if (event.metaKey && event.shiftKey && ["3", "4", "5", "6"].includes(key)) return true;
  if ((winHeld || event.metaKey) && event.shiftKey && key.toLowerCase() === "s") return true;
  return false;
}

export default function ScreenGuard({ children }) {
  const pathname = usePathname();
  const qrScreen = pathname?.startsWith("/student/qr");

  useEffect(() => {
    paintClear();

    let winHeld = false;
    let holdTimer = 0;

    const holdBlack = (ms = 2000) => {
      paintBlack();
      navigator.clipboard?.writeText?.("").catch(() => {});
      window.clearTimeout(holdTimer);
      holdTimer = window.setTimeout(() => {
        if (!document.hidden) paintClear();
      }, ms);
    };

    const onVisibility = () => {
      if (document.hidden) paintBlack();
      else paintClear();
    };

    const onKeyDown = (event) => {
      if (event.key === "Meta" || event.key === "OS") winHeld = true;
      const winShift = (winHeld || event.metaKey || event.getModifierState?.("OS")) && event.shiftKey;
      if (qrScreen && winShift) {
        event.preventDefault();
        holdBlack(2500);
        return;
      }
      if (!isCaptureKey(event, winHeld)) return;
      event.preventDefault();
      event.stopPropagation();
      holdBlack(2500);
    };

    const onKeyUp = (event) => {
      if (event.key === "Meta" || event.key === "OS") winHeld = false;
      if (event.key === "PrintScreen" || event.code === "PrintScreen") holdBlack(2500);
    };

    const blockSave = (event) => {
      if (!qrScreen) return;
      event.preventDefault();
    };

    const onBlur = () => {
      if (qrScreen) paintBlack();
    };

    const onFocus = () => {
      if (qrScreen && !document.hidden) paintClear();
    };

    const opts = { capture: true };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", paintBlack);
    window.addEventListener("pageshow", paintClear);
    window.addEventListener("keydown", onKeyDown, opts);
    window.addEventListener("keyup", onKeyUp, opts);
    window.addEventListener("beforeprint", paintBlack);
    window.addEventListener("afterprint", paintClear);
    document.addEventListener("freeze", paintBlack);
    document.addEventListener("resume", paintClear);

    if (qrScreen) {
      document.documentElement.classList.add("qr-screen");
      window.addEventListener("blur", onBlur);
      window.addEventListener("focus", onFocus);
      document.addEventListener("copy", blockSave, opts);
      document.addEventListener("cut", blockSave, opts);
      document.addEventListener("contextmenu", blockSave, opts);
      document.addEventListener("dragstart", blockSave, opts);
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", paintBlack);
      window.removeEventListener("pageshow", paintClear);
      window.removeEventListener("keydown", onKeyDown, opts);
      window.removeEventListener("keyup", onKeyUp, opts);
      window.removeEventListener("beforeprint", paintBlack);
      window.removeEventListener("afterprint", paintClear);
      document.removeEventListener("freeze", paintBlack);
      document.removeEventListener("resume", paintClear);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("copy", blockSave, opts);
      document.removeEventListener("cut", blockSave, opts);
      document.removeEventListener("contextmenu", blockSave, opts);
      document.removeEventListener("dragstart", blockSave, opts);
      document.documentElement.classList.remove("qr-screen");
      window.clearTimeout(holdTimer);
      paintClear();
    };
  }, [qrScreen]);

  return (
    <>
      {children}
      <div id="screenshot-veil" className="screenshot-veil" hidden aria-hidden="true" />
    </>
  );
}
