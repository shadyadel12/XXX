import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { getPlayerForCoach } from '../../api/players';
import { listProgramDays } from '../../api/programs';
import { listWorkouts } from '../../api/workouts';
import { listExercises } from '../../api/exercises';
import { listMessagesForPlayer, sendMessage, deleteMessage } from '../../api/messages';
import { DAY_NAMES } from '../../lib/dates';
import type { Exercise } from '../../types/database.types';

export default function CoachMessages() {
  const { playerId } = useParams<{ playerId: string }>();
  const { session } = useAuth();
  const coachId = session!.user.id;
  const qc = useQueryClient();

  const { data: player } = useQuery({
    queryKey: ['player', coachId, playerId],
    queryFn: () => getPlayerForCoach(coachId, playerId!),
    enabled: !!playerId,
  });

  const { data: messages } = useQuery({
    queryKey: ['messages', playerId],
    queryFn: () => listMessagesForPlayer(playerId!),
    enabled: !!playerId,
  });

  // All exercises across the program, for the "attach to exercise" picker.
  const { data: exOptions } = useQuery({
    queryKey: ['allExercises', playerId],
    queryFn: async () => {
      const days = await listProgramDays(playerId!);
      const out: { ex: Exercise; label: string }[] = [];
      for (const d of days) {
        if (d.day_type !== 'training') continue;
        const workouts = await listWorkouts(d.id);
        for (const w of workouts) {
          const exs = await listExercises(w.id);
          for (const ex of exs) {
            out.push({
              ex,
              label: `W${d.week_number} ${DAY_NAMES[d.day_of_week]} · ${w.name} — ${ex.name}`,
            });
          }
        }
      }
      return out;
    },
    enabled: !!playerId,
  });

  const [body, setBody] = useState('');
  const [exerciseId, setExerciseId] = useState('');

  const send = useMutation({
    mutationFn: () =>
      sendMessage({
        coach_id: coachId,
        player_id: playerId!,
        exercise_id: exerciseId || null,
        body,
      }),
    onSuccess: () => {
      setBody('');
      setExerciseId('');
      qc.invalidateQueries({ queryKey: ['messages', playerId] });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteMessage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages', playerId] }),
  });

  const exLabel = (id: string | null) =>
    id ? exOptions?.find((o) => o.ex.id === id)?.label ?? 'Exercise' : 'General';

  return (
    <div className="stack">
      <div>
        <Link to="/coach/dashboard" className="muted" style={{ fontSize: '0.85rem' }}>
          ← Dashboard
        </Link>
        <h1 style={{ margin: '0.2rem 0 0' }}>
          Messages — {player?.profile?.name ?? player?.profile?.email ?? '…'}
        </h1>
      </div>

      <div className="card stack">
        <strong>Send a message</strong>
        <div className="field" style={{ margin: 0 }}>
          <label>Attach to (optional)</label>
          <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
            <option value="">General message</option>
            {(exOptions ?? []).map((o) => (
              <option key={o.ex.id} value={o.ex.id}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Message</label>
          <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div className="row">
          <button onClick={() => send.mutate()} disabled={send.isPending || !body.trim()}>
            {send.isPending ? 'Sending…' : 'Send'}
          </button>
          {send.error && <span className="error">{(send.error as Error).message}</span>}
        </div>
      </div>

      <div className="stack">
        <strong>Sent messages</strong>
        {(messages ?? []).length === 0 && <p className="muted">No messages yet.</p>}
        {(messages ?? []).map((m) => (
          <div key={m.id} className="card row" style={{ justifyContent: 'space-between' }}>
            <div>
              <span className="badge active" style={{ marginRight: '0.5rem' }}>
                {exLabel(m.exercise_id)}
              </span>
              {m.body}
              <div className="muted" style={{ fontSize: '0.75rem', marginTop: '0.3rem' }}>
                {new Date(m.created_at).toLocaleString()}
              </div>
            </div>
            <button className="danger" onClick={() => del.mutate(m.id)} disabled={del.isPending}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
