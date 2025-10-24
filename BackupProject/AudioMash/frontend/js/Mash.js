// frontend/js/Mash.js
import {
  decodeToBuffer,
  renderMix,
  audioBufferToWavBlob,
} from "./audioUtils.js";
import { initDB, listTracks, getTrack } from "./api.js";

const state = {
  drums: null,
  bass: null,
  vocals: null,
  other: null,
  audioCtx: null,
  renderedBlobUrl: null,
  volumes: {
    drums: 1,
    bass: 1,
    vocals: 1,
    other: 1,
  },
};

const els = {
  pickDrums: document.getElementById("PickdrumssButton"),
  pickBass: document.getElementById("PickBassButton"),
  pickVocals: document.getElementById("PickVocalsButton"),
  pickOther: document.getElementById("PickOthersButton"),
  drumsInput: document.getElementById("drumsInput"),
  bassInput: document.getElementById("bassInput"),
  vocalsInput: document.getElementById("vocalsInput"),
  otherInput: document.getElementById("otherInput"),
  drumsVol: document.getElementById("drumsVol"),
  bassVol: document.getElementById("bassVol"),
  vocalsVol: document.getElementById("vocalsVol"),
  otherVol: document.getElementById("otherVol"),
  drumsBadge: document.getElementById("drumsBadge"),
  bassBadge: document.getElementById("bassBadge"),
  vocalsBadge: document.getElementById("vocalsBadge"),
  otherBadge: document.getElementById("otherBadge"),
  mashBtn: document.getElementById("Mashbutton"),
  renderStatus: document.getElementById("renderStatus"),
  progressFill: document.getElementById("progressFill"),
  player: document.getElementById("player"),
  downloadLink: document.getElementById("downloadLink"),
  loadLibraryBtn: document.getElementById("loadLibraryBtn"),
  libraryList: document.getElementById("libraryList"),
};

// Update UI helper
function updateUI() {
  const ready = state.drums && state.bass && state.vocals && state.other;
  els.mashBtn.disabled = !ready;
  els.renderStatus.textContent = ready ? "ready to mash" : "waiting for stems…";
  els.drumsBadge.textContent = state.drums
    ? state.drums.name
    : "no drums selected";
  els.bassBadge.textContent = state.bass ? state.bass.name : "no bass selected";
  els.vocalsBadge.textContent = state.vocals
    ? state.vocals.name
    : "no vocals selected";
  els.otherBadge.textContent = state.other
    ? state.other.name
    : "no other selected";
}

// Handle volume sliders
function wireSliders() {
  els.drumsVol.addEventListener(
    "input",
    () => (state.volumes.drums = els.drumsVol.value / 100)
  );
  els.bassVol.addEventListener(
    "input",
    () => (state.volumes.bass = els.bassVol.value / 100)
  );
  els.vocalsVol.addEventListener(
    "input",
    () => (state.volumes.vocals = els.vocalsVol.value / 100)
  );
  els.otherVol.addEventListener(
    "input",
    () => (state.volumes.other = els.otherVol.value / 100)
  );
}

// Wire up file pickers
function wirePickers() {
  els.pickDrums.addEventListener("click", () => els.drumsInput.click());
  els.pickBass.addEventListener("click", () => els.bassInput.click());
  els.pickVocals.addEventListener("click", () => els.vocalsInput.click());
  els.pickOther.addEventListener("click", () => els.otherInput.click());

  els.drumsInput.addEventListener("change", () => {
    state.drums = els.drumsInput.files[0] || null;
    updateUI();
  });
  els.bassInput.addEventListener("change", () => {
    state.bass = els.bassInput.files[0] || null;
    updateUI();
  });
  els.vocalsInput.addEventListener("change", () => {
    state.vocals = els.vocalsInput.files[0] || null;
    updateUI();
  });
  els.otherInput.addEventListener("change", () => {
    state.other = els.otherInput.files[0] || null;
    updateUI();
  });
}

// Update progress bar visually
function setProgress(percent) {
  els.progressFill.style.width = `${percent}%`;
}

// Mash process with progress indicator
async function mash() {
  try {
    els.mashBtn.disabled = true;
    setProgress(5);
    els.renderStatus.textContent = "decoding…";

    if (!state.audioCtx)
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const [drumsBuf, bassBuf, vocalsBuf, otherBuf] = await Promise.all([
      decodeToBuffer(state.audioCtx, state.drums),
      decodeToBuffer(state.audioCtx, state.bass),
      decodeToBuffer(state.audioCtx, state.vocals),
      decodeToBuffer(state.audioCtx, state.other),
    ]);

    setProgress(40);
    els.renderStatus.textContent = "rendering (offline)…";

    // Include volumes when rendering
    const buffers = [
      { buffer: drumsBuf, gain: state.volumes.drums },
      { buffer: bassBuf, gain: state.volumes.bass },
      { buffer: vocalsBuf, gain: state.volumes.vocals },
      { buffer: otherBuf, gain: state.volumes.other },
    ];

    // We'll modify the renderMix call to accept gain per stem
    const mixedBuffer = await renderMixWithGains(buffers, 44100);

    setProgress(80);
    els.renderStatus.textContent = "encoding wav…";
    const wavBlob = audioBufferToWavBlob(mixedBuffer);

    if (state.renderedBlobUrl) URL.revokeObjectURL(state.renderedBlobUrl);
    state.renderedBlobUrl = URL.createObjectURL(wavBlob);

    els.player.src = state.renderedBlobUrl;
    els.downloadLink.href = state.renderedBlobUrl;
    els.downloadLink.style.display = "inline-block";
    els.renderStatus.textContent = "done ✅";
    setProgress(100);
  } catch (err) {
    console.error(err);
    els.renderStatus.textContent = "error: " + err.message;
    setProgress(0);
  } finally {
    updateUI();
  }
}

// Modified renderer to include per-stem gains
async function renderMixWithGains(stems, sampleRate = 44100) {
  const buffers = stems.map((s) => s.buffer);
  const numChannels = 2;
  const duration = Math.max(...buffers.map((b) => b.duration));
  const length = Math.ceil(duration * sampleRate);
  const offline = new OfflineAudioContext(numChannels, length, sampleRate);

  stems.forEach(({ buffer, gain }) => {
    const src = offline.createBufferSource();
    src.buffer = buffer;
    const g = offline.createGain();
    g.gain.value = gain;
    src.connect(g).connect(offline.destination);
    src.start(0);
  });

  return await offline.startRendering();
}

// Load tracks from local library
async function loadLibrary() {
  try {
    await initDB();
    const tracks = await listTracks();
    if (!tracks.length) {
      els.libraryList.innerHTML = `<div class="badge">No tracks saved in library yet.</div>`;
      return;
    }
    els.libraryList.innerHTML = "";
    tracks.forEach((t) => {
      const btn = document.createElement("button");
      btn.textContent = `Load ${t.title || t.trackId}`;
      btn.addEventListener("click", async () => {
        const rec = await getTrack(t.trackId);
        state.drums = rec.drums || null;
        state.bass = rec.bass || null;
        state.vocals = rec.vocals || null;
        state.other = rec.other || null;
        updateUI();
      });
      els.libraryList.appendChild(btn);
    });
  } catch (e) {
    console.error(e);
    els.libraryList.innerHTML = `<div class="badge">Failed to load library</div>`;
  }
}

function main() {
  wirePickers();
  wireSliders();
  updateUI();
  els.mashBtn.addEventListener("click", mash);
  els.loadLibraryBtn.addEventListener("click", loadLibrary);
}
document.addEventListener("DOMContentLoaded", main);
