import type { Note } from "../types";

const C = {
  bgstart: "#606ee6ff",
  bgend: "#d77a4bff",
  surface: "#ffffffff",
  border: "#2E2E2E",
  accent: "#d77a4bff",
  text: "#000000ff",
  muted: "#161616ff",
} as const;

// ── Layout constants (VERTICAL neck: frets run top→bottom, strings left→right) ──
const FRET_COUNT = 24;
const STRING_COUNT = 6;

const STRING_SPACING = 32; // x gap between strings
const NECK_LEFT = 44; // x of leftmost string (low E)
const NECK_WIDTH = (STRING_COUNT - 1) * STRING_SPACING; // 160
const NECK_RIGHT = NECK_LEFT + NECK_WIDTH; // 204

const NUT_Y = 46; // y of the nut (fret-0 wire)
const OPEN_Y = 24; // y of open-string circles (above nut)
const FRET_SPACING = 32; // y gap between fret wires
const NECK_BOTTOM = NUT_Y + FRET_COUNT * FRET_SPACING;

const SVG_WIDTH = 240;
const SVG_HEIGHT = NECK_BOTTOM + 20;

// Inlay markers: singles at 3·5·7·9·15·17·19·21, doubles at 12·24
const SINGLE_DOT_FRETS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_DOT_FRETS = [12, 24];
const LABEL_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];

const NECK_MID_X = NECK_LEFT + ((STRING_COUNT - 1) * STRING_SPACING) / 2; // 124
const DOUBLE_DOT_XS = [
  NECK_LEFT + STRING_SPACING * 1.5,
  NECK_LEFT + STRING_SPACING * 3.5,
]; // 92, 156

// String 6 (low E) on the LEFT, string 1 (high E) on the RIGHT — chord-diagram view.
function stringX(s: number): number {
  return NECK_LEFT + (6 - s) * STRING_SPACING;
}

// A fretted note sits just behind its fret wire; open strings sit above the nut.
function fretCy(fret: number): number {
  if (fret === 0) return OPEN_Y;
  return NUT_Y + (fret - 0.5) * FRET_SPACING;
}

function fretWireY(i: number): number {
  return NUT_Y + i * FRET_SPACING;
}

// Low E (string 6) is the thickest string.
function stringWidth(s: number): number {
  return 0.5 + (s - 1) * 0.28;
}

interface Props {
  activeNotes: Note[];
  scaleNotes?: Note[];
}

export function GuitarNeck({ activeNotes, scaleNotes = [] }: Props) {
  const activeSet = new Set(activeNotes.map((n) => `${n.string}-${n.fret}`));
  const scaleSet = new Set(scaleNotes.map((n) => `${n.string}-${n.fret}`));

  return (
    // fill the panel height; width follows the aspect ratio so the tall neck stays narrow
    <div
      style={{
        height: "100%",
        display: "flex",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        preserveAspectRatio="xMidYMin meet"
        style={{ height: "100%", width: "auto", display: "block" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Fretboard body */}
        <rect
          x={NECK_LEFT - 14}
          y={NUT_Y}
          width={NECK_WIDTH + 28}
          height={FRET_COUNT * FRET_SPACING}
          rx={3}
          fill="#1e1208"
        />

        {/* Open-string area (above the nut) */}
        <rect
          x={NECK_LEFT - 14}
          y={OPEN_Y - 14}
          width={NECK_WIDTH + 28}
          height={NUT_Y - (OPEN_Y - 14)}
          rx={3}
          fill="#14100a"
        />

        {/* Inlay dots */}
        {SINGLE_DOT_FRETS.map((fret) => (
          <circle
            key={fret}
            cx={NECK_MID_X}
            cy={fretCy(fret)}
            r={5}
            fill="#3a2a18"
          />
        ))}
        {DOUBLE_DOT_FRETS.map((fret) =>
          DOUBLE_DOT_XS.map((x, i) => (
            <circle
              key={`${fret}-${i}`}
              cx={x}
              cy={fretCy(fret)}
              r={5}
              fill="#3a2a18"
            />
          )),
        )}

        {/* Fret wires (nut = i 0, gold and thick) */}
        {Array.from({ length: FRET_COUNT + 1 }).map((_, i) => (
          <line
            key={i}
            x1={NECK_LEFT - 14}
            y1={fretWireY(i)}
            x2={NECK_RIGHT + 14}
            y2={fretWireY(i)}
            stroke={i === 0 ? "#c8a84b" : "#3d2e1c"}
            strokeWidth={i === 0 ? 3 : 1}
          />
        ))}

        {/* Strings */}
        {Array.from({ length: STRING_COUNT }).map((_, i) => {
          const s = i + 1;
          return (
            <line
              key={s}
              x1={stringX(s)}
              y1={OPEN_Y - 6}
              x2={stringX(s)}
              y2={NECK_BOTTOM}
              stroke="#8a7a6a"
              strokeWidth={stringWidth(s)}
            />
          );
        })}

        {/* Note circles — every string/fret intersection, lit when active */}
        {Array.from({ length: STRING_COUNT }).map((_, si) => {
          const s = si + 1;
          return Array.from({ length: FRET_COUNT + 1 }).map((_, fret) => {
            const key = `${s}-${fret}`;
            const active = activeSet.has(key);
            const inScale = scaleSet.has(key);
            const fill = active
              ? C.bgstart
              : inScale
                ? "#eab308"
                : "transparent";
            const stroke = active
              ? "#a5b4fc"
              : inScale
                ? "#fde047"
                : "transparent";
            return (
              <circle
                key={key}
                cx={stringX(s)}
                cy={fretCy(fret)}
                r={9}
                fill={fill}
                stroke={stroke}
                strokeWidth={1.5}
                style={{ transition: "fill 40ms, stroke 40ms" }}
              />
            );
          });
        })}

        {/* Fret number labels (down the left edge) */}
        {LABEL_FRETS.map((fret) => (
          <text
            key={fret}
            x={NECK_LEFT - 28}
            y={fretCy(fret)}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#4b5563"
            fontSize={11}
            fontFamily="system-ui, sans-serif"
          >
            {fret}
          </text>
        ))}
      </svg>
    </div>
  );
}
