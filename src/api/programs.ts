import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import type { ProgramDay, DayType } from '../types/database.types';

/** All program days for a player, ordered by week then day-of-week. */
export async function listProgramDays(playerId: string): Promise<ProgramDay[]> {
  const { data, error } = await supabase
    .from('program_days')
    .select('*')
    .eq('player_id', playerId)
    .order('week_number', { ascending: true })
    .order('day_of_week', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** A single program day by (player, week, day-of-week), or null. */
export async function getProgramDay(
  playerId: string,
  week: number,
  dayOfWeek: number
): Promise<ProgramDay | null> {
  const { data, error } = await supabase
    .from('program_days')
    .select('*')
    .eq('player_id', playerId)
    .eq('week_number', week)
    .eq('day_of_week', dayOfWeek)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export interface UpsertProgramDayInput {
  player_id: string;
  coach_id: string;
  week_number: number;
  day_of_week: number;
  day_type: DayType;
  title: string | null;
  diet_plan: string | null;
}

/** Create or update a program day (unique on player+week+day-of-week). */
export async function upsertProgramDay(input: UpsertProgramDayInput): Promise<ProgramDay> {
  const { data, error } = await supabase
    .from('program_days')
    .upsert(input, { onConflict: 'player_id,week_number,day_of_week' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProgramDay(id: string): Promise<void> {
  const { error } = await supabase.from('program_days').delete().eq('id', id);
  if (error) throw error;
}

// ---- Draft shapes for building a whole day (day -> workouts -> exercises) ----

export interface DraftExerciseData {
  name: string;
  target_sets: number | null;
  target_reps: string | null;
  target_weight: string | null;
  coach_comment: string | null;
  coach_video_url: string | null;
  coach_video_is_external: boolean;
}

export interface DraftWorkoutData {
  name: string;
  exercises: DraftExerciseData[];
}

/**
 * Create a full training day at once: the program_day, its workouts, and each
 * workout's exercises. Used when the coach builds a new day before saving.
 */
export async function createFullDay(
  base: UpsertProgramDayInput,
  workouts: DraftWorkoutData[]
): Promise<void> {
  const day = await upsertProgramDay(base);
  for (let wi = 0; wi < workouts.length; wi++) {
    const w = workouts[wi];
    const { data: workout, error: wErr } = await supabase
      .from('workouts')
      .insert({ program_day_id: day.id, name: w.name || 'Workout', position: wi })
      .select()
      .single();
    if (wErr) throw wErr;
    if (w.exercises.length > 0) {
      const { error: eErr } = await supabase.from('exercises').insert(
        w.exercises.map((ex, ei) => ({
          workout_id: workout.id,
          position: ei,
          name: ex.name,
          target_sets: ex.target_sets,
          target_reps: ex.target_reps,
          target_weight: ex.target_weight,
          coach_comment: ex.coach_comment,
          coach_video_url: ex.coach_video_url,
          coach_video_is_external: ex.coach_video_is_external,
        }))
      );
      if (eErr) throw eErr;
    }
  }
}

/**
 * Copy every day (with its workouts + exercises) from one week into another for
 * the same player. Player LOGS are not copied — only the plan. Existing days in
 * the target week for the same day-of-week are overwritten.
 */
export async function duplicateWeek(
  playerId: string,
  coachId: string,
  fromWeek: number,
  toWeek: number
): Promise<number> {
  const { data: days, error } = await supabase
    .from('program_days')
    .select('*')
    .eq('player_id', playerId)
    .eq('week_number', fromWeek);
  if (error) throw error;
  if (!days || days.length === 0) return 0;

  // Clear the target week first so we don't stack duplicate workouts onto an
  // existing day (workouts/exercises cascade-delete with the day).
  const { error: delErr } = await supabase
    .from('program_days')
    .delete()
    .eq('player_id', playerId)
    .eq('week_number', toWeek);
  if (delErr) throw delErr;

  for (const d of days) {
    const base: UpsertProgramDayInput = {
      player_id: playerId,
      coach_id: coachId,
      week_number: toWeek,
      day_of_week: d.day_of_week,
      day_type: d.day_type,
      title: d.title,
      diet_plan: d.diet_plan,
    };

    if (d.day_type === 'rest') {
      await upsertProgramDay(base);
      continue;
    }

    // Read this day's workouts + exercises.
    const { data: workouts } = await supabase
      .from('workouts')
      .select('*')
      .eq('program_day_id', d.id)
      .order('position');
    const drafts: DraftWorkoutData[] = [];
    for (const w of workouts ?? []) {
      const { data: exs } = await supabase
        .from('exercises')
        .select('*')
        .eq('workout_id', w.id)
        .order('position');
      drafts.push({
        name: w.name,
        exercises: (exs ?? []).map((ex) => ({
          name: ex.name,
          target_sets: ex.target_sets,
          target_reps: ex.target_reps,
          target_weight: ex.target_weight,
          coach_comment: ex.coach_comment,
          coach_video_url: ex.coach_video_url,
          coach_video_is_external: ex.coach_video_is_external,
        })),
      });
    }
    await createFullDay(base, drafts);
  }
  return days.length;
}

// ---------------------------------------------------------------------------
// Granular duplication: copy a single day OR a single exercise into any subset
// of other weeks.
// ---------------------------------------------------------------------------

/** Read one day fully (workouts + exercises) as a set of drafts. Null if empty. */
async function readDayAsDrafts(
  playerId: string,
  week: number,
  dayOfWeek: number
): Promise<{ day: ProgramDay; drafts: DraftWorkoutData[] } | null> {
  const day = await getProgramDay(playerId, week, dayOfWeek);
  if (!day) return null;
  const { data: workouts } = await supabase
    .from('workouts')
    .select('*')
    .eq('program_day_id', day.id)
    .order('position');
  const drafts: DraftWorkoutData[] = [];
  for (const w of workouts ?? []) {
    const { data: exs } = await supabase
      .from('exercises')
      .select('*')
      .eq('workout_id', w.id)
      .order('position');
    drafts.push({
      name: w.name,
      exercises: (exs ?? []).map((ex) => ({
        name: ex.name,
        target_sets: ex.target_sets,
        target_reps: ex.target_reps,
        target_weight: ex.target_weight,
        coach_comment: ex.coach_comment,
        coach_video_url: ex.coach_video_url,
        coach_video_is_external: ex.coach_video_is_external,
      })),
    });
  }
  return { day, drafts };
}

/**
 * Duplicate one day (with all workouts + exercises) into the given target
 * weeks. The target day at (week, day_of_week) is OVERWRITTEN in each week.
 */
export async function duplicateDayToWeeks(
  playerId: string,
  coachId: string,
  sourceWeek: number,
  sourceDow: number,
  targetWeeks: number[]
): Promise<number> {
  const source = await readDayAsDrafts(playerId, sourceWeek, sourceDow);
  if (!source) return 0;
  let done = 0;
  for (const w of targetWeeks) {
    if (w === sourceWeek) continue;
    // Wipe target day so we don't stack duplicate workouts on top.
    await supabase
      .from('program_days')
      .delete()
      .eq('player_id', playerId)
      .eq('week_number', w)
      .eq('day_of_week', sourceDow);
    await createFullDay(
      {
        player_id: playerId,
        coach_id: coachId,
        week_number: w,
        day_of_week: sourceDow,
        day_type: source.day.day_type,
        title: source.day.title,
        diet_plan: source.day.diet_plan,
      },
      source.drafts
    );
    done++;
  }
  return done;
}

/**
 * Duplicate a single exercise into the given target weeks (same day-of-week).
 * For each target week: ensures a training day exists at (week, dow), finds or
 * creates a workout with the same name, then APPENDS the exercise to it.
 */
export async function duplicateExerciseToWeeks(
  playerId: string,
  coachId: string,
  sourceExerciseId: string,
  targetWeeks: number[]
): Promise<number> {
  // Load source exercise + parent workout + parent day.
  const { data: ex, error: exErr } = await supabase
    .from('exercises')
    .select('*')
    .eq('id', sourceExerciseId)
    .single();
  if (exErr || !ex) throw exErr ?? new Error('Exercise not found');
  const { data: workout, error: wErr } = await supabase
    .from('workouts')
    .select('*')
    .eq('id', ex.workout_id)
    .single();
  if (wErr || !workout) throw wErr ?? new Error('Workout not found');
  const { data: srcDay, error: dErr } = await supabase
    .from('program_days')
    .select('*')
    .eq('id', workout.program_day_id)
    .single();
  if (dErr || !srcDay) throw dErr ?? new Error('Day not found');

  let done = 0;
  for (const week of targetWeeks) {
    if (week === srcDay.week_number) continue;

    // Ensure day exists for this week/dow.
    let day = await getProgramDay(playerId, week, srcDay.day_of_week);
    if (!day) {
      day = await upsertProgramDay({
        player_id: playerId,
        coach_id: coachId,
        week_number: week,
        day_of_week: srcDay.day_of_week,
        day_type: 'training',
        title: null,
        diet_plan: null,
      });
    } else if (day.day_type !== 'training') {
      // Flip rest -> training so we can add an exercise.
      const { data: flipped } = await supabase
        .from('program_days')
        .update({ day_type: 'training' })
        .eq('id', day.id)
        .select()
        .single();
      if (flipped) day = flipped;
    }

    // Find (or create) a workout with the same name in this day.
    const { data: existingWorkouts } = await supabase
      .from('workouts')
      .select('*')
      .eq('program_day_id', day.id);
    let targetWorkout = (existingWorkouts ?? []).find((w) => w.name === workout.name);
    if (!targetWorkout) {
      const { data: created, error: cErr } = await supabase
        .from('workouts')
        .insert({
          program_day_id: day.id,
          name: workout.name,
          position: existingWorkouts?.length ?? 0,
        })
        .select()
        .single();
      if (cErr) throw cErr;
      targetWorkout = created;
    }

    // Compute next position within the target workout.
    const { data: existingExs } = await supabase
      .from('exercises')
      .select('id')
      .eq('workout_id', targetWorkout.id);
    const nextPos = existingExs?.length ?? 0;

    const { error: iErr } = await supabase.from('exercises').insert({
      workout_id: targetWorkout.id,
      position: nextPos,
      name: ex.name,
      target_sets: ex.target_sets,
      target_reps: ex.target_reps,
      target_weight: ex.target_weight,
      coach_comment: ex.coach_comment,
      coach_video_url: ex.coach_video_url,
      coach_video_is_external: ex.coach_video_is_external,
    });
    if (iErr) throw iErr;
    done++;
  }
  return done;
}

// ---------------------------------------------------------------------------
// CSV import / export
// ---------------------------------------------------------------------------

const CSV_COLUMNS = [
  'week',
  'day',           // Sat / Sun / Mon / Tue / Wed / Thu / Fri
  'day_type',      // training / rest
  'workout',       // workout name (blank for rest)
  'exercise',      // exercise name (blank for rest)
  'target_sets',
  'target_reps',
  'target_weight',
  'coach_comment',
  'coach_video_url',
  'diet_plan',     // applied per (week, day) from first non-blank row
] as const;

/** Blank template CSV: header + a few example rows. */
export function generateCsvTemplate(): string {
  const header = CSV_COLUMNS.join(',');
  const examples = [
    ['1', 'Sat', 'training', 'Push Day', 'Bench Press',   '4', '8-12', '60kg',  'Controlled tempo', '', 'High protein day'],
    ['1', 'Sat', 'training', 'Push Day', 'Overhead Press','3', '10',   '35kg',  '',                  '', ''],
    ['1', 'Sun', 'rest',     '',         '',              '',  '',     '',       '',                  '', 'Rest day - hydrate'],
    ['1', 'Mon', 'training', 'Pull Day', 'Barbell Row',   '4', '8',    '50kg',  'Squeeze at top',    '', ''],
  ];
  return [header, ...examples.map((r) => r.map(csvEscape).join(','))].join('\n');
}

// ---------------------------------------------------------------------------
// Excel import / export (SheetJS)
// ---------------------------------------------------------------------------

/** Download a pre-formatted .xlsx template the coach fills in and re-uploads. */
export function generateXlsxTemplate(): void {
  const headers = [
    'week', 'day', 'day_type', 'workout', 'exercise',
    'target_sets', 'target_reps', 'target_weight',
    'coach_comment', 'coach_video_url', 'diet_plan',
  ];
  const examples = [
    [1, 'Sat', 'training', 'Push Day', 'Bench Press',    4, '8-12', '60kg', 'Controlled tempo', '', 'High protein day'],
    [1, 'Sat', 'training', 'Push Day', 'Overhead Press', 3, '10',   '35kg', '',                  '', ''],
    [1, 'Sun', 'rest',     '',         '',               '', '',     '',     '',                  '', 'Rest day - hydrate'],
    [1, 'Mon', 'training', 'Pull Day', 'Barbell Row',    4, '8',    '50kg', 'Squeeze at top',    '', ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);

  // Column widths for readability.
  ws['!cols'] = [
    { wch: 6 }, { wch: 6 }, { wch: 10 }, { wch: 16 }, { wch: 20 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 30 }, { wch: 22 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Program');
  XLSX.writeFile(wb, 'program-template.xlsx');
}

/**
 * Parse an uploaded .xlsx file and import its rows as a player's program.
 * Expects the same column layout as generateXlsxTemplate().
 * OVERWRITES the player's existing program.
 */
export async function importFromXlsx(
  file: File,
  playerId: string,
  coachId: string,
): Promise<{ daysCreated: number; workoutsCreated: number; exercisesCreated: number }> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws, { defval: '' });

  // Normalise every cell to trimmed string so the rest of the logic is identical
  // to the CSV import path.
  const rows = raw.map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k.trim().toLowerCase(), String(v ?? '').trim()])
    )
  ) as Record<string, string>[];

  if (rows.length === 0) throw new Error('The Excel file has no data rows.');

  // Reuse the same grouping / upsert logic as importProgramFromCsv.
  type DayKey = string;
  const days = new Map<DayKey, {
    week: number; dow: number; day_type: DayType; diet_plan: string | null;
    workouts: Map<string, DraftWorkoutData>;
  }>();

  for (const [idx, r] of rows.entries()) {
    const line = idx + 2;
    const week = parseInt(r.week, 10);
    if (!week || week < 1) throw new Error(`Row ${line}: invalid week "${r.week}"`);
    const dowKey = r.day.toLowerCase();
    if (!(dowKey in DAY_TO_DOW)) throw new Error(`Row ${line}: invalid day "${r.day}" (use Sat/Sun/Mon…)`);
    const dow = DAY_TO_DOW[dowKey];
    const day_type: DayType = r.day_type.toLowerCase() === 'rest' ? 'rest' : 'training';
    const key = `${week}|${dow}`;
    if (!days.has(key)) {
      days.set(key, { week, dow, day_type, diet_plan: r.diet_plan || null, workouts: new Map() });
    } else {
      const d = days.get(key)!;
      if (r.diet_plan && !d.diet_plan) d.diet_plan = r.diet_plan;
    }
    if (day_type === 'rest') continue;
    if (!r.workout || !r.exercise) continue;
    const d = days.get(key)!;
    let w = d.workouts.get(r.workout);
    if (!w) { w = { name: r.workout, exercises: [] }; d.workouts.set(r.workout, w); }
    w.exercises.push({
      name: r.exercise,
      target_sets: r.target_sets ? parseInt(r.target_sets, 10) : null,
      target_reps: r.target_reps || null,
      target_weight: r.target_weight || null,
      coach_comment: r.coach_comment || null,
      coach_video_url: r.coach_video_url || null,
      coach_video_is_external: !!r.coach_video_url,
    });
  }

  await supabase.from('program_days').delete().eq('player_id', playerId);

  let daysCreated = 0, workoutsCreated = 0, exercisesCreated = 0;
  for (const d of days.values()) {
    const drafts = [...d.workouts.values()];
    await createFullDay(
      {
        player_id: playerId,
        coach_id: coachId,
        week_number: d.week,
        day_of_week: d.dow,
        day_type: d.day_type,
        title: null,
        diet_plan: d.diet_plan,
      },
      drafts
    );
    daysCreated++;
    workoutsCreated += drafts.length;
    exercisesCreated += drafts.reduce((s, w) => s + w.exercises.length, 0);
  }
  return { daysCreated, workoutsCreated, exercisesCreated };
}

function csvEscape(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

/** Parse a CSV string into an array of row objects keyed by column name. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some((x) => x.trim().length > 0)) rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((x) => x.trim().length > 0)) rows.push(row);
  }
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => { obj[h] = (r[i] ?? '').trim(); });
    return obj;
  });
}

const DAY_TO_DOW: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

/**
 * Import a CSV into the player's program. OVERWRITES the entire existing
 * program for this player (deletes all program_days first). Returns totals.
 */
export async function importProgramFromCsv(
  playerId: string,
  coachId: string,
  csv: string
): Promise<{ daysCreated: number; workoutsCreated: number; exercisesCreated: number }> {
  const rows = parseCsv(csv);
  if (rows.length === 0) throw new Error('CSV is empty.');

  // Validate + group.
  type DayKey = string; // "week|dow"
  const days = new Map<DayKey, {
    week: number; dow: number; day_type: DayType; diet_plan: string | null;
    workouts: Map<string, DraftWorkoutData>;
  }>();

  for (const [idx, r] of rows.entries()) {
    const line = idx + 2; // 1-indexed + header row
    const week = parseInt(r.week, 10);
    if (!week || week < 1) throw new Error(`Row ${line}: invalid week "${r.week}"`);
    const dowKey = r.day.toLowerCase();
    if (!(dowKey in DAY_TO_DOW)) throw new Error(`Row ${line}: invalid day "${r.day}" (use Sat/Sun/Mon...)`);
    const dow = DAY_TO_DOW[dowKey];
    const day_type: DayType = r.day_type.toLowerCase() === 'rest' ? 'rest' : 'training';
    const key = `${week}|${dow}`;
    if (!days.has(key)) {
      days.set(key, { week, dow, day_type, diet_plan: r.diet_plan || null, workouts: new Map() });
    } else {
      const d = days.get(key)!;
      if (r.diet_plan && !d.diet_plan) d.diet_plan = r.diet_plan;
    }
    if (day_type === 'rest') continue;
    if (!r.workout || !r.exercise) continue; // allow rest-typed rows in a training day? skip empty
    const d = days.get(key)!;
    let w = d.workouts.get(r.workout);
    if (!w) { w = { name: r.workout, exercises: [] }; d.workouts.set(r.workout, w); }
    w.exercises.push({
      name: r.exercise,
      target_sets: r.target_sets ? parseInt(r.target_sets, 10) : null,
      target_reps: r.target_reps || null,
      target_weight: r.target_weight || null,
      coach_comment: r.coach_comment || null,
      coach_video_url: r.coach_video_url || null,
      coach_video_is_external: !!r.coach_video_url,
    });
  }

  // Wipe entire program for this player.
  await supabase.from('program_days').delete().eq('player_id', playerId);

  let daysCreated = 0, workoutsCreated = 0, exercisesCreated = 0;
  for (const d of days.values()) {
    const drafts = [...d.workouts.values()];
    await createFullDay(
      {
        player_id: playerId,
        coach_id: coachId,
        week_number: d.week,
        day_of_week: d.dow,
        day_type: d.day_type,
        title: null,
        diet_plan: d.diet_plan,
      },
      drafts
    );
    daysCreated++;
    workoutsCreated += drafts.length;
    exercisesCreated += drafts.reduce((s, w) => s + w.exercises.length, 0);
  }
  return { daysCreated, workoutsCreated, exercisesCreated };
}
