// Procedural ambient score — WebAudio only, no audio files. Off by default.
export class Ambient {
  constructor() { this.on = false; this.ctx = null; }
  init() {
    const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const m = this.master = c.createGain(); m.gain.value = 0;
    const comp = c.createDynamicsCompressor(); m.connect(comp); comp.connect(c.destination);
    const lp = this.lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 2; lp.connect(m);
    // slow chord drone: A1, E2, A2, C#3(ish) — detuned pairs
    [55, 82.41, 110, 138.6, 164.8].forEach((f, i) => [-6, 6].forEach(d => {
      const o = c.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'triangle'; o.frequency.value = f; o.detune.value = d + i;
      const g = c.createGain(); g.gain.value = i < 2 ? .05 : .07; o.connect(g); g.connect(lp); o.start();
    }));
    const lfo = c.createOscillator(); lfo.frequency.value = .05; const lg = c.createGain(); lg.gain.value = 260; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    // airy noise bed
    const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const n = c.createBufferSource(); n.buffer = b; n.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = .6;
    const ng = this.air = c.createGain(); ng.gain.value = .012; n.connect(bp); bp.connect(ng); ng.connect(m); n.start();
    // shimmer
    const s = c.createOscillator(); s.frequency.value = 880; s.type = 'sine'; const sg = c.createGain(); sg.gain.value = 0; const tl = c.createOscillator(); tl.frequency.value = .13; const tg = c.createGain(); tg.gain.value = .008;
    tl.connect(tg); tg.connect(sg.gain); s.connect(sg); sg.connect(m); s.start(); tl.start();
  }
  toggle() {
    if (!this.ctx) this.init();
    this.on = !this.on; const t = this.ctx.currentTime;
    if (this.on) this.ctx.resume();
    this.master.gain.cancelScheduledValues(t); this.master.gain.setTargetAtTime(this.on ? .5 : 0, t, this.on ? .8 : .25);
    return this.on;
  }
  drive(p, v) { const t = this.ctx.currentTime; this.lp.frequency.setTargetAtTime(380 + p * 900 + v * 1200, t, .3); this.air.gain.setTargetAtTime(.01 + v * .05, t, .2); }
  blip(kind) {
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    const f = { hover: 1320, tick: 660, open: 220 }[kind] || 880; o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (kind === 'open' ? 4 : 1.5), t + .25);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(kind === 'hover' ? .03 : .06, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + (kind === 'open' ? .8 : .3));
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 1);
  }
}
Ambient.prototype.whoosh = function (dur = 1.4, rev = false) {
  const c = this.ctx, t = c.currentTime, n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(rev ? 4200 : 260, t); f.frequency.exponentialRampToValueAtTime(rev ? 260 : 4200, t + dur * .85);
  const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.16, t + dur * .6); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + .05);
};
