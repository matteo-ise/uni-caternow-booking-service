import { useState } from "react";

/**
 * Leichtgewicht-Accordion für Mehrfachinhalte.
 * - title: Überschrift
 * - children: Inhalt (z. B. Checkboxlisten)
 * - defaultOpen: optional (bool)
 */
export default function Accordion({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="acc">
      <button
        type="button"
        className="acc-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className="acc-icon">{open ? "–" : "+"}</span>
      </button>
      {open && <div className="acc-body">{children}</div>}
    </div>
  );
}
