// Builds + manages interactive step grid
export class DrumGrid {
  constructor({ container, getState, onToggleStep, onChangeRowName }) {
    this.container = container;
    this.getState = getState;
    this.onToggleStep = onToggleStep;
    this.onChangeRowName = onChangeRowName;
    this.playheadIndex = -1;
  }

  render() {
    const { tracks, stepsPerPattern } = this.getState();
    this.container.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.className = "grid";

    tracks.forEach((track, tIdx) => {
      const row = document.createElement("div");
      row.className = "grid-row";
      row.style.gridTemplateColumns = `160px repeat(${stepsPerPattern}, 28px)`;

      // Label
      const label = document.createElement("div");
      label.className = "label";
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = track.name;
      const meta = document.createElement("span");
      meta.className = "mini";
      meta.textContent = track.source === "buffer" ? "sample" : "synth";
      label.appendChild(name);
      label.appendChild(meta);
      label.title = "Click to rename";
      label.style.cursor = "text";
      label.addEventListener("click", () => {
        const newName = prompt("Rename track:", track.name);
        if (newName && newName.trim())
          this.onChangeRowName(tIdx, newName.trim());
      });
      row.appendChild(label);

      // Steps
      for (let s = 0; s < stepsPerPattern; s++) {
        const btn = document.createElement("button");
        btn.className = "step";
        btn.setAttribute("aria-label", `${track.name} step ${s + 1}`);
        btn.dataset.t = String(tIdx);
        btn.dataset.s = String(s);
        if (track.steps[s]) btn.classList.add("active");
        btn.addEventListener("click", () => this.onToggleStep(tIdx, s));
        row.appendChild(btn);
      }
      wrapper.appendChild(row);
    });

    this.container.appendChild(wrapper);
  }

  updatePlayhead(stepIndex) {
    if (!this.container.firstChild) return;
    const { tracks, stepsPerPattern } = this.getState();
    const grid = this.container.querySelector(".grid");
    if (!grid) return;

    // Clear old
    const old = grid.querySelectorAll(".step.playhead");
    old.forEach((el) => el.classList.remove("playhead"));

    if (stepIndex < 0) return;

    for (let r = 0; r < tracks.length; r++) {
      const row = grid.children[r];
      const cell = row.children[1 + (stepIndex % stepsPerPattern)];
      if (cell) cell.classList.add("playhead");
    }
  }

  refreshActiveStates() {
    const { tracks, stepsPerPattern } = this.getState();
    const grid = this.container.querySelector(".grid");
    if (!grid) return;

    tracks.forEach((track, r) => {
      for (let s = 0; s < stepsPerPattern; s++) {
        const cell = grid.children[r].children[1 + s];
        if (!cell) continue;
        cell.classList.toggle("active", !!track.steps[s]);
      }
    });
  }
}
