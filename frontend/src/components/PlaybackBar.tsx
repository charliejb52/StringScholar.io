import { useStore } from "../store";
import {
  resumeAudio,
  transportPause,
  transportSeek,
  transportStart,
} from "../tone";

// ── Style tokens ───────────────────────────────────────────────────────────────
const C = {
  bgstart: "#606ee6ff",
  bgend: "#d77a4bff",
  surface: "#ffffffff",
  border: "#2E2E2E",
  accent: "#d77a4bff",
  text: "#000000ff",
  muted: "#161616ff",
} as const;

function formatTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlaybackBar() {
  const currentTime = useStore((s) => s.currentTime);
  const isPlaying = useStore((s) => s.isPlaying);
  const duration = useStore((s) => s.duration);
  const play = useStore((s) => s.play);
  const pause = useStore((s) => s.pause);
  const seek = useStore((s) => s.seek);

  async function handlePlayPause() {
    if (isPlaying) {
      transportPause();
      pause();
    } else {
      await resumeAudio(); // satisfy browser autoplay policy
      transportStart();
      play();
    }
  }

  function handleSeek(t: number) {
    transportSeek(t); // move Tone.Transport clock first
    seek(t); // then update the scrubber
  }

  return (
    <div
      className="flex items-center gap-4 rounded-2xl px-6 py-4"
      style={{
        background: C.surface,
      }}
    >
      <button
        onClick={handlePlayPause}
        className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-indigo-500 text-white transition"
        style={{
          background: isPlaying
            ? C.bgstart
            : `linear-gradient(180deg, ${C.bgstart} 0%, ${C.bgend} 100%)`,
        }}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
            <rect x="5" y="4" width="4" height="16" rx="1" />
            <rect x="15" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
            <polygon points="6,3 20,12 6,21" />
          </svg>
        )}
      </button>

      <span className="text-sm tabular-nums w-10 text-right flex-shrink-0">
        {formatTime(currentTime)}
      </span>

      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.05}
        value={currentTime}
        onChange={(e) => handleSeek(Number(e.target.value))}
        className="flex-1 cursor-pointer"
        style={{
          accentColor: C.bgstart,
        }}
      />

      <span className="text-sm tabular-nums w-10 flex-shrink-0">
        {formatTime(duration)}
      </span>
    </div>
  );
}
