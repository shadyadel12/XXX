import { useState } from 'react';

/**
 * Popover UI: pick which target weeks to copy into, then click Duplicate.
 * `excludeWeek` is the source week (never selectable — you can't copy to self).
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
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const toggle = (w: number) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(w)) next.delete(w); else next.add(w);
      return next;
    });
  };

  const all = Array.from({ length: totalWeeks }, (_, i) => i + 1).filter((w) => w !== excludeWeek);

  return (
    <div
      className="card stack"
      style={{ background: 'var(--surface-2)', borderColor: 'var(--accent)', gap: '0.6rem' }}
    >
      <strong style={{ fontSize: '0.9rem' }}>{label}</strong>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {all.map((w) => {
          const on = picked.has(w);
          return (
            <label
              key={w}
              className="row"
              style={{
                gap: '0.3rem',
                padding: '0.3em 0.6em',
                border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 999,
                background: on ? 'rgba(79, 140, 255, 0.15)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={on}
                onChange={() => toggle(w)}
              />
              W{w}
            </label>
          );
        })}
      </div>
      <div className="row">
        <button
          type="button"
          onClick={() => onDuplicate([...picked].sort((a, b) => a - b))}
          disabled={busy || picked.size === 0}
        >
          {busy ? 'Duplicating…' : `Duplicate to ${picked.size} week${picked.size === 1 ? '' : 's'}`}
        </button>
        <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}
