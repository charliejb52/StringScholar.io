import { useCallback, useState } from 'react';
import { useStore } from '../store';
import { loadSampler, scheduleNotes, transportStop } from '../tone';
import type { SongData } from '../types';
import { API_BASE_URL } from '../lib/api';

type Step =
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

export function FileUpload() {
  const setSongData = useStore((s) => s.setSongData);
  const [step, setStep] = useState<Step>({ kind: 'idle' });

  const handleFile = useCallback(
    async (file: File) => {
      setStep({ kind: 'loading', label: 'Parsing file…' });

      const form1 = new FormData();
      form1.append('file', file);
      const form2 = new FormData();
      form2.append('file', file);

      // ── 1. Parse + MIDI export (parallel) ──────────────────────────────────
      let parseRes: Response;
      let midiRes: Response;
      try {
        [parseRes, midiRes] = await Promise.all([
          fetch(`${API_BASE_URL}/parse`, { method: 'POST', body: form1 }),
          fetch(`${API_BASE_URL}/midi`, { method: 'POST', body: form2 }),
        ]);
      } catch (e) {
        setStep({
          kind: 'error',
          stage: 'Network',
          message: String(e),
          hint: 'Make sure the backend is running: uv run uvicorn main:app --port 8000',
        });
        return;
      }

      if (!parseRes.ok) {
        setStep({
          kind: 'error',
          stage: `POST /parse → ${parseRes.status}`,
          message: await readErrorDetail(parseRes),
        });
        return;
      }
      if (!midiRes.ok) {
        setStep({
          kind: 'error',
          stage: `POST /midi → ${midiRes.status}`,
          message: await readErrorDetail(midiRes),
          hint: 'If the error mentions "mido", run: uv sync (in backend/)',
        });
        return;
      }

      // ── 2. Decode responses ─────────────────────────────────────────────────
      let songData: SongData;
      let midiBytes: ArrayBuffer;
      try {
        [songData, midiBytes] = await Promise.all([
          parseRes.json(),
          midiRes.arrayBuffer(),
        ]);
      } catch (e) {
        setStep({ kind: 'error', stage: 'Decoding response', message: String(e) });
        return;
      }

      // ── 3. SoundFont + note scheduling ─────────────────────────────────────
      setStep({ kind: 'loading', label: 'Loading guitar samples…' });
      try {
        await loadSampler();
      } catch (e) {
        setStep({
          kind: 'error',
          stage: 'SoundFont',
          message: String(e),
          hint: 'The guitar sample library failed to load — check your network connection.',
        });
        return;
      }

      try {
        transportStop();
        await scheduleNotes(midiBytes);
      } catch (e) {
        setStep({ kind: 'error', stage: 'Note scheduling', message: String(e) });
        return;
      }

      setSongData(songData);
      setStep({ kind: 'idle' });
    },
    [setSongData],
  );

  const loading = step.kind === 'loading';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 bg-zinc-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white tracking-tight">Bard</h1>
        <p className="mt-2 text-zinc-400">Upload a Guitar Pro file to visualize it</p>
      </div>

      <label
        className={`cursor-pointer px-8 py-4 rounded-xl font-medium transition
          ${loading
            ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
          }`}
      >
        {loading ? (step as { kind: 'loading'; label: string }).label : 'Choose File'}
        <input
          type="file"
          accept=".gp,.gp3,.gp4,.gp5,.gpx"
          className="hidden"
          disabled={loading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </label>

      <p className="text-zinc-600 text-sm">.gp · .gp3 · .gp4 · .gp5 · .gpx</p>

      {step.kind === 'error' && (
        <div className="max-w-md w-full mx-4 bg-red-950/50 border border-red-800 rounded-xl p-4 space-y-2">
          <p className="text-red-400 text-xs font-mono uppercase tracking-wider">
            {step.stage}
          </p>
          <p className="text-red-200 text-sm">{step.message}</p>
          {step.hint && (
            <p className="text-zinc-400 text-xs border-t border-red-900 pt-2">{step.hint}</p>
          )}
        </div>
      )}
    </div>
  );
}
