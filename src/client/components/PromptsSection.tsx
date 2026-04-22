const PROMPT_NAMES = [
  { key: "plan-prompt.md", label: "Plan" },
  { key: "dev-prompt.md", label: "Dev" },
  { key: "qa-prompt.md", label: "QA" },
];

export function PromptsSection({
  repoLocked,
  activePrompt,
  onActivePromptChange,
  localPrompt,
  onLocalPromptChange,
  promptSaved,
  onSavePrompt,
}: {
  repoLocked: boolean;
  activePrompt: string;
  onActivePromptChange: (key: string) => void;
  localPrompt: string;
  onLocalPromptChange: (v: string) => void;
  promptSaved: boolean;
  onSavePrompt: () => void;
}) {
  return (
    <section className="control-panel__section">
      <h3>Prompts</h3>
      {repoLocked && (
        <p className="cp-hint">Set Repository first to edit prompts.</p>
      )}
      <fieldset className="cp-fieldset" disabled={repoLocked}>
      <p className="cp-hint">
        Edit the prompts used for each loop phase. Saved to the target repo's ralph/ folder.
        Changes apply on the next iteration.
      </p>
      <div className="cp-tabs">
        {PROMPT_NAMES.map((p) => (
          <button
            key={p.key}
            className={`cp-tab ${activePrompt === p.key ? "cp-tab--active" : ""}`}
            onClick={() => onActivePromptChange(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <textarea
        className="cp-textarea cp-textarea--mono"
        rows={12}
        value={localPrompt}
        onChange={(e) => onLocalPromptChange(e.target.value)}
      />
      <button className="cp-btn" onClick={onSavePrompt}>
        {promptSaved ? "Saved!" : `Save ${PROMPT_NAMES.find((p) => p.key === activePrompt)?.label} Prompt`}
      </button>
      </fieldset>
    </section>
  );
}
