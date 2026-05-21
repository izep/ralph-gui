import { useState } from "react";
import type { Settings, Readiness } from "../types";

export function DockerSection({
  localSettings,
  onChangeSettings,
  readiness,
  repoLocked,
  isRunning,
  onValidateDocker,
  onMergeEpicWork,
}: {
  localSettings: Settings;
  onChangeSettings: (s: Settings) => void;
  readiness: Readiness;
  repoLocked: boolean;
  isRunning: boolean;
  onValidateDocker: () => Promise<{ ok: boolean; reason?: string; message?: string }>;
  onMergeEpicWork: () => Promise<{ ok: boolean; conflicts?: string[]; error?: string }>;
}) {
  const [dockerError, setDockerError] = useState("");
  const [dockerOk, setDockerOk] = useState(false);
  const [mergeError, setMergeError] = useState("");
  const [mergeConflicts, setMergeConflicts] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  const [validating, setValidating] = useState(false);

  async function handleValidateDocker() {
    setDockerError("");
    setDockerOk(false);
    setValidating(true);
    try {
      const result = await onValidateDocker();
      if (!result.ok) {
        setDockerError(result.message ?? "Docker validation failed");
      } else {
        setDockerOk(true);
        setTimeout(() => setDockerOk(false), 3000);
      }
    } finally {
      setValidating(false);
    }
  }

  async function handleMergeEpicWork() {
    setMergeError("");
    setMergeConflicts([]);
    setMerging(true);
    try {
      const result = await onMergeEpicWork();
      if (!result.ok) {
        if (result.conflicts && result.conflicts.length > 0) {
          setMergeConflicts(result.conflicts);
        } else {
          setMergeError(result.error ?? "Merge failed");
        }
      }
    } finally {
      setMerging(false);
    }
  }

  const hasBranchInfo = !!(localSettings.epicBaseBranch && localSettings.dockerWorkBranch);
  const canMerge = !isRunning && hasBranchInfo && localSettings.useDocker;

  return (
    <section className="control-panel__section">
      <h3>Docker Agents</h3>
      {repoLocked && (
        <p className="cp-hint">Set Repository first to configure Docker.</p>
      )}
      <fieldset className="cp-fieldset" disabled={repoLocked}>
        <label className="cp-field cp-field--row">
          <input
            type="checkbox"
            checked={localSettings.useDocker}
            onChange={(e) => onChangeSettings({ ...localSettings, useDocker: e.target.checked })}
          />
          <span>Run agents in Docker</span>
        </label>
        <p className="cp-hint">
          Runs dev/QA agents inside a Docker container. The target repo is bind-mounted to{" "}
          <code>/workspace</code>. Requires Docker with the Compose plugin.
        </p>

        {localSettings.useDocker && readiness.dockerHostOk === false && (
          <p className="cp-error">{readiness.dockerHostError}</p>
        )}

        <label className="cp-field">
          <span>Compose File</span>
          <input
            type="text"
            value={localSettings.dockerComposeFile}
            onChange={(e) => onChangeSettings({ ...localSettings, dockerComposeFile: e.target.value })}
            placeholder="(bundled default)"
            disabled={!localSettings.useDocker}
          />
        </label>
        <p className="cp-hint">
          Path to a docker-compose file, relative to the repo root. Leave blank to use the
          bundled <code>docker-compose.agents.yml</code>. Validate the container before Start;
          agent output streams to the log panel.
        </p>

        <label className="cp-field">
          <span>Service Name</span>
          <input
            type="text"
            value={localSettings.dockerService}
            onChange={(e) => onChangeSettings({ ...localSettings, dockerService: e.target.value })}
            placeholder="ralph-agent"
            disabled={!localSettings.useDocker}
          />
        </label>

        <label className="cp-field cp-field--row">
          <input
            type="checkbox"
            checked={localSettings.dockerIsolateBranch}
            onChange={(e) =>
              onChangeSettings({ ...localSettings, dockerIsolateBranch: e.target.checked })
            }
            disabled={!localSettings.useDocker}
          />
          <span>Isolate on work branch</span>
        </label>
        <p className="cp-hint">
          Creates a <code>ralph/epic-*</code> branch at loop start so agent commits are
          isolated from your base branch until you merge.
        </p>

        <label className="cp-field">
          <span>Pool size</span>
          <input
            type="number"
            min={1}
            max={8}
            value={localSettings.dockerPoolSize ?? 1}
            onChange={(e) =>
              onChangeSettings({
                ...localSettings,
                dockerPoolSize: Math.max(1, Math.min(8, Number(e.target.value) || 1)),
              })
            }
            disabled={!localSettings.useDocker}
          />
        </label>
        <p className="cp-hint">
          Number of agent containers to run in parallel (1–8). Increase to enable parallel
          dev/QA tasks. Each extra container multiplies API usage.
        </p>

        <label className="cp-field cp-field--row">
          <input
            type="checkbox"
            checked={localSettings.dockerParallelTasks ?? false}
            onChange={(e) =>
              onChangeSettings({ ...localSettings, dockerParallelTasks: e.target.checked })
            }
            disabled={!localSettings.useDocker || (localSettings.dockerPoolSize ?? 1) <= 1}
          />
          <span>Run backlog tasks in parallel</span>
        </label>
        {(localSettings.dockerPoolSize ?? 1) <= 1 && (
          <p className="cp-hint">Increase pool size to enable parallel tasks.</p>
        )}

        <label className="cp-field cp-field--row">
          <input
            type="checkbox"
            checked={localSettings.dockerPlanParallel ?? false}
            onChange={(e) =>
              onChangeSettings({ ...localSettings, dockerPlanParallel: e.target.checked })
            }
            disabled={!localSettings.useDocker || (localSettings.dockerPoolSize ?? 1) <= 1}
          />
          <span>Parallel plan research (stretch)</span>
        </label>
        <p className="cp-hint">
          When the plan agent emits <code>&lt;research-prompt&gt;</code> blocks, dispatch them
          concurrently across pool slots and merge results into the backlog. Requires pool size
          &gt; 1. Increases API usage proportionally.
        </p>

        <label className="cp-field cp-field--row">
          <input
            type="checkbox"
            checked={localSettings.dockerMountSocket ?? false}
            onChange={(e) =>
              onChangeSettings({ ...localSettings, dockerMountSocket: e.target.checked })
            }
            disabled={!localSettings.useDocker}
          />
          <span>Allow agents to run Docker in the target repo</span>
        </label>
        {localSettings.dockerMountSocket && (
          <p className="cp-hint cp-hint--warn">
            ⚠ Mounts the host Docker socket into the agent container. Grants host-level Docker
            access — only use on trusted machines. Requires{" "}
            <code>INSTALL_DOCKER_CLI=true</code> in the image and{" "}
            <code>DOCKER_SOCKET</code> in your <code>.env</code>.
          </p>
        )}

        {dockerError && <p className="cp-error">{dockerError}</p>}
        {dockerOk && <p className="cp-status--ok">Docker validated successfully</p>}

        <button
          className="cp-btn"
          onClick={handleValidateDocker}
          disabled={!localSettings.useDocker || validating || repoLocked}
        >
          {validating ? "Validating..." : "Set Docker"}
        </button>

        {hasBranchInfo && (
          <div className="cp-status">
            <div className="cp-branch">
              Epic base: <code>{localSettings.epicBaseBranch}</code>
            </div>
            <div className="cp-branch">
              Work branch: <code>{localSettings.dockerWorkBranch}</code>
            </div>
          </div>
        )}

        {mergeConflicts.length > 0 && (
          <div className="cp-error">
            <p>Merge conflicts in:</p>
            <ul style={{ marginLeft: 16, marginTop: 4 }}>
              {mergeConflicts.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <p>Resolve conflicts manually, then retry.</p>
          </div>
        )}
        {mergeError && <p className="cp-error">{mergeError}</p>}

        <button
          className="cp-btn cp-btn--secondary"
          onClick={handleMergeEpicWork}
          disabled={!canMerge || merging}
          title={
            isRunning
              ? "Stop the loop before merging"
              : !hasBranchInfo
                ? "Start the loop with Docker to capture branch info"
                : undefined
          }
        >
          {merging ? "Merging..." : "Merge work into epic branch"}
        </button>
      </fieldset>
    </section>
  );
}
