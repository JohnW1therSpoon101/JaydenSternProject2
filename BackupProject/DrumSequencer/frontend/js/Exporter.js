// Exporter.js — Render the pattern offline and export as WAV
export async function exportPatternWav({ state }) {
  const { bpm, stepsPerBeat, stepsPerPattern, tracks } = state;
  const bars = stepsPerPattern / (stepsPerBeat * beatsPerBar(state.timeSig));
  const renderBars = Math.max(1, Math.ceil(bars));
  const ctxSampleRate = 44100;

  const secondsPerBeat = 60 / bpm;
  const stepDur = secondsPerBeat / stepsPerBeat;
  const durationSec =
    renderBars * beatsPerBar(state.timeSig) * secondsPerBeat + 1.0;

  const offline = new OfflineAudioContext(
    2,
    Math.ceil(durationSec * ctxSampleRate),
    ctxSampleRate
  );

  // Build per-track chains offline
  const chanNodes = tracks.map(() => makeChannelNodes(offline));

  // Schedule
  for (let step = 0; step < stepsPerPattern; step++) {
    const time = step * stepDur;
    for (let t = 0; t < tracks.length; t++) {
      if (!tracks[t].steps[step]) continue;
      scheduleHit(offline, chanNodes[t].input, time, tracks[t]);
    }
  }

  // Apply mixer params and connect to destination
  chanNodes.forEach((nodes, i) => {
    applyParams(offline, nodes, tracks[i].mixer || {});
    nodes.output.connect(offline.destination);
  });

  const rendered = await offline.startRendering();
  return encodeWav(rendered);
}

function beatsPerBar(timeSig) {
  const [num] = timeSig.split("/").map(Number);
  return num || 4;
}

function makeChannelNodes(ctx) {
  const input = ctx.createGain();
  const delay = ctx.createDelay(2.0);
  const delayGain = ctx.createGain();
  const reverbSend = ctx.createGain();
  const convolver = ctx.createConvolver();
  const waveshaper = ctx.createWaveShaper();
  const pre = ctx.createGain();
  const post = ctx.createGain();
  const lowpass = ctx.createBiquadFilter();
  const noiseGate = ctx.createDynamicsCompressor();
  const gain = ctx.createGain();

  convolver.buffer = makeImpulse(ctx, 1.5, 0.5);
  lowpass.type = "lowpass";
  lowpass.frequency.value = 22050;

  // Chain: input → delay → feedback → input
  input.connect(delay);
  delay.connect(delayGain);
  delayGain.connect(input);

  // Reverb (parallel)
  input.connect(reverbSend);
  reverbSend.connect(convolver);
  convolver.connect(input);

  // Distortion chain
  input.connect(pre);
  pre.connect(waveshaper);
  waveshaper.connect(post);

  // Final chain: → lowpass → noise gate → gain → destination
  post.connect(lowpass);
  lowpass.connect(noiseGate);
  noiseGate.connect(gain);

  return {
    input,
    delay,
    delayGain,
    reverbSend,
    convolver,
    pre,
    waveshaper,
    post,
    lowpass,
    noiseGate,
    gain,
    output: gain,
  };
}

function applyParams(ctx, n, p) {
  const {
    volume = 1,
    delayTime = 0,
    delayFeedback = 0,
    reverb = 0,
    distortion = 0,
    frequency = 22050,
    noiseGate = -100, // dB threshold
  } = p;

  n.gain.gain.value = volume;
  n.delay.delayTime.value = delayTime;
  n.delayGain.gain.value = delayFeedback;
  n.reverbSend.gain.value = reverb;

  n.waveshaper.curve = makeDistCurve(distortion * 40);
  n.pre.gain.value = 1 + Math.max(0, distortion) * 2;
  n.post.gain.value = 1;

  n.lowpass.frequency.value = Math.max(50, frequency);

  n.noiseGate.threshold.setValueAtTime(noiseGate, ctx.currentTime);
  n.noiseGate.knee.setValueAtTime(10, ctx.currentTime);
  n.noiseGate.ratio.setValueAtTime(15, ctx.currentTime);
  n.noiseGate.attack.setValueAtTime(0.01, ctx.currentTime);
  n.noiseGate.release.setValueAtTime(0.1, ctx.currentTime);
}

function scheduleHit(ctx, dest, time, track) {
  if (track.source === "buffer" && track.buffer) {
    const src = ctx.createBufferSource();
    src.buffer = track.buffer;
    src.connect(dest);
    src.start(time);
    return;
  }

  const vol = ctx.createGain();
  vol.connect(dest);
  vol.gain.setValueAtTime(1.0, time);

  if ((track.synthType || "hihat") === "kick") {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);
    g.gain.setValueAtTime(1, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    osc.connect(g).connect(vol);
    osc.start(time);
    osc.stop(time + 0.2);
  } else if (track.synthType === "snare") {
    const nbuf = whiteNoise(ctx);
    const n = ctx.createBufferSource();
    n.buffer = nbuf;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.5, time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    n.connect(ng).connect(vol);
    n.start(time);
    n.stop(time + 0.2);
  } else if (track.synthType === "clap") {
    const buf = whiteNoise(ctx);
    for (const dt of [0, 0.015, 0.03]) {
      const n = ctx.createBufferSource();
      n.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.6, time + dt);
      g.gain.exponentialRampToValueAtTime(0.001, time + dt + 0.08);
      n.connect(g).connect(vol);
      n.start(time + dt);
      n.stop(time + dt + 0.1);
    }
  } else {
    const buf = whiteNoise(ctx);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    src.connect(hp).connect(g).connect(vol);
    src.start(time);
    src.stop(time + 0.06);
  }
}

function whiteNoise(ctx) {
  const len = ctx.sampleRate * 1.0;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function makeImpulse(ctx, seconds = 1.5, decay = 0.5) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return buf;
}

function makeDistCurve(amount) {
  const k = amount | 0;
  const n = 44100;
  const curve = new Float32Array(n);
  const deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

// ========== WAV Encoder ==========
function encodeWav(audioBuffer) {
  const numCh = audioBuffer.numberOfChannels;
  const length = audioBuffer.length * numCh * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + audioBuffer.length * numCh * 2, true);
  writeString(view, 8, "WAVE");

  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * numCh * 2, true);
  view.setUint16(32, numCh * 2, true);
  view.setUint16(34, 16, true);

  writeString(view, 36, "data");
  view.setUint32(40, audioBuffer.length * numCh * 2, true);

  let offset = 44;
  const channels = [];
  for (let ch = 0; ch < numCh; ch++) {
    channels.push(audioBuffer.getChannelData(ch));
  }

  for (let i = 0; i < audioBuffer.length; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      let sample = Math.max(-1, Math.min(1, channels[ch][i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
