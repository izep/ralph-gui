import { useEffect, useRef } from "react";

export function LogViewer({
  lines,
  onClose,
}: {
  lines: string[];
  onClose: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length]);

  return (
    <div className="log-viewer">
      <div className="log-viewer__header">
        <span className="log-viewer__title">Output Log</span>
        <span className="log-viewer__count">{lines.length} lines</span>
        <button className="log-viewer__close" onClick={onClose}>
          &times;
        </button>
      </div>
      <div className="log-viewer__body">
        {lines.length === 0 ? (
          <span className="log-viewer__empty">No output yet</span>
        ) : (
          lines.map((line, i) => (
            <div
              key={i}
              className={`log-line ${
                line.startsWith("[stderr]")
                  ? "log-line--error"
                  : line.startsWith("[system]")
                    ? "log-line--system"
                    : ""
              }`}
            >
              {line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
