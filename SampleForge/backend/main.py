from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio, json, time, uuid, os, shutil, subprocess
from pathlib import Path

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

ROOT = Path(__file__).resolve().parent
WORK = ROOT / "work"
WORK.mkdir(exist_ok=True)

# -------- task registry (simple in-memory) ----------
class TaskState(BaseModel):
    state: str = "queued"            # queued | running | done | error | canceled
    progress: int = 0
    message: str | None = None
    zip_url: str | None = None
    logs: list[str] = []

TASKS: dict[str, TaskState] = {}
LOG_QUEUES: dict[str, asyncio.Queue[str]] = {}

def log(task_id: str, line: str):
    s = TASKS[task_id]
    s.logs.append(line)
    q = LOG_QUEUES.get(task_id)
    if q: q.put_nowait(f"event: log\ndata: {line}\n\n")

def prog(task_id: str, pct: int):
    TASKS[task_id].progress = pct
    q = LOG_QUEUES.get(task_id)
    if q: q.put_nowait(f'event: progress\ndata: {json.dumps({"pct": pct})}\n\n')

def done(task_id: str, zip_url: str | None = None):
    s = TASKS[task_id]
    s.state = "done"; s.progress = 100
    if zip_url: s.zip_url = zip_url
    q = LOG_QUEUES.get(task_id)
    data = json.dumps({"zip_url": zip_url}) if zip_url else "{}"
    if q: q.put_nowait(f"event: done\ndata: {data}\n\n")

def fail(task_id: str, msg: str):
    s = TASKS[task_id]; s.state = "error"; s.message = msg
    q = LOG_QUEUES.get(task_id)
    if q: q.put_nowait(f"event: log\ndata: [error] {msg}\n\n")

# -------- models ----------
class Steps(BaseModel):
    download: bool = True
    split: bool = True
    analyze: bool = True
    zip: bool = True

class ProcessBody(BaseModel):
    link: str | None = None
    option: str  # "link2stems" | "getaudio" | "getdetails" | "DrumKit"
    steps: Steps
    mode: str | None = None  # "drumkit" optional

# -------- helpers ----------
def run(cmd: list[str], cwd: Path | None = None):
    return subprocess.run(cmd, cwd=str(cwd) if cwd else None, check=True)

def yt_download(link: str, outdir: Path) -> Path:
    outdir.mkdir(parents=True, exist_ok=True)
    # bestaudio -> wav (ffmpeg auto-converts)
    run(["yt-dlp", "-x", "--audio-format", "wav", "-o", f"{outdir}/%(title)s.%(ext)s", link])
    # return first wav
    wavs = list(outdir.glob("*.wav"))
    if not wavs:
        # sometimes yt-dlp yields a different ext; normalize with ffmpeg
        auds = list(outdir.glob("*.*"))
        if not auds:
            raise RuntimeError("No audio downloaded")
        src = auds[0]; dst = src.with_suffix(".wav")
        run(["ffmpeg", "-y", "-i", str(src), str(dst)])
        return dst
    return wavs[0]

def demucs_split(wav: Path, outdir: Path) -> Path:
    outdir.mkdir(parents=True, exist_ok=True)
    run(["demucs", "-o", str(outdir), str(wav)])
    # demucs creates folder named after model/song; find stems folder
    cand = next(outdir.glob("**/*/vocals.wav"), None)
    if cand:
        return cand.parent
    # fallback: return outdir if structure unknown
    return outdir

def analyze_key_bpm(audio: Path) -> tuple[str | None, float | None]:
    # lightweight analysis with librosa (Essentia is more robust; swap if you prefer)
    import librosa, numpy as np
    y, sr = librosa.load(audio, mono=True)
    tempo = float(librosa.beat.tempo(y=y, sr=sr, aggregate=None).mean()) if y.size else None
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    pc = chroma.mean(axis=1)
    # rough key from pitch class profile:
    KEYS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]
    key_idx = int(pc.argmax()) if pc.size else 0
    return KEYS[key_idx], tempo

def build_drumkit_from_stems(stems_dir: Path, outdir: Path):
    """Very simple organizer: copies stems into Kick/Snare/Hat/Perc based on filename hints.
       Replace with your real transient-slicing/classifier if you have it."""
    outdir.mkdir(parents=True, exist_ok=True)
    (outdir/"Kick").mkdir(exist_ok=True); (outdir/"Snare").mkdir(exist_ok=True)
    (outdir/"Hat").mkdir(exist_ok=True);  (outdir/"Perc").mkdir(exist_ok=True)
    for p in stems_dir.glob("*.wav"):
        name = p.name.lower()
        if "kick" in name or "drum" in name: shutil.copy(p, outdir/"Kick"/p.name)
        elif "snare" in name: shutil.copy(p, outdir/"Snare"/p.name)
        elif "hat" in name: shutil.copy(p, outdir/"Hat"/p.name)
        else: shutil.copy(p, outdir/"Perc"/p.name)

def zip_dir(src: Path, zip_path: Path) -> Path:
    if zip_path.exists(): zip_path.unlink()
    shutil.make_archive(zip_path.with_suffix(""), "zip", root_dir=src)
    return zip_path

