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
}) {
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
        <input
          type="text"
          value={epicFile}
          onChange={(e) => onEpicFileChange(e.target.value)}
          placeholder="ralph/epic.md"
        />
      </label>
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
    </section>
  );
}
