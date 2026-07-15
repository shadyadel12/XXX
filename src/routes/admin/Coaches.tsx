import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listCoaches,
  listAllKeys,
  generateKey,
  adminCreateKey,
  adminUpdateKey,
  listCoachKeys,
  generateCoachKey,
  adminCreateCoachKey,
  adminRevokeCoachKey,
} from '../../api/admin';
import { addDays, todayISO } from '../../lib/dates';
import type { CoachKey, CoachPlayerLink } from '../../types/database.types';

export default function AdminCoaches() {
  const qc = useQueryClient();
  const { data: coaches } = useQuery({ queryKey: ['coaches'], queryFn: listCoaches });
  const { data: keys } = useQuery({ queryKey: ['allKeys'], queryFn: listAllKeys });

  const [coachId, setCoachId] = useState('');
  const [key, setKey] = useState(generateKey());
  const [endDate, setEndDate] = useState(addDays(todayISO(), 30));

  const create = useMutation({
    mutationFn: () => adminCreateKey(coachId, key, endDate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allKeys'] });
      setKey(generateKey());
    },
  });

  const coachName = (id: string) =>
    coaches?.find((c) => c.id === id)?.name ??
    coaches?.find((c) => c.id === id)?.email ??
    id.slice(0, 8);

  return (
    <div className="stack">
      <h1>Admin — Keys</h1>

      <CoachKeysSection />

      <div className="card stack">
        <strong>Issue a player subscription key</strong>
        <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
          Create a key for a coach, then give it to the player to sign up with.
        </p>
        <div className="field" style={{ margin: 0 }}>
          <label>Coach</label>
          <select value={coachId} onChange={(e) => setCoachId(e.target.value)}>
            <option value="">Select a coach…</option>
            {(coaches ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? c.email} ({c.email})
              </option>
            ))}
          </select>
        </div>
        <div className="row">
          <div className="field" style={{ margin: 0, flex: 2 }}>
            <label>Key</label>
            <div className="row">
              <input value={key} onChange={(e) => setKey(e.target.value)} />
              <button className="secondary" type="button" onClick={() => setKey(generateKey())}>
                ↻
              </button>
            </div>
          </div>
          <div className="field" style={{ margin: 0, flex: 1 }}>
            <label>Expires</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="row">
          <button onClick={() => create.mutate()} disabled={create.isPending || !coachId}>
            {create.isPending ? 'Creating…' : 'Create key'}
          </button>
          {create.error && <span className="error">{(create.error as Error).message}</span>}
        </div>
      </div>

      <div className="stack">
        <strong>All player keys</strong>
        {(keys ?? []).length === 0 && <p className="muted">No keys issued yet.</p>}
        {(keys ?? []).map((k) => (
          <KeyRow key={k.id} link={k} coachName={coachName(k.coach_id)} />
        ))}
      </div>

      {coaches && coaches.length === 0 && (
        <div className="card">
          <p className="muted">
            No coaches yet. A coach must sign up (with the coach invite code) before
            you can issue keys for them.
          </p>
        </div>
      )}
    </div>
  );
}

function KeyRow({ link, coachName }: { link: CoachPlayerLink; coachName: string }) {
  const qc = useQueryClient();
  const [endDate, setEndDate] = useState(link.subscription_end_date);

  const renew = useMutation({
    mutationFn: () => adminUpdateKey(link.id, endDate, 'active'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['allKeys'] }),
  });
  const revoke = useMutation({
    mutationFn: () => adminUpdateKey(link.id, link.subscription_end_date, 'revoked'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['allKeys'] }),
  });

  return (
    <div className="card stack" style={{ gap: '0.6rem' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <code style={{ fontSize: '1rem' }}>{link.subscription_key}</code>{' '}
          <span className={`badge ${link.status === 'active' ? 'active' : 'expired'}`}>
            {link.status}
          </span>
        </div>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          Coach: {coachName} · {link.player_id ? 'claimed' : 'unclaimed'}
        </span>
      </div>
      <div className="row">
        <div className="field" style={{ margin: 0 }}>
          <label>Expiry</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <button onClick={() => renew.mutate()} disabled={renew.isPending}>
          {renew.isPending ? '…' : 'Renew / update'}
        </button>
        <button className="danger" onClick={() => revoke.mutate()} disabled={revoke.isPending}>
          Revoke
        </button>
      </div>
      {(renew.error || revoke.error) && (
        <span className="error">
          {((renew.error || revoke.error) as Error).message}
        </span>
      )}
    </div>
  );
}

function CoachKeysSection() {
  const qc = useQueryClient();
  const { data: coachKeys } = useQuery({ queryKey: ['coachKeys'], queryFn: listCoachKeys });
  const [key, setKey] = useState(generateCoachKey());

  const create = useMutation({
    mutationFn: () => adminCreateCoachKey(key),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coachKeys'] });
      setKey(generateCoachKey());
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => adminRevokeCoachKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coachKeys'] }),
  });

  return (
    <div className="card stack">
      <strong>Coach keys</strong>
      <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
        Single-use. Give one to a person so they can sign up as a coach.
      </p>
      <div className="row">
        <div className="field" style={{ margin: 0, flex: 2 }}>
          <label>New coach key</label>
          <div className="row">
            <input value={key} onChange={(e) => setKey(e.target.value)} />
            <button className="secondary" type="button" onClick={() => setKey(generateCoachKey())}>
              ↻
            </button>
          </div>
        </div>
        <button onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create coach key'}
        </button>
      </div>
      {create.error && <span className="error">{(create.error as Error).message}</span>}

      <div className="stack" style={{ gap: '0.4rem', marginTop: '0.3rem' }}>
        {(coachKeys ?? []).length === 0 && (
          <span className="muted" style={{ fontSize: '0.85rem' }}>No coach keys yet.</span>
        )}
        {(coachKeys ?? []).map((ck: CoachKey) => (
          <div key={ck.id} className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <code>{ck.key}</code>{' '}
              <span className={`badge ${ck.status === 'active' && !ck.claimed_by ? 'active' : 'expired'}`}>
                {ck.claimed_by ? 'used' : ck.status}
              </span>
            </div>
            {ck.status === 'active' && !ck.claimed_by && (
              <button className="danger" onClick={() => revoke.mutate(ck.id)} disabled={revoke.isPending}>
                Revoke
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
