🥁 DrumSequencer — ProjectAnalysis.md

A structured, builder-friendly analysis doc for planning, building, and shipping the browser-based drum sequencer.

⸻

1. Project Summary

Name: DrumSequencer
Goal: Interactive FL Studio–style drum sequencer in the browser with export/download.
Stack: HTML + CSS + JavaScript (Web Audio API). No backend.
Core: Step grid, per-track mixer (volume, reverb, delay, distortion), time signature options, upload custom samples, export to WAV.

⸻

2. Users, Use-Cases, & Success Criteria

Personas
• Beginner Beatmaker — Wants to click boxes, press play, tweak a few sliders, and export.
• Intermediate Producer — Wants to import their own samples and dial-in basic effects.
• Teacher/Student — Needs simple setup (no installs) and reliable playback/export for demos.

Primary Use-Cases 1. Build a pattern with default sounds (Kick, Snare, Clap, HiHat, OpenHat, Crash). 2. Change time signature & resolution (steps per beat). 3. Add custom drum sounds (upload audio files). 4. Tweak per-track mixer (volume, reverb, delay, distortion). 5. Export the loop to a downloadable .wav.

Success Criteria
• Pattern plays in-time at user-selected BPM.
• Grid resizes dynamically with time signature/resolution changes.
• Custom audio uploads replace or add tracks without errors.
• Export produces a valid, loop-length .wav (audible + effects applied).
• Runs on current Chrome/Firefox/Edge without extensions.

⸻

3. Scope

In-Scope (MVP)
• 6 default tracks (Kick, Snare, Clap, HiHat, OpenHat, Crash).
• FL-like step grid with toggling per step.
• BPM input, time signature (3/4, 4/4, 6/8), and steps per beat (2, 3, 4).
• Per-track mixer: volume, reverb, delay (time+feedback), distortion.
• Upload custom samples (per track or as new track).
• WAV export via OfflineAudioContext.
• Basic dark UI, responsive layout.

Out-of-Scope (Future)
• Swing/shuffle, per-step velocity, panning, per-track EQ/compressor.
• Pattern management, saving/loading (IndexedDB).
• Multi-pattern/song arrangement view.
• MP3 export (needs encoder lib).

⸻

4. Functional Requirements
   • Grid
   • Display 1 row per track.
   • Columns = steps = timeSigTop \* stepsPerBeat.
   • Step toggle on click; shows active state; live playhead highlight.
   • Playback
   • Start/Stop controls.
   • Accurate scheduling using Web Audio API timing (no drift).
   • Mixer
   • Per-track sliders: Volume [0..1], Reverb [0..1], Delay time [0..1 s], Delay feedback [0..0.95], Distortion [0..1].
   • Effects affect both live playback and export.
   • Samples
   • Preload default assets (fallback to synth if missing).
   • Upload files (.wav, .mp3, etc. browser-supported) and attach to a track.
   • Export
   • Render full loop with effects via OfflineAudioContext.
   • Produce .wav Blob; trigger browser download.

⸻

5. Non-Functional Requirements
   • Performance: Low CPU during playback; schedule within 100ms lookahead.
   • Compatibility: Chrome/Firefox/Edge latest; mobile okay (desktop prioritized).
   • Resilience: Synth fallback if default samples missing.
   • Accessibility: Keyboard-focusable controls; ARIA labels for grid steps; semantic headings.
   • Security: No network upload of user audio; all processing local.

⸻

6. System Architecture

Client-only, modular JS.
Modules:
• DrumGrid — UI for step grid (render + toggle + playhead).
• SoundEngine — AudioContext, scheduling, sample triggers, synth fallback.
• Mixer — Per-track effect chains, parameter updates.
• Exporter — Offline render + WAV encoding.
• main — Global state, event wiring, orchestration.

[UI Events] --> main.js --> DrumGrid (render/toggle/playhead)
--> SoundEngine (schedule/play)
--> Mixer (per-track chains)
--> Exporter (offline render + WAV)

⸻

7. Data Model (State)

state = {
bpm: 120,
timeSig: "4/4", // "3/4" | "4/4" | "6/8"
stepsPerBeat: 4, // 2 | 3 | 4
stepsPerPattern: 16, // computed = timeSigTop \* stepsPerBeat
tracks: [
{
id: "uuid",
name: "Kick",
source: "buffer" | "synth",
buffer: AudioBuffer | null,
synthType: "kick" | "snare" | "clap" | "hihat" | null,
steps: [bool, ...], // length = stepsPerPattern
mixer: {
volume: 0.8,
reverb: 0.1,
delayTime: 0.0,
delayFeedback: 0.0,
distortion: 0.0
}
},
// ...
]
}

Derived:
stepsPerPattern = (parseInt(timeSigTop) \* stepsPerBeat).

⸻

8. Timing & Scheduling Design

Live Playback
• Create a Web Audio AudioContext.
• Maintain currentStep, nextNoteTime, and lookahead (~100ms).
• In an interval tick, schedule all note triggers up to currentTime + lookahead.
• Each scheduled event uses absolute times (no setTimeout audio scheduling).

Step Duration

secondsPerBeat = 60 / bpm
stepDuration = secondsPerBeat / stepsPerBeat

Export
• Use OfflineAudioContext with fixed sample rate (e.g., 44100 Hz).
• Rebuild track chains; schedule all hit times deterministically.
• Render & PCM16 encode to WAV.

⸻

9. Effects Architecture (Per Track)

