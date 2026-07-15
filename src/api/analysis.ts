import { supabase } from '../lib/supabase';
import { listProgramDays } from './programs';
import { listWorkouts } from './workouts';
import { listExercises } from './exercises';
import type { ExerciseLog } from '../types/database.types';

export interface ExerciseHistory {
  exerciseId: string;
  exerciseName: string;
  dayTitle: string | null; // the workout/day title, e.g. "Push Day"
  weekNumber: number;
  dayOfWeek: number;
  logs: ExerciseLog[]; // sorted by log_date ascending (oldest -> newest)
}

export interface PlayerAnalysis {
  totalCompleted: number;
  totalLogged: number;
  byExercise: ExerciseHistory[];
}

/**
 * Build per-exercise performance history for a player across their whole
 * program. Works for both the player (own data) and the coach (linked player) —
 * RLS decides what's readable.
 */
export async function getPlayerAnalysis(playerId: string): Promise<PlayerAnalysis> {
  const days = await listProgramDays(playerId);
  const trainingDays = days.filter((d) => d.day_type === 'training');

  // Collect exercises per day (day -> workouts -> exercises).
  const histories: ExerciseHistory[] = [];
  const exerciseIds: string[] = [];
  for (const d of trainingDays) {
    const workouts = await listWorkouts(d.id);
    for (const w of workouts) {
      const exs = await listExercises(w.id);
      for (const ex of exs) {
        exerciseIds.push(ex.id);
        histories.push({
          exerciseId: ex.id,
          exerciseName: ex.name,
          dayTitle: w.name, // the workout name is the meaningful grouping label
          weekNumber: d.week_number,
          dayOfWeek: d.day_of_week,
          logs: [],
        });
      }
    }
  }

  if (exerciseIds.length === 0) {
    return { totalCompleted: 0, totalLogged: 0, byExercise: [] };
  }

  const { data: logs, error } = await supabase
    .from('exercise_logs')
    .select('*')
    .eq('player_id', playerId)
    .in('exercise_id', exerciseIds)
    .order('log_date', { ascending: true });
  if (error) throw error;

  const byEx = new Map<string, ExerciseLog[]>();
  for (const log of logs ?? []) {
    const arr = byEx.get(log.exercise_id) ?? [];
    arr.push(log);
    byEx.set(log.exercise_id, arr);
  }

  let totalCompleted = 0;
  for (const h of histories) {
    h.logs = byEx.get(h.exerciseId) ?? [];
    totalCompleted += h.logs.filter((l) => l.is_completed).length;
  }

  return {
    totalCompleted,
    totalLogged: (logs ?? []).length,
    byExercise: histories.filter((h) => h.logs.length > 0),
  };
}

/**
 * Group exercises by NAME so the same movement across weeks is compared
 * together (e.g. all "Chest Press" sessions). Each group also lists the
 * workout/day titles the exercise appears in (e.g. "Push Day").
 */
export interface ExerciseGroup {
  exerciseName: string;
  workoutTitles: string[]; // distinct day titles this exercise appears under
  logs: ExerciseLog[]; // chronological
}

export function groupByExerciseName(analysis: PlayerAnalysis): ExerciseGroup[] {
  const map = new Map<string, ExerciseGroup>();
  for (const h of analysis.byExercise) {
    const g = map.get(h.exerciseName) ?? {
      exerciseName: h.exerciseName,
      workoutTitles: [],
      logs: [],
    };
    if (h.dayTitle && !g.workoutTitles.includes(h.dayTitle)) {
      g.workoutTitles.push(h.dayTitle);
    }
    g.logs.push(...h.logs);
    map.set(h.exerciseName, g);
  }
  const groups = [...map.values()];
  for (const g of groups) {
    g.logs.sort((a, b) => a.log_date.localeCompare(b.log_date));
  }
  return groups;
}
