export function appendLog(logElem, text) {
  const div = document.createElement("div");
  div.className = "line";
  div.textContent = text;
  logElem.appendChild(div);
  logElem.scrollTop = logElem.scrollHeight;
}

export function setProgress(barElem, percent) {
  barElem.style.width = Math.max(0, Math.min(100, percent | 0)) + "%";
}
