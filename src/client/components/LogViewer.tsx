import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const MIN_HEIGHT = 120;
const DEFAULT_HEIGHT = 220;
const MAX_VIEWPORT_RATIO = 0.75;

export function LogViewer({
  lines,
  onClose,
}: {
  lines: string[];
  onClose: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const resizeStateRef = useRef<{ startY: number; startHeight: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.scrollTop = body.scrollHeight;
  }, [lines.length]);

  const stopResize = useCallback(() => {
    resizeStateRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const onResizeMove = useCallback((event: PointerEvent) => {
    const resizeState = resizeStateRef.current;
    if (!resizeState) return;
    const delta = resizeState.startY - event.clientY;
    const maxHeight = Math.max(
      MIN_HEIGHT,
      Math.floor(window.innerHeight * MAX_VIEWPORT_RATIO),
    );
    const nextHeight = Math.min(
      maxHeight,
      Math.max(MIN_HEIGHT, resizeState.startHeight + delta),
    );
    setHeight(nextHeight);
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onResizeMove);
    window.addEventListener("pointerup", stopResize);
    return () => {
      window.removeEventListener("pointermove", onResizeMove);
      window.removeEventListener("pointerup", stopResize);
    };
  }, [onResizeMove, stopResize]);

  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    resizeStateRef.current = {
      startY: event.clientY,
      startHeight: height,
    };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }

  return (
    <div className="log-viewer" style={{ height }}>
      <div
        className="log-viewer__resize-handle"
        onPointerDown={startResize}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize output log"
      />
      <div className="log-viewer__header">
        <span className="log-viewer__title">Output Log</span>
        <span className="log-viewer__count">{lines.length} lines</span>
        <button className="log-viewer__close" onClick={onClose}>
          &times;
        </button>
      </div>
      <div className="log-viewer__body" ref={bodyRef}>
        {lines.length === 0
          ? <span className="log-viewer__empty">No output yet</span>
          : (
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
      </div>
    </div>
  );
}
