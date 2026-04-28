import { useState } from "react";
import type { Task } from "../types";
import { timeAgo } from "../format";

export function TaskCard({ task }: { task: Task }) {
  const [expanded, setExpanded] = useState(false);
  const [resolving, setResolving] = useState(false);

  const isBlocked = task.status === "blocked";
  const blocked = task.blocked;

  async function handleResolveBlocker(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.checked) return;
    setResolving(true);
    try {
      await fetch(`/api/tasks/${task.id}/resolve-blocker`, { method: "POST" });
    } catch (err) {
      console.error("Failed to resolve blocker:", err);
      setResolving(false);
    }
  }

  return (
    <div
      className={`task-card ${isBlocked ? "task-card--blocked" : ""}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="task-card__header">
        <span className="task-card__id">#{task.id}</span>
        {isBlocked && <span className="task-card__badge badge--blocked">BLOCKED</span>}
        {task.devIterations > 0 && (
          <span className="task-card__badge badge--iterations">
            {task.devIterations} {task.devIterations === 1 ? "iteration" : "iterations"}
          </span>
        )}
      </div>

      <h3 className="task-card__title">{task.title}</h3>

      {!expanded && task.description && (
        <p className="task-card__preview">
          {task.description.slice(0, 120)}
          {task.description.length > 120 ? "..." : ""}
        </p>
      )}

      {isBlocked && blocked && (
        <div className="task-card__blocked">
          {blocked.summary && (
            <p className="task-card__blocked-line">
              <strong>Summary:</strong> {blocked.summary}
            </p>
          )}
          {blocked.nextStep && (
            <p className="task-card__blocked-line">
              <strong>Next:</strong> {blocked.nextStep}
            </p>
          )}
          {expanded && blocked.impact && (
            <p className="task-card__blocked-line">
              <strong>Impact:</strong> {blocked.impact}
            </p>
          )}
          {expanded && blocked.needs && (
            <p className="task-card__blocked-line">
              <strong>Needs:</strong> {blocked.needs}
            </p>
          )}
          <div
            className="task-card__resolve"
            onClick={(e) => e.stopPropagation()}
          >
            <label className="task-card__resolve-label">
              <input
                type="checkbox"
                checked={resolving}
                disabled={resolving}
                onChange={handleResolveBlocker}
              />
              {" Blocker resolved"}
            </label>
          </div>
        </div>
      )}

      {expanded && task.description && (
        <pre className="task-card__description">{task.description}</pre>
      )}

      <div className="task-card__footer">
        {task.updatedAt && (
          <span className="task-card__time">{timeAgo(task.updatedAt)}</span>
        )}
        <span className="task-card__expand">
          {expanded ? "collapse" : "details"}
        </span>
      </div>
    </div>
  );
}
