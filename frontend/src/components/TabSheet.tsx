import React, { useMemo, useRef, useEffect } from "react";
import { useStore } from "../store";
import type { Measure } from "../types";

// ── Layout constants ───────────────────────────────────────────────────────────
const MEASURES_PER_ROW = 4;
const PX_PER_SEC = 100;
const STRING_GAP = 18;
const ROW_HEIGHT = 160; // nominal for 6 strings; actual computed from numStrings
const LEFT_PAD = 52; // includes string-label gutter
const TOP = 32; // space above staff for measure numbers

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

// Standard 6-string labels: index 0 = string 1 (high e) = top staff line
const STRING_LABELS_6 = ["e", "B", "G", "D", "A", "E"];

// ── Row data ───────────────────────────────────────────────────────────────────
interface RowData {
  rowIndex: number;
  measures: Measure[];
  rowStartTime: number;
  rowEndTime: number;
}

function groupIntoRows(measures: Measure[]): RowData[] {
  const rows: RowData[] = [];
  for (let i = 0; i < measures.length; i += MEASURES_PER_ROW) {
    const chunk = measures.slice(i, i + MEASURES_PER_ROW);

    // Start time: first beat in the chunk
    let rowStartTime = rows.length > 0 ? rows[rows.length - 1].rowEndTime : 0;
    for (const m of chunk) {
      if (m.beats.length > 0) {
        rowStartTime = m.beats[0].time;
        break;
      }
    }

    // End time: last beat's end in the chunk
    let rowEndTime = rowStartTime + 4;
    for (let j = chunk.length - 1; j >= 0; j--) {
      const m = chunk[j];
      if (m.beats.length > 0) {
        const lb = m.beats[m.beats.length - 1];
        rowEndTime = lb.time + lb.duration;
        break;
      }
    }

    rows.push({
      rowIndex: rows.length,
      measures: chunk,
      rowStartTime,
      rowEndTime,
    });
  }
  return rows;
}

// ── TabRow ─────────────────────────────────────────────────────────────────────
interface TabRowProps {
  row: RowData;
  numStrings: number;
  rowWidth: number;
  rowHeight: number;
}

