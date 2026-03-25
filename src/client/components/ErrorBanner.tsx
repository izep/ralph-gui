export function ErrorBanner({
  error,
  onRestart,
  onDismiss,
}: {
  error: string;
  onRestart: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="error-banner">
      <div className="error-banner__content">
        <span className="error-banner__icon">!</span>
        <span className="error-banner__message">{error}</span>
      </div>
      <div className="error-banner__actions">
        <button className="error-banner__btn error-banner__btn--restart" onClick={onRestart}>
          Restart Loop
        </button>
        <button className="error-banner__btn error-banner__btn--dismiss" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