Order (inline + sends):
• Distortion (WaveShaper) inline with pre/post gain
• Delay loop: input → delay → delayGain → input (feedback)
• Reverb: input → send → Convolver → input (small-room impulse)
• Final track Gain → Master

Parameters
• Volume → final Gain
• Delay → delayTime + feedback gain
• Reverb → send gain
• Distortion → drive amount mapping to waveshaper curve

⸻

10. UX & Interaction Notes
    • Toolbar: Play/Stop, Tempo, Time Signature, Steps/Beat, Clear, Add Sound (upload), Export.
    • Grid:
    • Left side label shows name + source badge (“sample” or synth type).
    • Cells toggle active state; every 4th cell slightly alternates background for grouping.
    • Playhead highlight moves across steps during playback.
    • Mixer: One card per track; file input to replace sample; sliders for all fx.

A11y
• Give each step an ARIA label (e.g., “Kick step 3”).
• Ensure buttons are reachable via Tab; visible focus; appropriate roles.

⸻

11. File/Folder Structure

DrumSequencer/
├── frontend/
│ ├── index.html
│ ├── css/
│ │ └── style.css
│ └── js/
│ ├── main.js
│ ├── DrumGrid.js
│ ├── SoundEngine.js
│ ├── Mixer.js
│ └── Exporter.js
├── assets/ # optional; user can add samples here
│ ├── Kick.wav
│ ├── Snare.wav
│ ├── Clap.wav
│ ├── HiHat.wav
│ ├── OpenHat.wav
│ └── Crash.wav
└── BuildTools/
└── scripts/
└── run-local.sh

⸻

12. Testing Strategy

Manual QA (Happy Paths)
• Play default pattern at 120 BPM, 4/4, 16 steps — verify audible & in-time.
• Change to 3/4 (12 steps) and 6/8 (12 steps with triplet feel if stepsPerBeat=3).
• Upload a custom sample for Snare — verify replacement & sound.
• Adjust each mixer control — verify audible changes.
• Export .wav — verify length, content, and effect presence.

Edge Cases
• Export with empty pattern → silent WAV (no crash).
• Extreme BPM (40, 240) → timing stability.
• Delay feedback near 0.95 → no runaway; verify tail in export.
• Missing default samples → synth fallback works.
• Rapidly toggling steps during playback → no crash, minor clicks acceptable.

Automation Candidates (later)
• Unit-test WAV encoder with short buffer fixtures.
• Deterministic schedule vs. expected trigger times for a fixed seed.

⸻

13. Risks & Mitigations

Risk Impact Mitigation
Browser auto-play policy suspends AudioContext No sound on first Play Start/resume context from a direct user gesture (button click)
Timing drift at high CPU Off-beat playback Use lookahead scheduling with absolute times
Export mismatch with live Confusion Share effect graph logic (mirror nodes/params)
Heavy reverb/delay CPU Choppy audio Keep impulse short; cap feedback; provide sane defaults
Large uploads Slow decode Indicate busy state; recommend .wav or short samples

⸻

14. Implementation Plan (Milestones)

M1 — Core Grid & Playback (Day 1–2)
• Render grid, toggle steps, BPM control.
• SoundEngine with stable scheduler and synth fallback.

M2 — Mixer (Day 2–3)
• Per-track volume, delay, reverb, distortion nodes.
• Live parameter updates.

M3 — Samples & Uploads (Day 3–4)
• Attempt to load default assets (with graceful fallback).
• Per-track file input to replace/add sounds.

M4 — Export (Day 4)
• Offline render; WAV encode; download link.

M5 — Polish & QA (Day 5)
• A11y tags, responsive tweaks, error messages, starter pattern.

⸻

15. Acceptance Criteria (MVP Done Definition)
    • Grid updates to match 3/4, 4/4, 6/8 and steps-per-beat (2/3/4).
    • Play/Stop stable at 40–240 BPM; playhead visuals in sync.
    • Default tracks playable with synth fallback if assets missing.
    • Uploading a sample replaces/creates a track and plays correctly.
    • Mixer sliders audibly affect live playback.
    • Exported WAV contains the full loop (with effects) and downloads.
    • Works in latest Chrome and Firefox on desktop.

⸻

16. Coding Standards
    • Modules: ES6 modules, one top-level class or cohesive functions per file.
    • Naming: camelCase for vars/functions, PascalCase for classes, UPPER_SNAKE for constants.
    • State Updates: Immutable-ish (copy arrays when resizing), render after updates.
    • Error Handling: Try/catch around decodes, fetch; show alert() fallback + console error.
    • Comments: Explain non-obvious timing logic & audio graph wiring.

⸻

17. Future Enhancements
    • Panning per track (StereoPannerNode).
    • Velocity per step (per-step gain).
    • Swing/Shuffle (alter time positions for off-beats).
    • Pattern Save/Load (IndexedDB).
    • Visualization (per-row waveform or spectrum).
    • MP3 Export (with client-side encoder, e.g., libshine/wasm — extra size).
    • Mobile gestures (long-press to paint steps).

⸻

18. Quick Developer Notes
    • When grid size changes (time signature or resolution), resize and preserve existing steps where possible.
    • For export length, render at least one full bar of the current meter (plus tail ~1s for FX).
    • Distortion curve: simple arctan-like waveshaper; keep drive conservative for musicality.
    • Reverb: small-room synthetic impulse; consider allowing impulse upload later.

⸻

This analysis document should live at:

📄 DrumSequencer/ProjectAnalysis.md

It pairs with the codebase you already have, ensuring everyone aligned on scope, architecture, and acceptance before iteration.
