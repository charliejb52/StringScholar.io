import { useStore } from "../store";
import { GuitarNeck } from "./GuitarNeck";
import type { Note, SongData } from "../types";

function getActiveNotes(
  song: SongData,
  currentTime: number,
  trackIndex: number,
): Note[] {
  const track = song.tracks[trackIndex] ?? song.tracks[0];
  if (!track) return [];
  const active: Note[] = [];
  for (const measure of track.measures) {
    for (const beat of measure.beats) {
      if (beat.time <= currentTime && currentTime < beat.time + beat.duration) {
        active.push(...beat.notes);
      }
    }
  }
  return active;
}

// The scale outline is static for the whole song (not time-dependent) — it's
// the note palette the scale-detection agent found for this track.
function getScaleNotes(song: SongData, trackIndex: number): Note[] {
  const track = song.tracks[trackIndex] ?? song.tracks[0];
  return track?.scale_outline?.notes ?? [];
}

export function NeckPanel({ open }: { open: boolean }) {
  // Only THIS component subscribes to currentTime, so only it re-renders each frame.
  const songData = useStore((s) => s.songData);
  const currentTime = useStore((s) => s.currentTime);
  const activeTrackIndex = useStore((s) => s.activeTrackIndex);

  // skip the work entirely while closed
  const activeNotes =
    open && songData
      ? getActiveNotes(songData, currentTime, activeTrackIndex)
      : [];
  const scaleNotes =
    open && songData ? getScaleNotes(songData, activeTrackIndex) : [];

  return (
    <aside
      aria-hidden={!open}
      style={{
        width: open ? 340 : 0,
        flexShrink: 0,
        overflow: "hidden",
        transition: "width 300ms ease-in-out",
      }}
    >
      {/* fixed-width inner so the neck doesn't squish while the panel animates */}
      <div style={{ width: 340, height: "100%", paddingLeft: 24 }}>
        <GuitarNeck activeNotes={activeNotes} scaleNotes={scaleNotes} />
      </div>
    </aside>
  );
}
