/* Preloader — a black screen, a hairline meter and a count.
   Holds the page still until the opening frames are decoded. */

const LABELS = [
  [0.0, 'Initialising system'],
  [0.35, 'Loading sequence'],
  [0.75, 'Calibrating'],
  [0.99, 'Ready'],
];

export class Preloader {
  constructor(root) {
    this.root = root;
    this.fill = root.querySelector('#preloader-fill');
    this.count = root.querySelector('#preloader-count');
    this.label = root.querySelector('#preloader-label');
    document.body.classList.add('is-locked');
  }

  set(ratio) {
    const pct = Math.round(ratio * 100);
    this.fill.style.transform = `scaleX(${ratio})`;
    this.count.textContent = String(Math.min(99, pct)).padStart(2, '0');

    const match = LABELS.filter(([at]) => ratio >= at).pop();
    if (match && this.label.textContent !== match[1]) this.label.textContent = match[1];
  }

  async done() {
    this.set(1);
    this.count.textContent = '100';
    // Just long enough for the count to read 100 — not a wait.
    await new Promise((r) => setTimeout(r, 120));
    this.root.classList.add('is-done');
    document.body.classList.remove('is-locked');
    setTimeout(() => this.root.remove(), 1300);
  }
}
