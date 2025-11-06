// track mixer (volume, delay, reverb, distortion)
export class Mixer {
  constructor(audioContext) {
    this.ctx = audioContext;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;
    this.masterGain.connect(this.ctx.destination);

    // Simple shared impulse for reverb (small room)
    this.sharedImpulse = this._makeImpulse(1.5, 0.5); // length(s), decay
  }

  createChannelNodes() {
    const gain = this.ctx.createGain();

    const delay = this.ctx.createDelay(2.0);
    delay.delayTime.value = 0.0;
    const delayGain = this.ctx.createGain();
    delayGain.gain.value = 0.0;

    const convolver = this.ctx.createConvolver();
    convolver.buffer = this.sharedImpulse;
    const reverbGain = this.ctx.createGain();
    reverbGain.gain.value = 0.0;

    const waveshaper = this.ctx.createWaveShaper();
    waveshaper.curve = this._makeDistCurve(0); // 0 drive
    const preDrive = this.ctx.createGain();
    preDrive.gain.value = 1.0;
    const postDrive = this.ctx.createGain();
    postDrive.gain.value = 1.0;

    // Dry/Wet routing: input -> (dry+fx) -> gain -> master (built w AI)
    const input = this.ctx.createGain();

    // Delay send/return
    input.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(input); // feedback tapped back in for repeats

    // Reverb send (parallel)
    const reverbSend = this.ctx.createGain();
    reverbSend.gain.value = 0.0;
    input.connect(reverbSend);
    reverbSend.connect(convolver);
    convolver.connect(input);

    // Distortion inline
    input.connect(preDrive);
    preDrive.connect(waveshaper);
    waveshaper.connect(postDrive);

    // Output
    postDrive.connect(gain);
    gain.connect(this.masterGain);

    return {
      input,
      gain,
      delay,
      delayGain,
      reverbSend,
      reverbGain,
      convolver,
      preDrive,
      waveshaper,
      postDrive,
    };
  }

  // Update node params from channel settings
  applyParams(nodes, params) {
    const {
      volume = 1,
      delayTime = 0,
      delayFeedback = 0,
      reverb = 0,
      distortion = 0,
    } = params || {};
    nodes.gain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.01);

    nodes.delay.delayTime.setTargetAtTime(
      delayTime,
      this.ctx.currentTime,
      0.01
    );
    nodes.delayGain.gain.setTargetAtTime(
      delayFeedback,
      this.ctx.currentTime,
      0.01
    );

    nodes.reverbSend.gain.setTargetAtTime(reverb, this.ctx.currentTime, 0.01);

    const drive = Math.max(0, Math.min(1, distortion));
    nodes.waveshaper.curve = this._makeDistCurve(drive * 40); // saturator drive
    nodes.preDrive.gain.setTargetAtTime(
      1 + drive * 2,
      this.ctx.currentTime,
      0.01
    );
    nodes.postDrive.gain.setTargetAtTime(1, this.ctx.currentTime, 0.01);
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
}
