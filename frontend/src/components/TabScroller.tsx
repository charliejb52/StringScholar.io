import type { MouseEvent } from "react";
import { useStore } from "../store";
import { transportSeek } from "../tone";

const C = {
  bgstart: "#606ee6ff",
  bgend: "#d77a4bff",
  surface: "#ffffffff",
  border: "#2E2E2E",
  accent: "#d77a4bff",
  text: "#000000ff",
  muted: "#161616ff",
} as const;

// ── Layout constants ────────────────────────────────────────────────────────
const PPS = 100; // pixels per second of song time
const TAB_HEIGHT = 160; // px — total component height
const STRING_TOP = 40; // y of string 1 (high e) — leaves room for measure numbers
const STRING_SPACING = 20; // px between adjacent strings
const PLAYHEAD_X = 120; // px from left of scroll area to the red line
const LABEL_WIDTH = 36; // px — fixed left column for string names

// Accent matches GuitarNeck active fill (#818cf8 = indigo-400)
const ACCENT = "#818cf8";
const DIM = "#71717a"; // zinc-500

// Standard tab staff: string 1 (high e) at top, string 6 (low E) at bottom
const STRING_LABELS = ["e", "B", "G", "D", "A", "E"]; // indices 0–5 → strings 1–6

function sy(stringNum: number): number {
  return STRING_TOP + (stringNum - 1) * STRING_SPACING;
}

// ── Component ────────────────────────────────────────────────────────────────
export function TabScroller() {
  const songData = useStore((s) => s.songData);
  const currentTime = useStore((s) => s.currentTime);
  const duration = useStore((s) => s.duration);
  const seek = useStore((s) => s.seek);
  const activeTrackIndex = useStore((s) => s.activeTrackIndex);

  if (!songData) return null;
  const track = songData.tracks[activeTrackIndex] ?? songData.tracks[0];
  if (!track) return null;

  const totalSvgWidth = Math.ceil(duration * PPS) + PLAYHEAD_X + 80;

  // How far to shift the SVG left so that the current-time column sits on PLAYHEAD_X.
  // Negative when currentTime is small → SVG moves right (song start appears right of left edge).
  const offset = currentTime * PPS - PLAYHEAD_X;

  // Build set of active beat start-times for O(1) highlight lookup
  const activeBeatTimes = new Set<number>();
  for (const measure of track.measures) {
    for (const beat of measure.beats) {
      if (beat.time <= currentTime && currentTime < beat.time + beat.duration) {
        activeBeatTimes.add(beat.time);
      }
    }
  }

  // Bar lines: one per measure that has at least one beat, positioned at the
  // first beat's time (close enough for most songs; measures starting with a
  // rest will be slightly offset, which is acceptable for a visualiser).
  const barLines = track.measures
    .filter((m) => m.beats.length > 0)
    .map((m) => ({ x: m.beats[0].time * PPS, label: `${m.index + 1}` }));

  function handleClick(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    // Map screen-x back through the current scroll offset to get SVG-x → time
    const svgX = clickX + offset;
    const newTime = Math.max(0, Math.min(svgX / PPS, duration));
    transportSeek(newTime);
    seek(newTime);
  }

  return (
    <div
      className="w-full max-w-5xl mx-auto flex rounded-xl border border-zinc-800 overflow-hidden"
      style={{ height: TAB_HEIGHT, background: "#09090b" }}
    >
      {/* ── Fixed string-label column ───────────────────────────────────── */}
      <div
        className="relative flex-shrink-0 border-r border-zinc-800"
        style={{ width: LABEL_WIDTH, height: TAB_HEIGHT }}
      >
        {STRING_LABELS.map((label, i) => (
          <span
            key={i}
            className="absolute text-xs font-mono text-zinc-500 select-none"
            style={{ top: sy(i + 1) - 6, right: 7, lineHeight: 1 }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* ── Scrolling tab area ──────────────────────────────────────────── */}
      <div
        className="relative flex-1 overflow-hidden cursor-crosshair"
        onClick={handleClick}
      >
        {/* Wide SVG that slides left behind the fixed playhead */}
        <svg
          width={totalSvgWidth}
          height={TAB_HEIGHT}
          style={{
            transform: `translateX(${-offset}px)`,
            willChange: "transform",
            display: "block",
          }}
        >
          {/* String lines */}
          {STRING_LABELS.map((_, i) => {
            const s = i + 1;
            return (
              <line
                key={s}
                x1={0}
                y1={sy(s)}
                x2={totalSvgWidth}
                y2={sy(s)}
                stroke="#3f3f46"
                strokeWidth={s === 6 ? 1.2 : 0.7}
              />
            );
          })}

          {/* Bar lines + measure numbers */}
          {barLines.map((bl) => (
            <g key={bl.x}>
              <line
                x1={bl.x}
                y1={sy(1) - 6}
                x2={bl.x}
                y2={sy(6) + 6}
                stroke="#3f3f46"
                strokeWidth={0.8}
              />
              <text
                x={bl.x + 3}
                y={sy(1) - 10}
                fill="#52525b"
                fontSize={9}
                fontFamily="system-ui, sans-serif"
              >
                {bl.label}
              </text>
            </g>
          ))}

          {/* Fret numbers */}
          {track.measures.map((measure) =>
            measure.beats.map((beat) => {
              const active = activeBeatTimes.has(beat.time);
              const bx = beat.time * PPS;
              return beat.notes.map((note) => {
                const fretStr = String(note.fret);
                const boxW = fretStr.length > 1 ? 16 : 11;
                const y = sy(note.string);
                return (
                  <g key={`${beat.time}-${note.string}`}>
                    {/* Erase the string line behind the number */}
                    <rect
                      x={bx - boxW / 2}
                      y={y - 7}
                      width={boxW}
                      height={13}
                      fill="#09090b"
                    />
                    <text
                      x={bx}
                      y={y + 4}
                      textAnchor="middle"
                      fill={active ? ACCENT : DIM}
                      fontSize={11}
                      fontWeight={active ? 700 : 400}
                      fontFamily="ui-monospace, monospace"
                    >
                      {fretStr}
                    </text>
                  </g>
                );
              });
            }),
          )}
        </svg>

        {/* Playhead — fixed, not scrolling */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{
            left: PLAYHEAD_X,
            width: 1,
            background: "#ef4444",
            opacity: 0.7,
          }}
        />
      </div>
    </div>
  );
}
