import { DrumGrid } from "./DrumGrid.js";
import { SoundEngine } from "./SoundEngine.js";
import { exportPatternWav } from "./Exporter.js";

// ---------- Global App State ----------
const state = {
  bpm: 120,
  timeSig: "4/4",
  stepsPerBeat: 4,
  stepsPerPattern: patternSteps("4/4", 4),
  tracks: [], // see createDefaultTracks()
};

// ---------- DOM ----------
const gridContainer = document.getElementById("gridContainer");
const mixerContainer = document.getElementById("mixerContainer");
const playBtn = document.getElementById("playBtn");
const stopBtn = document.getElementById("stopBtn");
const tempoInput = document.getElementById("tempoInput");
const timeSignatureSelect = document.getElementById("timeSignatureSelect");
const stepsPerBeatSelect = document.getElementById("stepsPerBeatSelect");
const addSoundBtn = document.getElementById("addSoundBtn");
const addSoundFile = document.getElementById("addSoundFile");
const exportBtn = document.getElementById("exportBtn");
const clearPatternBtn = document.getElementById("clearPatternBtn");

// ---------- Components ----------
const grid = new DrumGrid({
  container: gridContainer,
  getState: () => state,
  onToggleStep: (tIdx, sIdx) => {
    state.tracks[tIdx].steps[sIdx] = !state.tracks[tIdx].steps[sIdx];
    grid.refreshActiveStates();
  },
  onChangeRowName: (tIdx, newName) => {
    state.tracks[tIdx].name = newName;
    renderUI();
  },
});

const engine = new SoundEngine(
  () => state,
  (stepIdx) => grid.updatePlayhead(stepIdx)
);

// ---------- Init ----------
createDefaultTracks();
renderUI();

// ---------- UI Wiring ----------
playBtn.addEventListener("click", async () => {
  await engine.start();
  playBtn.disabled = true;
  stopBtn.disabled = false;
});
stopBtn.addEventListener("click", () => {
  engine.stop();
  playBtn.disabled = false;
  stopBtn.disabled = true;
});
tempoInput.addEventListener("input", () => {
  const v = clamp(parseInt(tempoInput.value || "120", 10), 40, 240);
  state.bpm = v;
});
timeSignatureSelect.addEventListener("change", () => {
  state.timeSig = timeSignatureSelect.value;
  state.stepsPerPattern = patternSteps(state.timeSig, state.stepsPerBeat);
  resizePatterns();
  renderUI();
});
stepsPerBeatSelect.addEventListener("change", () => {
  state.stepsPerBeat = parseInt(stepsPerBeatSelect.value, 10);
  state.stepsPerPattern = patternSteps(state.timeSig, state.stepsPerBeat);
  resizePatterns();
  renderUI();
});
addSoundBtn.addEventListener("click", () => addSoundFile.click());
addSoundFile.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await addUploadedTrack(file);
  e.target.value = "";
});
exportBtn.addEventListener("click", async () => {
  exportBtn.disabled = true;
  exportBtn.textContent = "Rendering...";
  try {
    const blob = await exportPatternWav({ state });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "drum_sequence.wav";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert("Export failed. See console for details.");
  } finally {
    exportBtn.disabled = false;
    exportBtn.textContent = "⬇️ Export .wav";
  }
});
clearPatternBtn.addEventListener("click", () => {
  state.tracks.forEach((t) => t.steps.fill(false));
  grid.refreshActiveStates();
});

// ---------- Helpers ----------
function patternSteps(timeSig, stepsPerBeat) {
  const [num, den] = timeSig.split("/").map(Number);
  const beats = num || 4;
  return beats * stepsPerBeat;
}

function resizePatterns() {
  const len = state.stepsPerPattern;
  state.tracks.forEach((t) => {
    if (t.steps.length === len) return;
    const next = new Array(len).fill(false);
    for (let i = 0; i < Math.min(len, t.steps.length); i++)
      next[i] = t.steps[i];
    t.steps = next;
  });
}

function renderUI() {
  grid.render();
  renderMixer();
  engine.updateMixerParams(state.tracks);
}

