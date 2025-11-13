// track mixer (volume, delay, reverb, distortion, frequency, noise gate, master)
export class Mixer {
  constructor(audioContext) {
    this.ctx = audioContext;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;
    this.masterGain.connect(this.ctx.destination);

    this.sharedImpulse = this._makeImpulse(1.5, 0.5); // small room
    this.volumeAnalyzers = []; // store analyzers for visual feedback
  }

  createChannelNodes() {
    const input = this.ctx.createGain();
    const gain = this.ctx.createGain();
    const delay = this.ctx.createDelay(2.0);
    const delayGain = this.ctx.createGain();
    const reverbSend = this.ctx.createGain();
    const convolver = this.ctx.createConvolver();
    const preDrive = this.ctx.createGain();
    const waveshaper = this.ctx.createWaveShaper();
    const postDrive = this.ctx.createGain();
    const lowpass = this.ctx.createBiquadFilter();
    const compressor = this.ctx.createDynamicsCompressor();
    const analyzer = this.ctx.createAnalyser();

    // Setup effect defaults
    delay.delayTime.value = 0.0;
    delayGain.gain.value = 0.0;
    reverbSend.gain.value = 0.0;
    convolver.buffer = this.sharedImpulse;
    lowpass.type = "lowpass";
    lowpass.frequency.value = 22050;
    compressor.threshold.value = -100; // default threshold
    compressor.knee.value = 20;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    waveshaper.curve = this._makeDistCurve(0); // 0 drive
    preDrive.gain.value = 1.0;
    postDrive.gain.value = 1.0;

    // Build graph
    input.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(input); // feedback

    input.connect(reverbSend);
    reverbSend.connect(convolver);
    convolver.connect(input); // wet signal back into main

    input.connect(preDrive);
    preDrive.connect(waveshaper);
    waveshaper.connect(postDrive);

    postDrive.connect(lowpass);
    lowpass.connect(compressor);
    compressor.connect(gain);
    gain.connect(this.masterGain);

    // Analyzer tap
    const meterTap = this.ctx.createGain();
    gain.connect(meterTap);
    meterTap.connect(analyzer);
    analyzer.fftSize = 256;

    this.volumeAnalyzers.push(analyzer);

    return {
      input,
      gain,
      delay,
      delayGain,
      reverbSend,
      convolver,
      preDrive,
      waveshaper,
      postDrive,
      lowpass,
      compressor,
      analyzer,
    };
  }

  applyParams(nodes, params) {
    const {
      volume = 1,
      delayTime = 0,
      delayFeedback = 0,
      reverb = 0,
      distortion = 0,
      frequency = 22050,
      noiseGate = -100,
    } = params || {};

    const t = this.ctx.currentTime;

    nodes.gain.gain.setTargetAtTime(volume, t, 0.01);
    nodes.delay.delayTime.setTargetAtTime(delayTime, t, 0.01);
    nodes.delayGain.gain.setTargetAtTime(delayFeedback, t, 0.01);
    nodes.reverbSend.gain.setTargetAtTime(reverb, t, 0.01);

    const drive = Math.max(0, Math.min(1, distortion));
    nodes.waveshaper.curve = this._makeDistCurve(drive * 40);
    nodes.preDrive.gain.setTargetAtTime(1 + drive * 2, t, 0.01);
    nodes.postDrive.gain.setTargetAtTime(1, t, 0.01);

    nodes.lowpass.frequency.setTargetAtTime(frequency, t, 0.01);
    nodes.compressor.threshold.setTargetAtTime(noiseGate, t, 0.01);
  }

  _makeImpulse(seconds = 1.5, decay = 2.0) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const impulse = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const channelData = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return impulse;
  }

  _makeDistCurve(amount = 0) {
    const k = typeof amount === "number" ? amount : 0;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  getAnalyzers() {
    return this.volumeAnalyzers;
  }
}
