// frontend/js/audioUtils.js

// Decode a File/Blob to AudioBuffer
export async function decodeToBuffer(audioCtx, fileOrBlob) {
  const arrayBuf = await fileOrBlob.arrayBuffer();
  return await audioCtx.decodeAudioData(arrayBuf);
}

// Render multiple AudioBuffers mixed together with OfflineAudioContext
// Each stem gets gain = 1 / N to prevent clipping.
export async function renderMix(buffers, sampleRate = 44100) {
  if (!buffers.length) throw new Error("No buffers to render.");
  const numChannels = 2; // stereo
  const duration = Math.max(...buffers.map((b) => b.duration));
  const length = Math.ceil(duration * sampleRate);

  const offline = new OfflineAudioContext(numChannels, length, sampleRate);
  const gainPerStem = 1 / buffers.length;

  buffers.forEach((buf) => {
    // Upmix mono to stereo if needed by connecting directly (WebAudio handles channel matching)
    const src = offline.createBufferSource();
    src.buffer = buf;

    const gain = offline.createGain();
    gain.gain.value = gainPerStem;

    src.connect(gain).connect(offline.destination);
    src.start(0);
  });

  const rendered = await offline.startRendering();
  return rendered;
}

// Convert an AudioBuffer to a WAV Blob (16-bit PCM)
export function audioBufferToWavBlob(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numChannels * 2 + 44; // 16-bit
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + buffer.length * numChannels * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, buffer.length * numChannels * 2, true);

  // Interleave and write PCM samples
  const channels = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channels[ch][i];
      // clamp
      sample = Math.max(-1, Math.min(1, sample));
      // convert to 16-bit
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true
      );
      offset += 2;
    }
  }

  return new Blob([view], { type: "audio/wav" });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
