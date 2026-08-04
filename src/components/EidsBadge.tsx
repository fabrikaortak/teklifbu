export function EidsBadge({ text }: { text?: string | null }) {
  if (!text) return null;
  return (
    <div className="eids-badge" role="status">
      <span className="eids-badge__mark">EİDS</span>
      <span className="eids-badge__text">{text}</span>
    </div>
  );
}
