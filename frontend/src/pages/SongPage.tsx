import { useEffect } from "react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../store";
import { transportStop } from "../tone";
import { usePlaybackLoop } from "../hooks/usePlaybackLoop";
import { useMidiTrack } from "../hooks/useMidiTrack";
import { TabSheet } from "../components/TabSheet";
import { PlaybackBar } from "../components/PlaybackBar";
import { TrackSelector } from "../components/TrackSelector";
import type { SongData } from "../types";
import { NeckPanel } from "../components/NeckPanel";
import { API_BASE_URL } from "../lib/api";

const C = {
  bgstart: "#606ee6ff",
  bgend: "#d77a4bff",
  surface: "#ffffffff",
  border: "#2E2E2E",
  accent: "#d77a4bff",
  text: "#000000ff",
  muted: "#161616ff",
} as const;

export function SongPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const setSongData = useStore((s) => s.setSongData);
  const setSongId = useStore((s) => s.setSongId);
  const clearSong = useStore((s) => s.clearSong);
  const songData = useStore((s) => s.songData);
  const activeTrackIndex = useStore((s) => s.activeTrackIndex);
  const [neckOpen, setNeckOpen] = useState(false);

  usePlaybackLoop();
  const { isLoadingMidi } = useMidiTrack();

  const handleGetScale = async () => {
    if (!songData) return;
    const measures = songData.tracks[activeTrackIndex]?.measures ?? [];
    try {
      const res = await fetch(`${API_BASE_URL}/measures/scale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(measures),
      });
      const text = await res.text();
      console.log(text);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const state = location.state as {
      songData?: SongData;
      songId?: string;
    } | null;
    if (state?.songData) {
      setSongData(state.songData);
      if (state.songId) setSongId(state.songId);
    } else {
      navigate("/", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!songData) return null;

  return (
    <div
      style={{
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: `linear-gradient(180deg, ${C.bgstart} 0%, ${C.bgend} 100%)`,
        color: C.text,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between py-5"
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: "16px",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div>
            <h1
              style={{
                fontFamily: "'Blippo', fantasy",
                fontSize: 20,
                fontWeight: 700,
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              {songData.title}
            </h1>
            <p style={{ fontSize: 13, color: C.muted, margin: "3px 0 0" }}>
              {songData.tempo} BPM &middot; {songData.tracks.length} track
              {songData.tracks.length !== 1 ? "s" : ""}
            </p>
          </div>
          <TrackSelector isLoading={isLoadingMidi} disabled={isLoadingMidi} />
        </div>

        <button
          onClick={() => setNeckOpen((o) => !o)}
          aria-pressed={neckOpen}
          style={{
            background: neckOpen
              ? C.surface
              : `linear-gradient(180deg, ${C.bgstart} 0%, ${C.bgend} 100%)`,
            color: C.text,
            border: "1px solid ${C.text}",
            fontSize: 14,
            padding: "6px 12px",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          {neckOpen ? "Hide neck" : "Show neck"}
        </button>

        <button
          onClick={() => {
            transportStop();
            clearSong();
            navigate("/");
          }}
          style={{
            background: "none",
            border: "none",
            color: "#6B6B6B",
            fontSize: 14,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#F0F0F0";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#6B6B6B";
          }}
        >
          ← Library
        </button>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "row",
          padding: "24px 32px 0",
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <TabSheet />
          <div
            style={{
              flexShrink: 0,
              maxWidth: "80rem",
              width: "100%",
              margin: "0 auto",
              paddingBottom: 24,
            }}
          >
            <PlaybackBar />
          </div>
        </div>

        <NeckPanel open={neckOpen} />
      </main>
    </div>
  );
}
