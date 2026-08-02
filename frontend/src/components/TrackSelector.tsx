import { useStore } from "../store";

const C = {
  bgstart: "#606ee6ff",
  bgend: "#d77a4bff",
  surface: "#ffffffff",
  border: "#2E2E2E",
  accent: "#d77a4bff",
  text: "#000000ff",
  muted: "#161616ff",
} as const;

interface Props {
  isLoading?: boolean;
  disabled?: boolean;
}

export function TrackSelector({ isLoading = false, disabled = false }: Props) {
  const songData = useStore((s) => s.songData);
  const activeTrackIndex = useStore((s) => s.activeTrackIndex);
  const setActiveTrack = useStore((s) => s.setActiveTrack);

  if (!songData || songData.tracks.length <= 1) return null;

  const isDisabled = disabled || isLoading;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        <select
          value={activeTrackIndex}
          disabled={isDisabled}
          onChange={(e) => setActiveTrack(Number(e.target.value))}
          style={{
            appearance: "none",
            WebkitAppearance: "none",
            background: `linear-gradient(180deg, ${C.bgstart} 0%, ${C.bgend} 100%)`,
            border: `1px solid ${isDisabled ? C.muted : C.muted}`,
            borderRadius: "8px",
            color: isDisabled ? C.muted : C.text,
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            fontSize: "13px",
            fontWeight: 500,
            padding: "7px 32px 7px 12px",
            cursor: isDisabled ? "not-allowed" : "pointer",
            outline: "none",
            transition: "border-color 150ms, color 150ms",
            opacity: isDisabled ? 0.6 : 1,
          }}
          onFocus={(e) => {
            if (!isDisabled) e.currentTarget.style.borderColor = C.muted;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = C.text;
          }}
        >
          {songData.tracks.map((track, i) => (
            <option key={i} value={i} style={{ background: "#1A1A1A" }}>
              {track.name || `Track ${i + 1}`}
            </option>
          ))}
        </select>

        {/* Chevron */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isDisabled ? C.surface : C.muted}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ position: "absolute", right: 10, pointerEvents: "none" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <>
          <style>{`@keyframes bard-spin { to { transform: rotate(360deg); } }`}</style>
          <div
            title="Loading audio…"
            style={{
              width: 14,
              height: 14,
              border: "2px solid {C.text}",
              borderTopColor: C.muted,
              borderRadius: "50%",
              animation: "bard-spin 0.65s linear infinite",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "12px",
              color: "#6B6B6B",
              fontFamily: "'Space Grotesk', system-ui",
            }}
          >
            Loading audio…
          </span>
        </>
      )}
    </div>
  );
}