function renderMixer() {
  mixerContainer.innerHTML = "";
  state.tracks.forEach((t, idx) => {
    const el = document.createElement("div");
    el.className = "channel";
    el.innerHTML = `
      <div class="chan-head">
        <span class="title">${t.name}</span>
        <span class="badge">${
          t.source === "buffer" ? "sample" : t.synthType
        }</span>
      </div>
      <div class="file-row">
        <input type="file" data-idx="${idx}" accept="audio/*" />
        <span class="small">replace sample (optional)</span>
      </div>
      <div class="slider-row">
        <label>Volume</label>
        <input type="range" min="0" max="1" step="0.01" value="${
          t.mixer.volume
        }" data-ctl="volume" data-idx="${idx}" />
      </div>
      <div class="slider-row">
        <label>Reverb</label>
        <input type="range" min="0" max="1" step="0.01" value="${
          t.mixer.reverb
        }" data-ctl="reverb" data-idx="${idx}" />
      </div>
      <div class="slider-row">
        <label>Delay Time (s)</label>
        <input type="range" min="0" max="1" step="0.01" value="${
          t.mixer.delayTime
        }" data-ctl="delayTime" data-idx="${idx}" />
      </div>
      <div class="slider-row">
        <label>Delay Feedback</label>
        <input type="range" min="0" max="0.95" step="0.01" value="${
          t.mixer.delayFeedback
        }" data-ctl="delayFeedback" data-idx="${idx}" />
      </div>
      <div class="slider-row">
        <label>Distortion</label>
        <input type="range" min="0" max="1" step="0.01" value="${
          t.mixer.distortion
        }" data-ctl="distortion" data-idx="${idx}" />
      </div>
    `;
    mixerContainer.appendChild(el);
  });

  // wire sliders + file inputs
  mixerContainer.querySelectorAll('input[type="range"]').forEach((input) => {
    input.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      const ctl = e.target.dataset.ctl;
      state.tracks[idx].mixer[ctl] = parseFloat(e.target.value);
      engine.updateMixerParams(state.tracks);
    });
  });

  mixerContainer.querySelectorAll('input[type="file"]').forEach((input) => {
    input.addEventListener("change", async (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      const file = e.target.files?.[0];
      if (!file) return;
      const buffer = await engine.decodeFile(file);
      state.tracks[idx].buffer = buffer;
      state.tracks[idx].source = "buffer";
      state.tracks[idx].name = file.name.replace(/\.[^.]+$/, "");
      renderUI();
    });
  });
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ---------- Defaults ----------
async function createDefaultTracks() {
  // Pre-fill with common rows. Attempt to fetch assets; if not found, use synth fallback.
  const defaults = [
    { name: "Kick", file: "./assets/Kick.wav", synthType: "kick" },
    { name: "Snare", file: "./assets/Snare.wav", synthType: "snare" },
    { name: "Clap", file: "./assets/Clap.wav", synthType: "clap" },
    { name: "HiHat", file: "./assets/HiHat.wav", synthType: "hihat" },
    { name: "OpenHat", file: "./assets/OpenHat.wav", synthType: "hihat" },
    { name: "Crash", file: "./assets/Crash.wav", synthType: "hihat" },
  ];

  state.tracks = await Promise.all(
    defaults.map(async (d) => {
      let buffer = null;
      try {
        buffer = await fetchAudioBufferSafe(d.file);
      } catch {}
      return {
        id: crypto.randomUUID(),
        name: d.name,
        source: buffer ? "buffer" : "synth",
        buffer,
        synthType: d.synthType,
        steps: new Array(state.stepsPerPattern).fill(false),
        mixer: {
          volume: 0.8,
          reverb: d.name === "Crash" ? 0.35 : 0.1,
          delayTime: d.name === "Clap" ? 0.08 : 0,
          delayFeedback: d.name === "Clap" ? 0.2 : 0,
          distortion: 0,
        },
      };
    })
  );

  // simple starter pattern (4/4)
  const idxByName = Object.fromEntries(state.tracks.map((t, i) => [t.name, i]));
  fillSteps(idxByName["Kick"], [0, 8]);
  fillSteps(idxByName["Snare"], [4, 12]);
  for (let s = 2; s < state.stepsPerPattern; s += 4)
    state.tracks[idxByName["HiHat"]].steps[s] = true;

  renderUI();
}

function fillSteps(trackIdx, steps) {
  if (trackIdx == null) return;
  steps.forEach((s) => {
    if (s < state.stepsPerPattern) state.tracks[trackIdx].steps[s] = true;
  });
}

async function fetchAudioBufferSafe(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("fetch failed");
  const arrayBuf = await res.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const temp = new AudioCtx();
  const decoded = await temp.decodeAudioData(arrayBuf);
  temp.close();
  return decoded;
}

async function addUploadedTrack(file) {
  const buffer = await engine.decodeFile(file);
  const track = {
    id: crypto.randomUUID(),
    name: file.name.replace(/\.[^.]+$/, ""),
    source: "buffer",
    buffer,
    synthType: null,
    steps: new Array(state.stepsPerPattern).fill(false),
    mixer: {
      volume: 0.8,
      reverb: 0.1,
      delayTime: 0,
      delayFeedback: 0,
      distortion: 0,
    },
  };
  state.tracks.push(track);
  renderUI();
}
