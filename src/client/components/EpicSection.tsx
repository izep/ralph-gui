import { useState } from "react";

export function EpicSection({
  localEpic,
  onLocalEpicChange,
  epicFile,
  onEpicFileChange,
  repoLocked,
  epicConfigured,
  epicSaved,
  onSaveEpic,
  onRefreshBacklog,
  refreshing,
  isRunning,
  onSetEpicFile,
  onCreateEpicFile,
}: {
  localEpic: string;
  onLocalEpicChange: (v: string) => void;
  epicFile: string;
  onEpicFileChange: (v: string) => void;
  repoLocked: boolean;
  epicConfigured: boolean;
  epicSaved: boolean;
  onSaveEpic: () => void;
  onRefreshBacklog: () => void;
  refreshing: boolean;
  isRunning: boolean;
  onSetEpicFile?: (path: string) => Promise<{ ok: boolean; content?: string; notFound?: boolean }>;
  onCreateEpicFile?: (path: string) => Promise<{ ok: boolean; content?: string }>;
}) {
  const [epicFileError, setEpicFileError] = useState("");
  const [epicFileHint, setEpicFileHint] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [pendingCreatePath, setPendingCreatePath] = useState("");

  async function handleSetEpicFile() {
    if (!onSetEpicFile) return;
    setEpicFileError("");
    setEpicFileHint("");
    const result = await onSetEpicFile(epicFile);
    if (result.ok && result.content !== undefined) {
      onLocalEpicChange(result.content);
      setEpicFileHint("Loaded!");
      setTimeout(() => setEpicFileHint(""), 2000);
    } else if (!result.ok && result.notFound) {
      setPendingCreatePath(epicFile);
      setShowCreateDialog(true);
    } else if (!result.ok) {
      setEpicFileError("Failed to load epic file");
    }
  }

  async function handleCreateEpicFile() {
    if (!onCreateEpicFile) return;
    setShowCreateDialog(false);
    const result = await onCreateEpicFile(pendingCreatePath);
    if (result.ok && result.content !== undefined) {
      onLocalEpicChange(result.content);
      setEpicFileHint("Created!");
      setTimeout(() => setEpicFileHint(""), 2000);
    } else {
      setEpicFileError("Failed to create epic file");
    }
  }

  return (
    <section className="control-panel__section">
      <h3>Current Epic</h3>
      {repoLocked && (
        <p className="cp-hint">Set Repository first to edit the epic.</p>
      )}
      {!repoLocked && !epicConfigured && (
        <p className="cp-hint">The loop cannot start until this epic is filled out.</p>
      )}
      <fieldset className="cp-fieldset" disabled={repoLocked}>
      <label className="cp-field">
        <span>Epic File</span>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="text"
            value={epicFile}
            onChange={(e) => onEpicFileChange(e.target.value)}
            placeholder="ralph/epic.md"
            style={{ flex: 1 }}
          />
          {onSetEpicFile && (
            <button
              className="cp-btn"
              style={{ width: "auto", padding: "0 12px" }}
              onClick={handleSetEpicFile}
              disabled={repoLocked}
              title="Load epic content from this path (or create if not found)"
            >
              Set
            </button>
          )}
        </div>
      </label>
      {epicFileError && <p className="cp-error">{epicFileError}</p>}
      {epicFileHint && <p className="cp-status--ok">{epicFileHint}</p>}
      <p className="cp-hint">
        Path to the epic file, relative to the repo root. This is your living product document describing the current feature or goal.
        Ralph reads it to plan tasks and injects its content into every prompt. You own this file — edit it freely between sessions.
      </p>
      <textarea
        className="cp-textarea"
        rows={8}
        value={localEpic}
        onChange={(e) => onLocalEpicChange(e.target.value)}
        placeholder="Describe the current epic, scope boundaries, and success criteria..."
      />
      <button className="cp-btn" onClick={onSaveEpic}>
        {epicSaved ? "Saved!" : "Save Epic"}
      </button>
      <button
        className="cp-btn cp-btn--secondary"
        onClick={onRefreshBacklog}
        disabled={refreshing || isRunning}
        title={isRunning ? "Stop the loop first to refresh tasks" : "Re-run planning to refresh the backlog"}
      >
        {refreshing ? "Refreshing..." : "Refresh Tasks"}
      </button>
      </fieldset>

      {showCreateDialog && (
        <EpicFileDialog
          epicFile={pendingCreatePath}
          onCreate={handleCreateEpicFile}
          onCancel={() => setShowCreateDialog(false)}
        />
      )}
    </section>
  );
}

function EpicFileDialog({
  epicFile,
  onCreate,
  onCancel,
}: {
  epicFile: string;
  onCreate: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="cp-modal-overlay">
      <div className="cp-modal">
        <p className="cp-modal__title">Epic file not found</p>
        <p className="cp-modal__body">
          Cannot find the epic file at <code>{epicFile}</code>. Create it from the default
          template?
        </p>
        <div className="cp-modal__actions">
          <button className="cp-btn" onClick={onCreate}>
            Create
          </button>
          <button className="cp-btn cp-btn--secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