const TabRow = React.memo(function TabRow({
  row,
  numStrings,
  rowWidth,
  rowHeight,
}: TabRowProps) {
  const { measures, rowStartTime } = row;
  const staffH = (numStrings - 1) * STRING_GAP;
  const labels =
    numStrings === 6
      ? STRING_LABELS_6
      : Array.from({ length: numStrings }, (_, i) => `${i + 1}`);

  return (
    <svg width={rowWidth} height={rowHeight} style={{ display: "block" }}>
      {/* Background */}
      <rect width={rowWidth} height={rowHeight} fill={C.surface} />

      {/* Row separator line (drawn in SVG so no border-box sizing issues) */}
      <line
        x1={0}
        y1={rowHeight - 0.5}
        x2={rowWidth}
        y2={rowHeight - 0.5}
        stroke="#1a1a1a"
        strokeWidth={1}
      />

      {/* String labels — left gutter */}
      {labels.map((label, i) => (
        <text
          key={i}
          x={LEFT_PAD - 6}
          y={TOP + i * STRING_GAP + 4}
          textAnchor="end"
          fill={C.text}
          fontSize={10}
          fontFamily="ui-monospace, monospace"
        >
          {label}
        </text>
      ))}

      {/* String lines */}
      {Array.from({ length: numStrings }, (_, i) => (
        <line
          key={i}
          x1={LEFT_PAD}
          y1={TOP + i * STRING_GAP}
          x2={rowWidth - 8}
          y2={TOP + i * STRING_GAP}
          stroke={C.text}
          strokeWidth={i === numStrings - 1 ? 1.2 : 0.7}
        />
      ))}

      {/* Bar lines + measure numbers */}
      {measures.map((measure) => {
        if (!measure.beats.length) return null;
        const bx =
          LEFT_PAD + (measure.beats[0].time - rowStartTime) * PX_PER_SEC;
        return (
          <g key={measure.index}>
            <line
              x1={bx}
              y1={TOP - 6}
              x2={bx}
              y2={TOP + staffH + 6}
              stroke={C.text}
              strokeWidth={0.8}
            />
            <text
              x={bx + 3}
              y={TOP - 10}
              fill={C.text}
              fontSize={9}
              fontFamily="system-ui, sans-serif"
            >
              {measure.index + 1}
            </text>
          </g>
        );
      })}

      {/* Fret numbers — backing rect erases the string line so the number reads cleanly */}
      {measures.map((measure) =>
        measure.beats.map((beat) => {
          const bx = LEFT_PAD + (beat.time - rowStartTime) * PX_PER_SEC;
          return beat.notes.map((note) => {
            const fretStr = String(note.fret);
            const boxW = fretStr.length > 1 ? 16 : 11;
            // note.string is 1-indexed; string 1 (high e) maps to the top staff line
            const sy = TOP + (note.string - 1) * STRING_GAP;
            return (
              <g key={`${beat.time}-${note.string}`}>
                <rect
                  x={bx - boxW / 2}
                  y={sy - 7}
                  width={boxW}
                  height={13}
                  fill={C.surface}
                />
                <text
                  x={bx}
                  y={sy + 4}
                  textAnchor="middle"
                  fill={C.text}
                  fontSize={11}
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
  );
});

// ── Cursor ─────────────────────────────────────────────────────────────────────
// Only this component subscribes to currentTime — everything else is static.

interface CursorProps {
  rows: RowData[];
  rowRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  numStrings: number;
  rowHeight: number;
}

function Cursor({ rows, rowRefs, numStrings, rowHeight }: CursorProps) {
  const t = useStore((s) => s.currentTime);
  const prevRowRef = useRef(-1);

  // Find the last row whose rowStartTime ≤ t (handles the final row's tail too)
  let activeRowIndex = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (t >= rows[i].rowStartTime) {
      activeRowIndex = i;
      break;
    }
  }

  // Smooth-scroll the new row into view only when the row index changes
  useEffect(() => {
    if (activeRowIndex !== prevRowRef.current) {
      prevRowRef.current = activeRowIndex;
      rowRefs.current[activeRowIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeRowIndex, rowRefs]);

  if (!rows.length) return null;

  const activeRow = rows[activeRowIndex];
  const staffH = (numStrings - 1) * STRING_GAP;

  const x = LEFT_PAD + (t - activeRow.rowStartTime) * PX_PER_SEC;
  const top = activeRowIndex * rowHeight + TOP - 4;
  const height = staffH + 8;

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: x,
        top,
        width: 2,
        height,
        background: C.accent,
        opacity: 0.85,
        pointerEvents: "none",
        borderRadius: 1,
      }}
    />
  );
}

// ── TabSheet ───────────────────────────────────────────────────────────────────
export function TabSheet() {
  const songData = useStore((s) => s.songData);
  const activeTrackIndex = useStore((s) => s.activeTrackIndex);

  const { rows, numStrings } = useMemo(() => {
    if (!songData) return { rows: [] as RowData[], numStrings: 6 };
    const track = songData.tracks[activeTrackIndex] ?? songData.tracks[0];
    if (!track) return { rows: [] as RowData[], numStrings: 6 };
    return {
      rows: groupIntoRows(track.measures),
      numStrings: track.tuning.length || 6,
    };
  }, [songData, activeTrackIndex]);

  // Actual row height adapts to string count; clamped to at least ROW_HEIGHT
  const rowHeight = Math.max(
    ROW_HEIGHT,
    TOP + (numStrings - 1) * STRING_GAP + 32,
  );

  // Each row's SVG width is proportional to that row's duration
  const rowWidths = useMemo(
    () =>
      rows.map(
        (r) => LEFT_PAD + (r.rowEndTime - r.rowStartTime) * PX_PER_SEC + 48,
      ),
    [rows],
  );

  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  if (!rows.length) return null;

  return (
    <div
      style={{
        height: "100%",
        position: "relative",
        overflowY: "auto",
        overflowX: "auto",
        background: C.surface,
        borderRadius: 12,
        border: "1px solid #2E2E2E",
      }}
    >
      {rows.map((row, i) => (
        <div
          key={i}
          ref={(el) => {
            rowRefs.current[i] = el;
          }}
          style={{ height: rowHeight }}
        >
          <TabRow
            row={row}
            numStrings={numStrings}
            rowWidth={rowWidths[i]}
            rowHeight={rowHeight}
          />
        </div>
      ))}

      <Cursor
        rows={rows}
        rowRefs={rowRefs}
        numStrings={numStrings}
        rowHeight={rowHeight}
      />
    </div>
  );
}
