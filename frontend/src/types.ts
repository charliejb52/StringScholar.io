export interface Note {
  string: number;
  fret: number;
  midi: number;
}

export interface Beat {
  time: number;
  duration: number;
  notes: Note[];
}

export interface Measure {
  index: number;
  beats: Beat[];
}

export interface ScaleOutline {
  name: string;
  notes: Note[];
}

export interface Track {
  id: number;
  name: string;
  tuning: number[];
  measures: Measure[];
  scale_outline?: ScaleOutline | null;
}

export interface SongData {
  title: string;
  artist?: string | null;
  tempo: number;
  tracks: Track[];
}

// ── Library / DB types ────────────────────────────────────────────────────────

export interface Song {
  id: string;
  title: string;
  artist: string | null;
  tempo: number | null;
  duration: number | null;
  track_count: number | null;
  created_at: string;
  bends: number | null;
  hammer_ons: number | null;
  pull_offs: number | null;
  slides: number | null;
  vibratos: number | null;
  palm_mutes: number | null;
  barre_chords: number | null;
  open_chords: number | null;
}
