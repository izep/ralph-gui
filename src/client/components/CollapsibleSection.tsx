import React from "react";

export function CollapsibleSection({
  id,
  title,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`control-panel__section collapsible-section ${
        expanded ? "collapsible-section--expanded" : "collapsible-section--collapsed"
      }`}
      data-id={id}
    >
      <div
        className="collapsible-section__header"
        onClick={onToggle}
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggle();
        }}
      >
        <h3>{title}</h3>
        <span className="collapsible-section__chevron" aria-hidden>
          ▼
        </span>
      </div>

      <div className="collapsible-section__body">{children}</div>
    </section>
  );
}
