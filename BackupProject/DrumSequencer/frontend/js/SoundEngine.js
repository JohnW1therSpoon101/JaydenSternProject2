import { Mixer } from "./Mixer.js";

export class SoundEngine {
  constructor(getState, onStep) {
    this.getState = getState;
    this.onStep = onStep;
    this.ctx = null;
    this.mixer = null;

    this.tracksNodes = [];
    this.isPlaying = false;

    this.lookahead = 0.1;
    this.scheduleInterval = null;
    this.nextNoteTime = 0;
    this.currentStep = 0;
  }

  async ensureContext() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.mixer = new Mixer(this.ctx);
  }

  async attachTracks(tracks) {
    await this.ensureContext();
    this.tracksNodes.forEach((n) => n.input.disconnect());
    this.tracksNodes = tracks.map(() => {
      const nodes = this.mixer.createChannelNodes();

      // Create analyser for volume meter
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 256;
      nodes.gain.connect(analyser);
      nodes.analyser = analyser;

      return nodes;
    });
  }

  updateMixerParams(tracks) {
    tracks.forEach((t, i) => {
      const nodes = this.tracksNodes[i];
      if (nodes) this.mixer.applyParams(nodes, t.mixer);
    });
  }

  stepDurationSec() {
    const { bpm, stepsPerBeat } = this.getState();
    const beatDur = 60 / bpm;
    return beatDur / stepsPerBeat;
  }

  async start() {
    const { tracks } = this.getState();
    await this.attachTracks(tracks);
    this.updateMixerParams(tracks);

    if (this.ctx.state === "suspended") await this.ctx.resume();

    this.isPlaying = true;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.currentStep = 0;
    this._scheduleLoop();
  }

  stop() {
    this.isPlaying = false;
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
      this.scheduleInterval = null;
    }
    this.onStep(-1);
  }

  _scheduleLoop() {
    const schedule = () => {
      const { stepsPerPattern, tracks } = this.getState();
      const stepDur = this.stepDurationSec();

      while (this.nextNoteTime < this.ctx.currentTime + this.lookahead) {
        const stepIdx = this.currentStep % stepsPerPattern;

        tracks.forEach((t, i) => {
          if (t.steps[stepIdx]) this._triggerTrack(i, this.nextNoteTime, t);
        });

        setTimeout(
          () => this.onStep(stepIdx),
          Math.max(0, (this.nextNoteTime - this.ctx.currentTime) * 1000)
        );

        this.nextNoteTime += stepDur;
        this.currentStep++;
      }
    };

    schedule();
    this.scheduleInterval = setInterval(schedule, this.lookahead * 500);
  }

  async _triggerTrack(trackIndex, time, track) {
    const nodes = this.tracksNodes[trackIndex];

    // Frequency filter (if needed)
    if (!nodes.freqFilter) {
      const freqFilter = this.ctx.createBiquadFilter();
      freqFilter.type = "lowpass";
      freqFilter.frequency.value = track.mixer.frequency ?? 22050;
      nodes.gain.disconnect();
      nodes.gain.connect(freqFilter).connect(this.mixer.masterGain);
      nodes.freqFilter = freqFilter;
    } else {
      nodes.freqFilter.frequency.setTargetAtTime(
        track.mixer.frequency ?? 22050,
        time,
        0.01
      );
    }

    // Noise gate (simple threshold cutoff)
    const noiseGate = this.ctx.createGain();
    const thresholdDb = track.mixer.noiseGate ?? -100;
    noiseGate.gain.value = 1.0; // simplified version for now
    noiseGate.connect(nodes.input);

    if (track.source === "buffer" && track.buffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = track.buffer;
      src.connect(noiseGate);
      src.start(time);
    } else {
      this._playSynth(
        track.synthType || "hihat",
        time,
        noiseGate,
        track.synthParams || {}
      );
    }
  }

  _playSynth(type, time, dest, params = {}) {
    const ctx = this.ctx;
    const vol = ctx.createGain();
    vol.gain.setValueAtTime(params.vol ?? 1.0, time);
    vol.connect(dest);

    if (type === "kick") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);
      gain.gain.setValueAtTime(1, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
      osc.connect(gain).connect(vol);
      osc.start(time);
      osc.stop(time + 0.2);
    } else if (type === "snare") {
      const noiseBuf = this._whiteNoiseBuffer();
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.5, time);
      ng.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
      noise.connect(ng).connect(vol);
      noise.start(time);
      noise.stop(time + 0.2);

      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(200, time);
      og.gain.setValueAtTime(0.3, time);
      og.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
      osc.connect(og).connect(vol);
      osc.start(time);
      osc.stop(time + 0.2);
    } else if (type === "clap") {
      const buf = this._whiteNoiseBuffer();
      const makeTap = (dt) => {
        const n = ctx.createBufferSource();
        n.buffer = buf;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.6, time + dt);
        g.gain.exponentialRampToValueAtTime(0.001, time + dt + 0.08);
        n.connect(g).connect(vol);
        n.start(time + dt);
        n.stop(time + dt + 0.1);
      };
      makeTap(0);
      makeTap(0.015);
      makeTap(0.03);
    } else {
      const buf = this._whiteNoiseBuffer();
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

  _whiteNoiseBuffer() {
    const len = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  async decodeFile(file) {
    await this.ensureContext();
    const arrayBuf = await file.arrayBuffer();
    return await this.ctx.decodeAudioData(arrayBuf);
  }
}
