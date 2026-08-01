import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadSampler, transportStop } from '../tone';
import { loadMidiIntoTone } from '../utils/loadMidiIntoTone';
import { useStore } from '../store';
import { getAuthHeaders } from '../lib/supabase';
import { API_BASE_URL } from '../lib/api';
import type { SongData } from '../types';

export type UploadStatus =
  | { kind: 'idle' }
  | { kind: 'loading'; label: string }
  | { kind: 'error'; stage: string; message: string; hint?: string };

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.detail ?? body.message ?? res.statusText;
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}

export function useFileUpload(onSuccess?: () => void) {
  const navigate = useNavigate();
  const setGpFile = useStore((s) => s.setGpFile);
  const setMidiCache = useStore((s) => s.setMidiCache);
  const [status, setStatus] = useState<UploadStatus>({ kind: 'idle' });

  const upload = useCallback(
    async (file: File) => {
      setStatus({ kind: 'loading', label: 'Parsing file…' });

      let authHeaders: Record<string, string>;
      try {
        authHeaders = await getAuthHeaders();
      } catch {
        setStatus({ kind: 'error', stage: 'Auth', message: 'Not signed in. Please reload and sign in again.' });
        return;
      }

      const form1 = new FormData();
      form1.append('file', file);
      const form2 = new FormData();
      form2.append('file', file);

      // ── 1. Parse + MIDI in parallel ─────────────────────────────────────
      let parseRes: Response;
      let midiRes: Response;
      try {
        [parseRes, midiRes] = await Promise.all([
          fetch(`${API_BASE_URL}/parse`, { method: 'POST', headers: authHeaders, body: form1 }),
          fetch(`${API_BASE_URL}/midi`, { method: 'POST', headers: authHeaders, body: form2 }),
        ]);
      } catch (e) {
        setStatus({
          kind: 'error',
          stage: 'Network',
          message: String(e),
          hint: 'Make sure the backend is running: uv run uvicorn main:app --port 8000',
        });
        return;
      }

      if (!parseRes.ok) {
        setStatus({
          kind: 'error',
          stage: `POST /parse → ${parseRes.status}`,
          message: await readErrorDetail(parseRes),
        });
        return;
      }
      if (!midiRes.ok) {
        setStatus({
          kind: 'error',
          stage: `POST /midi → ${midiRes.status}`,
          message: await readErrorDetail(midiRes),
          hint: 'If the error mentions "mido", run: uv sync (in backend/)',
        });
        return;
      }

      // ── 2. Decode ───────────────────────────────────────────────────────
      let songData: SongData;
      let midiBytes: ArrayBuffer;
      try {
        [songData, midiBytes] = await Promise.all([parseRes.json(), midiRes.arrayBuffer()]);
      } catch (e) {
        setStatus({ kind: 'error', stage: 'Decoding response', message: String(e) });
        return;
      }

      // ── 3. SoundFont + schedule ─────────────────────────────────────────
      setStatus({ kind: 'loading', label: 'Loading guitar samples…' });
      try {
        await loadSampler();
      } catch (e) {
        setStatus({
          kind: 'error',
          stage: 'SoundFont',
          message: String(e),
          hint: 'Check your network connection.',
        });
        return;
      }

      const midiBlob = new Blob([midiBytes], { type: 'audio/midi' });
      try {
        transportStop();
        await loadMidiIntoTone(midiBlob, 0, false);
      } catch (e) {
        setStatus({ kind: 'error', stage: 'Note scheduling', message: String(e) });
        return;
      }

      // Seed the cache so track 0 is never re-fetched, and store the source file
      // so useMidiTrack can request other tracks on demand.
      setMidiCache(0, midiBlob);
      setGpFile(file);

      onSuccess?.();
      navigate('/song', { state: { songData } });
    },
    [navigate, onSuccess, setGpFile, setMidiCache],
  );

  return { upload, status };
}
