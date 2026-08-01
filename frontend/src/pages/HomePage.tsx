import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFileUpload } from "../hooks/useFileUpload";
import { useStore } from "../store";
import { loadSampler, transportStop } from "../tone";
import { loadMidiIntoTone } from "../utils/loadMidiIntoTone";
import { supabase } from "../lib/supabase";
import { API_BASE_URL } from "../lib/api";
import type { Song, SongData } from "../types";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: "#0D0D0D",
  surface: "#1A1A1A",
  border: "#2E2E2E",
  accent: "#E8C547",
  text: "#F0F0F0",
  muted: "#6B6B6B",
} as const;

const DISPLAY = "'Space Grotesk', system-ui, sans-serif";
const BODY = "system-ui, sans-serif";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Tab staff watermark ───────────────────────────────────────────────────────
function TabWatermark() {
  const ys = ["16%", "31%", "46%", "61%", "76%", "91%"];
  return (
    <svg
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
      preserveAspectRatio="none"
    >
      {ys.map((y, i) => (
        <line
          key={i}
          x1="0"
          y1={y}
          x2="100%"
          y2={y}
          stroke={C.text}
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({ size = 18 }: { size?: number }) {
  return (
    <>
      <style>{`@keyframes bard-spin { to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          width: size,
          height: size,
          border: `2px solid ${C.border}`,
          borderTopColor: C.accent,
          borderRadius: "50%",
          animation: "bard-spin 0.65s linear infinite",
          flexShrink: 0,
        }}
      />
    </>
  );
}

// ── Library state ─────────────────────────────────────────────────────────────
type LibraryState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; songs: Song[] };

const COLUMNS = ["Title", "Artist", "Duration", "Tempo"];

interface SongTableProps {
  state: LibraryState;
  query: string;
  openingId: string | null;
  onRowClick: (song: Song) => void;
}

function SongTable({ state, query, openingId, onRowClick }: SongTableProps) {
  const thStyle: React.CSSProperties = {
    padding: "10px 16px",
    textAlign: "left",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    color: C.muted,
    fontFamily: DISPLAY,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };

  const emptyCell = (content: React.ReactNode) => (
    <tr>
      <td
        colSpan={4}
        style={{
          padding: "52px 16px",
          textAlign: "center",
          color: C.muted,
          fontSize: "14px",
        }}
      >
        {content}
      </td>
    </tr>
  );

  let body: React.ReactNode;

  if (state.kind === "loading") {
    body = emptyCell(
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        <Spinner /> <span>Loading library…</span>
      </div>,
    );
  } else if (state.kind === "error") {
    body = emptyCell(
      <span style={{ color: "#f87171" }}>
        Failed to load library — {state.message}
      </span>,
    );
  } else {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? state.songs.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            (s.artist ?? "").toLowerCase().includes(q),
        )
      : state.songs;

    if (filtered.length === 0) {
      body = emptyCell("No songs yet. Upload one to get started.");
    } else {
      body = filtered.map((song) => {
        const loading = openingId === song.id;
        return (
          <tr
            key={song.id}
            onClick={() => !openingId && onRowClick(song)}
            style={{
              borderBottom: `1px solid ${C.border}`,
              cursor: openingId ? "default" : "pointer",
              transition: "background 120ms",
            }}
            onMouseEnter={(e) => {
              if (!openingId)
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <td
              style={{
                padding: "12px 16px",
                fontSize: "14px",
                color: C.text,
                fontWeight: 500,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {loading && <Spinner size={14} />}
                {song.title}
              </div>
            </td>
            <td
              style={{ padding: "12px 16px", fontSize: "14px", color: C.muted }}
            >
              {song.artist ?? "—"}
            </td>
            <td
              style={{
                padding: "12px 16px",
                fontSize: "14px",
                color: C.muted,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatDuration(song.duration)}
            </td>
            <td
              style={{
                padding: "12px 16px",
                fontSize: "14px",
                color: C.muted,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {song.tempo != null ? `${song.tempo} BPM` : "—"}
            </td>
          </tr>
        );
      });
    }
  }

  return (
    <table
      style={{ width: "100%", borderCollapse: "collapse", fontFamily: BODY }}
    >
      <thead>
        <tr style={{ borderBottom: `1px solid ${C.border}` }}>
          {COLUMNS.map((col) => (
            <th key={col} style={thStyle}>
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{body}</tbody>
    </table>
  );
}

// ── Upload section ────────────────────────────────────────────────────────────
function UploadSection({ onUploaded }: { onUploaded: () => void }) {
  const { upload, status } = useFileUpload(onUploaded);
  const inputRef = useRef<HTMLInputElement>(null);

  const loading = status.kind === "loading";
  const label = loading ? status.label : "Upload Guitar Pro file";

  return (
    <div
      style={{ borderTop: `1px solid ${C.border}`, padding: "20px 20px 24px" }}
    >
      <p
        style={{
          fontSize: "13px",
          color: C.muted,
          marginBottom: "12px",
          fontFamily: BODY,
        }}
      >
        Don&rsquo;t see your song?
      </p>

      <button
        disabled={loading}
        onClick={() => !loading && inputRef.current?.click()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "9px 18px",
          border: `1px solid ${loading ? C.border : C.accent}`,
          borderRadius: "8px",
          background: "transparent",
          color: loading ? C.muted : C.accent,
          fontSize: "14px",
          fontWeight: 600,
          fontFamily: DISPLAY,
          cursor: loading ? "not-allowed" : "pointer",
          transition: "background 150ms, color 150ms",
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.background = C.accent;
            e.currentTarget.style.color = C.bg;
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = C.accent;
          }
        }}
      >
        {!loading && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        )}
        {label}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".gp,.gp3,.gp4,.gp5,.gpx"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />

      {status.kind === "error" && (
        <div
          style={{
            marginTop: "16px",
            padding: "12px 16px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "8px",
          }}
        >
          <p
            style={{
              fontSize: "11px",
              color: "#f87171",
              fontFamily: DISPLAY,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: "4px",
            }}
          >
            {status.stage}
          </p>
          <p style={{ fontSize: "13px", color: "#fca5a5", fontFamily: BODY }}>
            {status.message}
          </p>
          {status.hint && (
            <p
              style={{
                fontSize: "12px",
                color: C.muted,
                fontFamily: BODY,
                marginTop: "8px",
                paddingTop: "8px",
                borderTop: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              {status.hint}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Home page ─────────────────────────────────────────────────────────────────
export function HomePage() {
  const navigate = useNavigate();
  const setMidiCache = useStore((s) => s.setMidiCache);
  const setSongId = useStore((s) => s.setSongId);
  const user = useStore((s) => s.user);
  const [library, setLibrary] = useState<LibraryState>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);

  async function fetchLibrary() {
    try {
      const res = await fetch(`${API_BASE_URL}/songs`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const songs: Song[] = await res.json();
      setLibrary({ kind: "ready", songs });
    } catch (e) {
      setLibrary({ kind: "error", message: String(e) });
    }
  }

  useEffect(() => {
    fetchLibrary();
  }, []);

  async function handleRowClick(song: Song) {
    setOpeningId(song.id);
    try {
      const [songRes, midiRes] = await Promise.all([
        fetch(`${API_BASE_URL}/songs/${song.id}`),
        fetch(`${API_BASE_URL}/songs/${song.id}/midi`),
      ]);
      if (!songRes.ok) throw new Error(`HTTP ${songRes.status}`);
      const songData: SongData = await songRes.json();

      if (midiRes.ok) {
        const midiBytes = await midiRes.arrayBuffer();
        const midiBlob = new Blob([midiBytes], { type: "audio/midi" });
        setMidiCache(0, midiBlob);
        setSongId(song.id);
        await loadSampler();
        transportStop();
        await loadMidiIntoTone(midiBlob, 0, false);
      }

      navigate("/song", { state: { songData, songId: song.id } });
    } catch (e) {
      console.error("Failed to load song:", e);
      setOpeningId(null);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="flex flex-col md:flex-row flex-1"
        style={{ minHeight: "100vh" }}
      >
        {/* ── Left: identity ─────────────────────────────────────────────── */}
        <div
          className="relative w-full md:w-2/5 flex items-center justify-center md:justify-start border-b md:border-b-0 md:border-r"
          style={{ padding: "64px 48px", borderColor: C.border }}
        >
          <div style={{ position: "absolute", inset: 0, opacity: 0.045 }}>
            <TabWatermark />
          </div>

          <div style={{ position: "relative", zIndex: 1, maxWidth: "380px" }}>
            <h1
              style={{
                fontFamily: DISPLAY,
                fontWeight: 700,
                fontSize: "clamp(40px, 5vw, 64px)",
                letterSpacing: "0.15em",
                color: C.text,
                lineHeight: 1,
                margin: 0,
              }}
            >
              BARD
            </h1>
            <div
              style={{
                width: "48px",
                height: "2px",
                background: C.accent,
                margin: "20px 0",
              }}
            />
            <p
              style={{
                fontFamily: BODY,
                fontSize: "16px",
                lineHeight: 1.65,
                color: C.muted,
                margin: 0,
              }}
            >
              Visualize any Guitar Pro file on a real-time fretboard. Built for
              guitarists, by guitarists.
            </p>
          </div>
        </div>

        {/* ── Right: library panel ──────────────────────────────────────── */}
        <div
          className="flex flex-col flex-1 p-6 md:p-10"
          style={{ minWidth: 0 }}
        >
          <div
            className="flex flex-col flex-1"
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: "16px",
              overflow: "hidden",
            }}
          >
            {/* Panel header */}
            <div
              className="flex items-center justify-between"
              style={{
                padding: "16px 20px",
                borderBottom: `1px solid ${C.border}`,
                flexShrink: 0,
                gap: "12px",
              }}
            >
              <span
                style={{
                  fontFamily: DISPLAY,
                  fontWeight: 600,
                  fontSize: "12px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: C.muted,
                  flexShrink: 0,
                }}
              >
                Library
              </span>
              <input
                type="text"
                placeholder="Search songs…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: "8px",
                  padding: "6px 12px",
                  fontSize: "13px",
                  color: C.text,
                  fontFamily: BODY,
                  outline: "none",
                  width: "180px",
                  caretColor: C.accent,
                  transition: "border-color 150ms",
                  flexShrink: 0,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexShrink: 0,
                }}
              >
                {user?.email && (
                  <span
                    style={{
                      fontSize: "12px",
                      color: C.muted,
                      fontFamily: BODY,
                      maxWidth: "140px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {user.email}
                  </span>
                )}
              </div>
            </div>

            {/* Song table */}
            <div className="flex-1 overflow-auto">
              <SongTable
                state={library}
                query={query}
                openingId={openingId}
                onRowClick={handleRowClick}
              />
            </div>

            {/* Upload section */}
            <UploadSection onUploaded={fetchLibrary} />
          </div>
        </div>
      </div>
    </div>
  );
}
