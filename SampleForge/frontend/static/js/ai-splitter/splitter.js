import { midSideSplit } from "./midside.js";

export async function splitInBrowser(audioBuffer) {
  // placeholder: mid/side now, can later hook WebGPU Demucs
  return midSideSplit(audioBuffer);
}
