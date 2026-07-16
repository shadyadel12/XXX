import { useState } from 'react';

/**
 * Dropdown that lets the coach pick how many consecutive weeks to copy into,
 * starting from the week right after the source (excludeWeek).
 * "Next 1 week" → [excludeWeek + 1], "next 2 weeks" → [excludeWeek + 1, excludeWeek + 2], etc.
 */
export default function WeekPicker({
  excludeWeek,
  totalWeeks = 12,
  busy,
  onDuplicate,
  onCancel,
  label = 'Duplicate to weeks',
}: {
  excludeWeek: number;
  totalWeeks?: number;
  busy?: boolean;
  onDuplicate: (weeks: number[]) => void;
  onCancel: () => void;
  label?: string;
}) {
  const maxN = totalWeeks - excludeWeek; // how many weeks come after the source
  const [n, setN] = useState(1);

  if (maxN <= 0) {
    return (
      <div className="card stack" style={{ background: 'var(--surface-2)', borderColor: 'var(--accent)', gap: '0.6rem' }}>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          No weeks after Week {excludeWeek} to copy into.
        </span>
        <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
      </div>
    );
  }

  const targetWeeks = Array.from({ length: n }, (_, i) => excludeWeek + 1 + i);

  return (
    <div
      className="card stack"
      style={{ background: 'var(--surface-2)', borderColor: 'var(--accent)', gap: '0.6rem' }}
    >
      <strong style={{ fontSize: '0.9rem' }}>{label}</strong>
      <div className="row" style={{ gap: '0.6rem', alignItems: 'center' }}>
        <label style={{ fontSize: '0.9rem', whiteSpace: 'nowrap' }}>Copy to next</label>
        <select
          value={n}
          onChange={(e) => setN(Number(e.target.value))}
          style={{ width: 'auto' }}
          disabled={busy}
        >
          {Array.from({ length: maxN }, (_, i) => i + 1).map((count) => (
            <option key={count} value={count}>
              {count} week{count === 1 ? '' : 's'}
            </option>
          ))}
        </select>
        <span className="muted" style={{ fontSize: '0.8rem' }}>
          → W{targetWeeks[0]}{targetWeeks.length > 1 ? `–W${targetWeeks[targetWeeks.length - 1]}` : ''}
        </span>
      </div>
      <div className="row">
        <button
          type="button"
          onClick={() => onDuplicate(targetWeeks)}
          disabled={busy}
        >
          {busy ? 'Duplicating…' : `Duplicate to ${n} week${n === 1 ? '' : 's'}`}
        </button>
        <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}
