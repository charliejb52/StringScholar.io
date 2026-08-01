import os
import tempfile

from dotenv import load_dotenv

load_dotenv()

from fastapi import Body, Depends, FastAPI, HTTPException, Header, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

import guitarpro

from analysis.techniques import extract_techniques
from analysis.scale_agent import scale_agent_graph
from db.client import get_client, verify_token
from midi_gen import generate_midi_bytes, generate_midi_from_song_data
from parser import parse_gp_song

_ALLOWED_EXTENSIONS = {".gp", ".gp3", ".gp4", ".gp5", ".gpx"}

app = FastAPI(title="Bard GP Parser", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Helpers ────────────────────────────────────────────────────────────────────

async def _save_upload(file: UploadFile, suffix: str) -> str:
    content = await file.read()
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        tmp.write(content)
        tmp.flush()
        return tmp.name
    finally:
        tmp.close()


def _compute_duration(song_data: dict) -> float:
    end = 0.0
    for track in song_data.get("tracks", []):
        for measure in track.get("measures", []):
            for beat in measure.get("beats", []):
                t = beat.get("time", 0) + beat.get("duration", 0)
                if t > end:
                    end = t
    return round(end, 3)


def _persist_song(song_data: dict, techniques: dict) -> None:
    db = get_client()
    duration = _compute_duration(song_data)

    song_resp = (
        db.table("songs")
        .insert({
            "title": song_data["title"],
            "artist": song_data.get("artist"),
            "tempo": song_data["tempo"],
            "duration": duration,
            "track_count": len(song_data["tracks"]),
            **techniques,
        })
        .execute()
    )
    song_id = song_resp.data[0]["id"]

    track_rows = [
        {
            "song_id": song_id,
            "track_index": i,
            "name": t["name"],
            "tuning": t["tuning"],
            "note_data": t["measures"],
        }
        for i, t in enumerate(song_data["tracks"])
    ]
    db.table("tracks").insert(track_rows).execute()


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.post("/parse")
async def parse_endpoint(file: UploadFile):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported format '{ext}'. "
                f"Accepted: {', '.join(sorted(_ALLOWED_EXTENSIONS))}"
            ),
        )

    tmp_path = await _save_upload(file, ext)
    try:
        try:
            gp_song = guitarpro.parse(tmp_path)
        except Exception as exc:
            raise ValueError(f"Failed to parse Guitar Pro file: {exc}") from exc
        song_data = parse_gp_song(gp_song)
        techniques = extract_techniques(gp_song)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {exc}")
    finally:
        os.unlink(tmp_path)

    try:
        _persist_song(song_data, techniques)
    except Exception as exc:
        print(f"Warning: DB write failed: {exc}")

    return song_data


@app.post("/midi")
async def midi_endpoint(file: UploadFile, track_index: int = 0):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported format '{ext}'. "
                f"Accepted: {', '.join(sorted(_ALLOWED_EXTENSIONS))}"
            ),
        )

    tmp_path = await _save_upload(file, ext)
    try:
        midi_bytes = generate_midi_bytes(tmp_path, track_index=track_index)
        return Response(
            content=midi_bytes,
            media_type="audio/midi",
            headers={"Content-Disposition": "attachment; filename=song.mid"},
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {exc}")
    finally:
        os.unlink(tmp_path)

@app.post("/measures/scale")
async def scale_endpoint(measures: list = Body(...)):
    if not measures:
        raise HTTPException(status_code=403, detail="No measures provided.")
    
    scale_agent = scale_agent_graph()
    response = scale_agent.invoke({"measures": measures, "scale": []})

    return response["scale"]


@app.post("/tracks/{track_id}/parts")
async def set_track_parts(track_id: str, parts: list = Body(...)):
    """Manual test endpoint: persist split_song agent output onto a track's
    `parts` column so it can be inspected in the UI. Not wired into the
    /parse persist flow yet."""
    try:
        db = get_client()
        resp = (
            db.table("tracks")
            .update({"parts": parts})
            .eq("id", track_id)
            .execute()
        )
        if not resp.data:
            raise HTTPException(status_code=404, detail=f"Track {track_id} not found")
        return resp.data[0]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/songs")
async def list_songs():
    try:
        db = get_client()
        resp = (
            db.table("songs")
            .select(
                "id,title,artist,tempo,duration,track_count,created_at,"
                "bends,hammer_ons,pull_offs,slides,vibratos,palm_mutes,"
                "barre_chords,open_chords"
            )
            .order("created_at", desc=True)
            .execute()
        )
        return resp.data
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/songs/{song_id}/midi")
async def get_song_midi(song_id: str, track: int = 0):
    try:
        db = get_client()

        song_resp = (
            db.table("songs")
            .select("tempo")
            .eq("id", song_id)
            .execute()
        )
        if not song_resp.data:
            raise HTTPException(status_code=404, detail="Song not found")
        song_row = song_resp.data[0]
        tempo_bpm = song_row["tempo"] or 120

        track_resp = (
            db.table("tracks")
            .select("note_data")
            .eq("song_id", song_id)
            .eq("track_index", track)
            .execute()
        )
        if not track_resp.data:
            raise HTTPException(status_code=404, detail=f"Track {track} not found")

        midi_bytes = generate_midi_from_song_data(track_resp.data[0]["note_data"], tempo_bpm)
        return Response(
            content=midi_bytes,
            media_type="audio/midi",
            headers={"Content-Disposition": "attachment; filename=song.mid"},
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/songs/{song_id}")
async def get_song(song_id: str):
    try:
        db = get_client()

        song_resp = (
            db.table("songs")
            .select("*")
            .eq("id", song_id)
            .execute()
        )
        if not song_resp.data:
            raise HTTPException(status_code=404, detail="Song not found")
        song_row = song_resp.data[0]

        tracks_resp = (
            db.table("tracks")
            .select("*")
            .eq("song_id", song_id)
            .order("track_index")
            .execute()
        )
        tracks = [
            {
                "id": t["track_index"],
                "name": t["name"],
                "tuning": t["tuning"],
                "measures": t["note_data"],
                "scale_outline": t.get("scale_outlines"),
                "parts": t.get("parts"),
            }
            for t in tracks_resp.data
        ]

        return {
            "title": song_row["title"],
            "artist": song_row.get("artist"),
            "tempo": song_row["tempo"],
            "tracks": tracks,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    

    
#@app.post("/measures/theory")
#async def get_theory(measures: list, base_tempo: int):
    
