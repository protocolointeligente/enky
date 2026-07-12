"use client";

import { useEffect, useState } from "react";

// Alterna tema em ciclo: sistema → claro → escuro → sistema. A preferência
// ('enky-theme') persiste no localStorage; o tema resolvido é aplicado em
// data-theme do <html>. O script anti-flash no layout aplica antes da 1ª pintura.
type Pref = "system" | "light" | "dark";

function resolve(pref: Pref): "light" | "dark" {
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const NEXT: Record<Pref, Pref> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Pref, string> = { system: "Sistema", light: "Claro", dark: "Escuro" };

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [pref, setPref] = useState<Pref>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem("enky-theme") as Pref | null) ?? "system";
    setPref(stored);
    setReady(true);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (((localStorage.getItem("enky-theme") as Pref | null) ?? "system") === "system") {
        document.documentElement.dataset.theme = resolve("system");
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function cycle() {
    const next = NEXT[pref];
    setPref(next);
    localStorage.setItem("enky-theme", next);
    document.documentElement.dataset.theme = resolve(next);
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Tema: ${LABEL[pref]}. Clique para alternar.`}
      title={`Tema: ${LABEL[pref]}`}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-line-strong hover:text-ink ${className}`}
    >
      {/* Evita mismatch de hidratação: ícone neutro até ler a preferência. */}
      <span aria-hidden="true">{ready ? <Icon pref={pref} /> : <MonitorIcon />}</span>
    </button>
  );
}

function Icon({ pref }: { pref: Pref }) {
  if (pref === "light") return <SunIcon />;
  if (pref === "dark") return <MoonIcon />;
  return <MonitorIcon />;
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function MonitorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
