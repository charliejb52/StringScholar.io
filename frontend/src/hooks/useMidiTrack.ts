import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { loadSampler } from '../tone';
import { loadMidiIntoTone } from '../utils/loadMidiIntoTone';
import { getAuthHeaders } from '../lib/supabase';
import { API_BASE_URL } from '../lib/api';

/**
 * Watches activeTrackIndex and swaps Tone.js notes whenever the track
 * changes. Implements a session-scoped MIDI cache so each track is only
 * fetched once per song.
 *
 * Call this hook once inside SongPage. Returns { isLoadingMidi } so the
 * UI can disable the TrackSelector while a fetch is in flight.
 */
export function useMidiTrack() {
  const activeTrackIndex = useStore((s) => s.activeTrackIndex);
  const gpFile = useStore((s) => s.gpFile);
  const songId = useStore((s) => s.songId);
  const midiCache = useStore((s) => s.midiCache);
  const setMidiCache = useStore((s) => s.setMidiCache);

  const [isLoadingMidi, setIsLoadingMidi] = useState(false);

  useEffect(() => {
    // Snapshot playback state at the moment the track changes.
    // We intentionally do NOT include currentTime/isPlaying in the deps array
    // because they change every animation frame — we only want to react to
    // activeTrackIndex.
    const { currentTime, isPlaying } = useStore.getState();

    let cancelled = false;

    async function switchTrack() {
      setIsLoadingMidi(true);
      try {
        let blob = midiCache[activeTrackIndex];

        if (!blob) {
          const authHeaders = await getAuthHeaders();
          let res: Response;
          if (gpFile) {
            const form = new FormData();
            form.append('file', gpFile);
            res = await fetch(
              `${API_BASE_URL}/midi?track_index=${activeTrackIndex}`,
              { method: 'POST', headers: authHeaders, body: form },
            );
          } else if (songId) {
            res = await fetch(
              `${API_BASE_URL}/songs/${songId}/midi?track=${activeTrackIndex}`,
              { headers: authHeaders },
            );
          } else {
            return;
          }
          if (!res.ok) throw new Error(`MIDI fetch failed: HTTP ${res.status}`);
          blob = await res.blob();

          if (cancelled) return;
          setMidiCache(activeTrackIndex, blob);
        }

        await loadSampler();
        if (cancelled) return;
        await loadMidiIntoTone(blob, currentTime, isPlaying);
      } catch (err) {
        if (!cancelled) console.error('[useMidiTrack] failed to switch track audio:', err);
      } finally {
        if (!cancelled) setIsLoadingMidi(false);
      }
    }

    switchTrack();

    return () => { cancelled = true; };
  // midiCache and gpFile intentionally excluded — only react to track/song identity changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTrackIndex, songId]);

  return { isLoadingMidi };
}
