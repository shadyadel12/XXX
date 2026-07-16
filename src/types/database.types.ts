// Hand-authored to match supabase/migrations, structured to satisfy
// @supabase/supabase-js type inference (each table needs Row/Insert/Update +
// Relationships). Regenerate from the live DB once you have a CLI access token:
//   npx supabase gen types typescript --project-id <ref> > src/types/database.types.ts

export type UserRole = 'admin' | 'coach' | 'player';
export type DayType = 'training' | 'rest';
export type LinkStatus = 'active' | 'expired' | 'revoked';

// ---- Row shapes (also exported for app use) ----

export type Profile = {
  id: string;
  role: UserRole;
  email: string;
  name: string | null;
  created_at: string;
}

export type CoachPlayerLink = {
  id: string;
  coach_id: string;
  player_id: string;
  subscription_key: string;
  subscription_end_date: string;
  status: LinkStatus;
  created_at: string;
}

export type ProgramDay = {
  id: string;
  player_id: string;
  coach_id: string;
  week_number: number;
  day_of_week: number;
  day_type: DayType;
  title: string | null;
  diet_plan: string | null;
  created_at: string;
  updated_at: string;
}

export type Workout = {
  id: string;
  program_day_id: string;
  position: number;
  name: string;
  created_at: string;
}

export type Exercise = {
  id: string;
  workout_id: string;
  program_day_id: string | null; // legacy; new rows use workout_id
  position: number;
  name: string;
  target_sets: number | null;
  target_reps: string | null;
  target_weight: string | null;
  coach_video_url: string | null;
  coach_video_is_external: boolean;
  coach_comment: string | null;
  created_at: string;
}

export type ExerciseLog = {
  id: string;
  exercise_id: string;
  player_id: string;
  log_date: string;
  actual_sets: number | null;
  actual_reps: string | null;
  actual_weight: string | null;
  player_video_url: string | null;
  player_video_is_external: boolean;
  player_comment: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export type SetLog = {
  id: string;
  exercise_log_id: string;
  set_number: number;
  reps: string | null;
  weight: string | null;
  created_at: string;
}

export type Message = {
  id: string;
  coach_id: string;
  player_id: string;
  exercise_id: string | null;
  body: string;
  created_at: string;
}

export type Checkup = {
  id: string;
  coach_id: string;
  player_id: string;
  check_date: string;
  is_checked: boolean;
  created_at: string;
}

export type CoachKey = {
  id: string;
  key: string;
  status: LinkStatus;
  claimed_by: string | null;
  created_at: string;
}

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '12';
  };
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          role?: UserRole;
          email: string;
          name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          role?: UserRole;
          email?: string;
          name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      coach_player_links: {
        Row: CoachPlayerLink;
        Insert: {
          id?: string;
          coach_id: string;
          player_id: string;
          subscription_key: string;
          subscription_end_date: string;
          status?: LinkStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          coach_id?: string;
          player_id?: string;
          subscription_key?: string;
          subscription_end_date?: string;
          status?: LinkStatus;
          created_at?: string;
        };
        Relationships: [];
      };
      program_days: {
        Row: ProgramDay;
        Insert: {
          id?: string;
          player_id: string;
          coach_id: string;
          week_number: number;
          day_of_week: number;
          day_type?: DayType;
          title?: string | null;
          diet_plan?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string;
          coach_id?: string;
          week_number?: number;
          day_of_week?: number;
          day_type?: DayType;
          title?: string | null;
          diet_plan?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workouts: {
        Row: Workout;
        Insert: {
          id?: string;
          program_day_id: string;
          position?: number;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          program_day_id?: string;
          position?: number;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      exercises: {
        Row: Exercise;
        Insert: {
          id?: string;
          workout_id: string;
          program_day_id?: string | null;
          position?: number;
          name: string;
          target_sets?: number | null;
          target_reps?: string | null;
          target_weight?: string | null;
          coach_video_url?: string | null;
          coach_video_is_external?: boolean;
          coach_comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workout_id?: string;
          program_day_id?: string | null;
          position?: number;
          name?: string;
          target_sets?: number | null;
          target_reps?: string | null;
          target_weight?: string | null;
          coach_video_url?: string | null;
          coach_video_is_external?: boolean;
          coach_comment?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      exercise_logs: {
        Row: ExerciseLog;
        Insert: {
          id?: string;
          exercise_id: string;
          player_id: string;
          log_date?: string;
          actual_sets?: number | null;
          actual_reps?: string | null;
          actual_weight?: string | null;
          player_video_url?: string | null;
          player_video_is_external?: boolean;
          player_comment?: string | null;
          is_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          exercise_id?: string;
          player_id?: string;
          log_date?: string;
          actual_sets?: number | null;
          actual_reps?: string | null;
          actual_weight?: string | null;
          player_video_url?: string | null;
          player_video_is_external?: boolean;
          player_comment?: string | null;
          is_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      set_logs: {
        Row: SetLog;
        Insert: {
          id?: string;
          exercise_log_id: string;
          set_number: number;
          reps?: string | null;
          weight?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          exercise_log_id?: string;
          set_number?: number;
          reps?: string | null;
          weight?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: {
          id?: string;
          coach_id: string;
          player_id: string;
          exercise_id?: string | null;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          coach_id?: string;
          player_id?: string;
          exercise_id?: string | null;
          body?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      checkups: {
        Row: Checkup;
        Insert: {
          id?: string;
          coach_id: string;
          player_id: string;
          check_date?: string;
          is_checked?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          coach_id?: string;
          player_id?: string;
          check_date?: string;
          is_checked?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      coach_keys: {
        Row: CoachKey;
        Insert: {
          id?: string;
          key: string;
          status?: LinkStatus;
          claimed_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          status?: LinkStatus;
          claimed_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      check_coach_key: {
        Args: { p_key: string };
        Returns: boolean;
      };
      check_subscription_key: {
        Args: { p_key: string };
        Returns: boolean;
      };
      claim_coach_key: {
        Args: { p_key: string };
        Returns: undefined;
      };
      claim_subscription_key: {
        Args: { p_key: string };
        Returns: CoachPlayerLink;
      };
      admin_create_key: {
        Args: { p_coach_id: string; p_key: string; p_end_date: string };
        Returns: CoachPlayerLink;
      };
      admin_update_key: {
        Args: { p_key_id: string; p_end_date: string; p_status: LinkStatus };
        Returns: CoachPlayerLink;
      };
      admin_create_coach_key: {
        Args: { p_key: string };
        Returns: CoachKey;
      };
      admin_revoke_coach_key: {
        Args: { p_key_id: string };
        Returns: CoachKey;
      };
    };
    Enums: {
      user_role: UserRole;
      day_type: DayType;
      link_status: LinkStatus;
    };
    CompositeTypes: Record<never, never>;
  };
}
