export const demucsWebGPU = {
  isAvailable: async () => false,
  async split(audioBuffer) {
    console.warn("WebGPU Demucs not implemented yet.");
    return { midBuffer: audioBuffer, sideBuffer: audioBuffer };
  },
};
