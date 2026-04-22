import type { Readiness } from "../types";

export function RepositorySection({
  localRepo,
  onLocalRepoChange,
  repoError,
  onSetRepo,
  readiness,
  requirementsFile,
  onRequirementsFileChange,
}: {
  localRepo: string;
  onLocalRepoChange: (v: string) => void;
  repoError: string;
  onSetRepo: () => void;
  readiness: Readiness;
  requirementsFile: string;
  onRequirementsFileChange: (v: string) => void;
}) {
  return (
    <section className="control-panel__section">
      <h3>Repository</h3>
      <label className="cp-field">
        <span>Repo Root Path</span>
        <input
          type="text"
          value={localRepo}
          onChange={(e) => onLocalRepoChange(e.target.value)}
          placeholder="/path/to/your/project"
        />
      </label>
      {repoError && <p className="cp-error">{repoError}</p>}
      <button className="cp-btn" onClick={onSetRepo}>
        Set Repository
      </button>
      {readiness.repoConfigured && (
        <div className="cp-status">
          {readiness.gitBranch && (
            <div className="cp-branch">
              Branch: <code>{readiness.gitBranch}</code>
            </div>
          )}
        </div>
      )}

      <label className="cp-field">
        <span>Requirements File</span>
        <input
          type="text"
          value={requirementsFile}
          onChange={(e) => onRequirementsFileChange(e.target.value)}
          placeholder={readiness.requirementsFile ?? "Auto-discovered"}
          disabled={!readiness.repoConfigured}
        />
      </label>
      <p className="cp-hint">
        Path to your requirements document, relative to the repo root. Leave blank to auto-discover (looks for <code>requirements.md</code> in common locations).
        Ralph injects this file's content into every prompt as authoritative product requirements.
      </p>
      {readiness.repoConfigured && (
        readiness.requirementsFound ? (
          <span className="cp-status--ok">✓ Requirements: {readiness.requirementsFile}</span>
        ) : (
          <span className="cp-status--warn">
            ⚠ Requirements file not found
            {requirementsFile ? `: ${requirementsFile}` : " (auto-discovery failed)"}
          </span>
        )
      )}
    </section>
  );
}
