Perfect — here’s your complete, beginner-friendly README.md file written in Markdown format.
It explains everything about your AudioMash project: what it does, how it works, and how to run it step-by-step.

You can copy this into:
📄 AudioMash/README.md

⸻

# 🎵 AudioMash

**Create your own song mashups right in your browser!**

---

## 🧠 Overview

**AudioMash** is a simple, browser-based mashup creator that lets you mix different **stems** (drums, bass, vocals, and others) into one combined audio track — all without needing a backend server.

This project is built for **beginners**, using only **HTML**, **CSS**, and **JavaScript** (with the Web Audio API).  
You can:

- Select stems from your computer
- Adjust each stem’s volume
- Mash them together into one track
- Play and download the resulting mix
- (Optionally) store stems locally in your browser using IndexedDB

No installation, databases, or backend setup required!

---

## 🧩 Features

| Feature                   | Description                                                      |
| ------------------------- | ---------------------------------------------------------------- |
| 🎛️ **Mix stems**          | Combine 4 stems (drums, bass, vocals, other) into one WAV output |
| 🔊 **Volume sliders**     | Adjust per-stem volume before mixing                             |
| ⏳ **Progress indicator** | See the mashup progress (decode → render → encode)               |
| 💾 **Local library**      | Save and load tracks in browser storage (IndexedDB)              |
| ⬇️ **Download mix**       | Export your mashup as a `.wav` file                              |
| 🖤 **Dark UI**            | Black-themed layout for creative focus                           |
| 🌐 **No backend needed**  | Runs entirely in your web browser!                               |

---

## 🗂️ Project Structure

AudioMash/
│
├── AudioLibrary/ # (optional for now)
│
├── frontend/
│ ├── Mash.html # Main mashup interface
│ ├── AudioLibraryBuild.html # Page to add new stems to browser library
│ ├── css/
│ │ └── style.css # Black theme + layout
│ └── js/
│ ├── Mash.js # Handles UI logic + mash rendering
│ ├── audioUtils.js # Handles audio decoding/rendering/export
│ ├── api.js # Manages browser-based IndexedDB library
│ └── AudioLibraryBuild.js # Handles adding new tracks to the local library
│
├── backend/ # Placeholder for future backend (not needed yet)
│
└── BuildTools/
└── scripts/
├── run-local.sh # Launches local server for testing
└── clean-library.sh # (optional) utility for cleanup

---

## 🧰 Requirements

### Software

| Tool                                 | Purpose                                          | Notes                                |
| ------------------------------------ | ------------------------------------------------ | ------------------------------------ |
| **Web Browser**                      | Run and test the app                             | Chrome, Firefox, or Edge recommended |
| **Python 3**                         | Used by `run-local.sh` to serve the site locally | Most systems already have it         |
| _(Optional)_ **Git Bash / Terminal** | Run the script easily                            | Use PowerShell or terminal           |
| _(Optional)_ **VS Code**             | Code editing & Live Server extension             | Helpful but not required             |

### Skills

- Basic understanding of HTML and JavaScript
- Ability to run a command in terminal (like `bash BuildTools/scripts/run-local.sh`)

---

## 🚀 How to Run AudioMash (Frontend Only)

Follow these steps to open and use your project locally:

### 1. Open a terminal in the `AudioMash/` folder

Example:

```bash
cd path/to/JaydenSternProject2/BackupProject/AudioMash

2. Run the local server

bash BuildTools/scripts/run-local.sh

You’ll see:

Serving frontend/ on http://localhost:5500

3. Open your browser and visit:

👉 http://localhost:5500/Mash.html

⸻

🕹️ How to Use AudioMash

🎚️ Mix Stems
	1.	Click Pick Drums, Pick Bass, Pick Vocals, and Pick Other.
→ Choose 4 audio files (.wav, .mp3, etc.) from your computer.
	2.	Adjust the volume sliders (0–100%) for each stem.
	3.	Click 🔊 Mash.
	4.	Watch the progress bar as AudioMash:
	•	Decodes audio →  🧩
	•	Renders mix →  🎚️
	•	Encodes to WAV →  💾
	5.	Play your mashup in the built-in audio player.
	6.	Click ⬇ Download Mix (WAV) to save it to your computer.

⸻

💾 Save to Your Local Library

You can store stems in your browser so they’re easy to reuse later.
	1.	Go to http://localhost:5500/AudioLibraryBuild.html
	2.	Fill in:
	•	Track ID (unique name, no spaces)
	•	Title & Genre
	•	Upload your 5 stems (full, drums, bass, vocals, other)
	3.	Click Add to Library
→ Stored in IndexedDB, your browser’s local database.

Then, on Mash.html, click:

“Load Tracks from Library”

and select any saved track.

⸻

🔊 How It Works (Under the Hood)
	1.	File input
	•	You select stems from your local files using <input type="file">.
	2.	Web Audio API
	•	The files are read into memory and decoded as AudioBuffers.
	3.	OfflineAudioContext
	•	A special Web Audio context that mixes multiple audio sources offscreen (faster than real time).
	4.	Gain Nodes
	•	Each stem passes through a GainNode that applies your volume slider value (0–1).
	5.	Rendering
	•	All stems start at the same time → combined into one stereo mix.
	6.	Export
	•	The final mix is turned into a .wav file using JavaScript and offered as a download.
	7.	Local Library (IndexedDB)
	•	Stems you add in AudioLibraryBuild.html are stored in your browser’s IndexedDB for reuse — no internet or server needed.

⸻

🧱 Technologies Used

Tech	Purpose
HTML5	User interface and layout
CSS3	Dark theme styling
JavaScript (ES6 modules)	Logic and audio handling
Web Audio API	Mixing, rendering, and exporting sound
IndexedDB	Local browser storage for stems
Python HTTP Server	Simple local testing server
(optional) Bash Script	Automates local server startup


⸻

⚙️ Troubleshooting

Issue	Cause	Fix
“Nothing happens when I click Mash”	One or more stems not selected	Ensure all 4 stems are loaded
“Can’t load JS files”	You opened the file directly (file://)	Use the run-local.sh server instead
“No sound”	Volumes set to 0% or audio files silent	Adjust sliders or test with known audio
“Error: decodeAudioData failed”	Unsupported audio format	Use .wav or .mp3 files
“Progress stuck”	Very large files (>100MB)	Try smaller stems first


⸻

🧰 Future Upgrades (optional)
	•	Add a real backend (Node.js or Java) for managing an AudioLibrary/ folder
	•	Add waveform visualizations for each stem
	•	Add BPM/key matching for cross-song mashups
	•	Allow MP3 export (currently WAV only)
	•	Host on GitHub Pages or a personal web server

⸻

📜 License

This project is open-source and free to use for learning or personal projects.

⸻

👨‍💻 Author

Created by: Jayden Stern
Project: AudioMash
Focus: Learn the basics of HTML, JavaScript, and Web Audio through a fun, hands-on project.

⸻

✅ Quick Recap

Step	Action
1️⃣	Open a terminal and run bash BuildTools/scripts/run-local.sh
2️⃣	Open http://localhost:5500/Mash.html
3️⃣	Pick 4 stems (drums, bass, vocals, other)
4️⃣	Adjust volumes and mash them
5️⃣	Play and download your mix!


⸻

Enjoy creating mashups, experimenting with sounds, and learning how web audio works. 🎶
AudioMash is your first step into building real browser-based music tools — no backend required.

---

Would you like me to include a **smaller “Quick Start” section at the top** (a 5-line summary for your GitHub page)?
It’s great for people who just want the “what / how / run” at a glance.
```
