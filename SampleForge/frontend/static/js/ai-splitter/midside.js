export function midSideSplit(audioBuffer) {
  const n = audioBuffer.length;
  const sr = audioBuffer.sampleRate;
  const L =
    audioBuffer.numberOfChannels > 0 ? audioBuffer.getChannelData(0) : null;
  const R =
    audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : L;
  const ctx = new OfflineAudioContext(2, n, sr);
  const mid = ctx.createBuffer(1, n, sr);
  const side = ctx.createBuffer(1, n, sr);
  const m = mid.getChannelData(0);
  const s = side.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const l = L[i] || 0,
      r = R[i] || 0;
    m[i] = (l + r) * 0.5;
    s[i] = (l - r) * 0.5;
  }
  return { midBuffer: mid, sideBuffer: side };
}