# -------- main worker ----------
async def worker(task_id: str, body: ProcessBody):
    s = TASKS[task_id]; s.state = "running"
    jobdir = WORK / task_id; jobdir.mkdir(parents=True, exist_ok=True)
    raw_dir = jobdir / "raw"
    stems_dir = jobdir / "stems"
    out_dir = jobdir / "out"

    try:
        # 1) download / getaudio
        if body.option in ("link2stems","getaudio","DrumKit") and body.steps.download:
            log(task_id, "Analyzing link"); prog(task_id, 5)
            audio_path = yt_download(body.link, raw_dir)  # raises if fails
            log(task_id, f"Downloaded: {audio_path.name}"); prog(task_id, 15)
        else:
            # for getdetails without link, you might accept a previously uploaded file
            audio_path = next(raw_dir.glob("*.wav"), None)
            if not audio_path:
                raise RuntimeError("No audio available for analysis.")

        # 2) split
        if body.option in ("link2stems","DrumKit") and body.steps.split:
            log(task_id, "Starting AI Splitter (Demucs)"); prog(task_id, 35)
            stem_folder = demucs_split(audio_path, stems_dir)
            log(task_id, f"Stems ready: {stem_folder}"); prog(task_id, 60)
        else:
            stem_folder = None

        # 3) analyze
        if body.steps.analyze or body.option in ("getdetails","link2stems","DrumKit"):
            log(task_id, "Extracting Key & BPM"); prog(task_id, 70)
            target = audio_path if stem_folder is None else (Path(stem_folder) / "mix.wav" if (Path(stem_folder) / "mix.wav").exists() else list(Path(stem_folder).glob("*.wav"))[0])
            key, bpm = analyze_key_bpm(target)
            meta = {"key": key, "bpm": bpm}
            (jobdir/"meta.json").write_text(json.dumps(meta, indent=2))
            log(task_id, f"Key={key}, BPM≈{round(bpm,1) if bpm else '—'}"); prog(task_id, 80)

        # 4) organize (DrumKit special)
        package_dir = out_dir
        if body.option == "DrumKit":
            log(task_id, "Organizing as DrumKit (Kick/Snare/Hat/Perc)"); prog(task_id, 88)
            build_drumkit_from_stems(Path(stem_folder), out_dir)
        else:
            # default: copy raw + stems + meta to out/
            out_dir.mkdir(exist_ok=True, parents=True)
            if stem_folder: shutil.copytree(stem_folder, out_dir/"stems", dirs_exist_ok=True)
            shutil.copytree(raw_dir, out_dir/"raw", dirs_exist_ok=True)
            if (jobdir/"meta.json").exists(): shutil.copy(jobdir/"meta.json", out_dir/"meta.json")

        # 5) zip
        zip_path = jobdir / "package.zip"
        if body.steps.zip or body.option in ("link2stems","DrumKit"):
            log(task_id, "Packaging.. prepping for departure."); prog(task_id, 95)
            zip_dir(package_dir, zip_path)

        # expose a static URL (dev-only; use proper static mount in production)
        zip_url = f"/api/downloads/{task_id}"
        (jobdir/"_zip_path.txt").write_text(str(zip_path))
        log(task_id, "Process complete !"); prog(task_id, 100)
        done(task_id, zip_url=zip_url)

    except Exception as e:
        fail(task_id, str(e))

# -------- endpoints ----------
@app.post("/api/process")
async def api_process(body: ProcessBody):
    tid = uuid.uuid4().hex[:12]
    TASKS[tid] = TaskState()
    LOG_QUEUES[tid] = asyncio.Queue()
    asyncio.create_task(worker(tid, body))
    return {"task_id": tid}

@app.get("/api/status/{task_id}")
async def api_status(task_id: str):
    s = TASKS.get(task_id)
    if not s: return JSONResponse({"error": "unknown task"}, status_code=404)
    return s.model_dump()

@app.get("/api/logs/stream")
async def api_logs_stream(task_id: str):
    if task_id not in LOG_QUEUES:
        return JSONResponse({"error":"unknown task"}, status_code=404)
    queue = LOG_QUEUES[task_id]

    async def eventgen():
        # send a welcome line so the client connects immediately
        yield "event: log\ndata: connected\n\n"
        # drain existing logs (so the user sees the backlog)
        for line in TASKS[task_id].logs:
            yield f"event: log\ndata: {line}\n\n"
        while True:
            msg = await queue.get()
            yield msg

    return StreamingResponse(eventgen(), media_type="text/event-stream")

# VERY simple dev download (serve the zip). In production, mount a StaticFiles dir.
@app.get("/api/downloads/{task_id}")
def api_download(task_id: str):
    ptxt = WORK / task_id / "_zip_path.txt"
    if not ptxt.exists(): return JSONResponse({"error":"no zip"}, status_code=404)
    zpath = Path(ptxt.read_text().strip())
    if not zpath.exists(): return JSONResponse({"error":"missing zip"}, status_code=404)
    from fastapi.responses import FileResponse
    return FileResponse(str(zpath), filename=zpath.name)

# optional: health/routes if you want them later

# cd backend
# uvicorn main:app --reload