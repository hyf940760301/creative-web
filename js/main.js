import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { SITE, PROJECTS } from './config.js';
import * as S from './shaders.js';
import { Ambient } from './audio.js';

// ------------------------------------------------------------------ env
const Q = new URLSearchParams(location.search);
const CAPTURE = Q.get('capture') === '1';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches && !CAPTURE;
const TOUCH = matchMedia('(hover: none), (pointer: coarse)').matches && !CAPTURE;
const SMALL = Math.min(innerWidth, innerHeight) < 700 && !CAPTURE;
const LOW = TOUCH || SMALL;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = f => f * f * (3 - 2 * f);
const lerp = (a, b, t) => a + (b - a) * t;
// deterministic RNG (mulberry32) — same particles every load / every capture
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(20261106);
if (CAPTURE) document.documentElement.classList.add('capture');
document.documentElement.classList.add('pre');
if (!TOUCH && !CAPTURE) document.body.classList.add('has-cursor');

// ------------------------------------------------------------------ content
$$('.site-name').forEach(e => e.textContent = SITE.name); $('.ld-name').textContent = SITE.name; document.title = `${SITE.name} — ${SITE.tagline}`;
['.l1', '.l2', '.l3'].forEach((c, i) => $(c).textContent = SITE.heroLines[i] || '');
$('.lead').innerHTML = SITE.heroSub;
$('.stmt').innerHTML = SITE.about.statement; $('.stmt-zh').textContent = SITE.about.statementZh;
$('.svc').innerHTML = SITE.about.services.map(([a, b]) => `<li class="fade">${a}<span>${b}</span></li>`).join('');
$('.stats').innerHTML = SITE.about.stats.map(([a, b]) => `<div class="fade"><b>${a}</b><span>${b}</span></div>`).join('');
$('.mail').href = 'mailto:' + SITE.contact.email; $('.mail span').textContent = SITE.contact.email + ' ↗';
$('.soc').innerHTML = SITE.contact.socials.map(([n, u]) => `<a href="${u}" class="pe">${n}</a>`).join('');
$('.ctot').textContent = '/ ' + String(PROJECTS.length).padStart(2, '0');

// split text into words/chars, preserving inline elements (em etc.)
function split(el) {
  const walk = n => {
    [...n.childNodes].forEach(c => {
      if (c.nodeType === 3) {
        const frag = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach(w => {
          if (!w) return; if (/^\s+$/.test(w)) { frag.append(' '); return; }
          const ws = document.createElement('span'); ws.className = 'w';
          [...w].forEach(ch => { const s = document.createElement('span'); s.className = 'c'; s.textContent = ch; ws.append(s); });
          frag.append(ws);
        });
        c.replaceWith(frag);
      } else if (c.nodeType === 1) walk(c);
    });
  };
  walk(el); return $$('.c', el);
}
$$('.split').forEach(split);
function reveal(el, delay = 0, dur = 1.25) {
  const c = $$('.c', el); if (!c.length) return;
  if (CAPTURE || REDUCED) { gsap.set(c, { y: 0, yPercent: 0, rotate: 0, opacity: 1 }); return; }
  gsap.fromTo(c, { y: 0, yPercent: 105, rotate: 7 }, { y: 0, yPercent: 0, rotate: 0, duration: dur, stagger: .022, ease: 'expo.out', delay, overwrite: true });
}
const _c = $$('.split .c'); _c.length && gsap.set(_c, { y: 0, yPercent: 105, rotate: 7 });
document.documentElement.classList.remove('pre');
function fadeIn(els, delay = 0) { if (CAPTURE || REDUCED) return gsap.set(els, { opacity: 1, y: 0 }); gsap.to(els, { opacity: 1, y: 0, duration: 1.2, stagger: .08, ease: 'expo.out', delay }); }

// ------------------------------------------------------------------ renderer
const canvas = $('#webgl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: CAPTURE });
let DPR_MAX = CAPTURE ? 1 : (LOW ? 1.5 : 2), dpr = Math.min(devicePixelRatio || 1, DPR_MAX);
renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x050508, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x050508, 14, 46);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .1, 120);

const COL_A = new THREE.Color('#d4ff3a'), COL_B = new THREE.Color('#7a5cff');

// hero centerpiece
const blobU = { uT: { value: 0 }, uAmp: { value: .32 }, uFreq: { value: .95 }, uMorph: { value: 0 }, uPulse: { value: 0 }, uMouse: { value: new THREE.Vector3(9, 9, 9) }, uHue: { value: 0 }, uA: { value: COL_A }, uB: { value: COL_B } };
const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1, LOW ? 64 : 140), new THREE.ShaderMaterial({ uniforms: blobU, vertexShader: S.blobVert, fragmentShader: S.blobFrag }));
const hero = new THREE.Group(); hero.add(blob); scene.add(hero);
// orbit halo
{
  const n = LOW ? 1800 : 5000, a = new Float32Array(n), r = new Float32Array(n);
  for (let i = 0; i < n; i++) { a[i] = R() * Math.PI * 2; r[i] = Math.pow(R(), 1.6); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('aA', new THREE.BufferAttribute(a, 1)); g.setAttribute('aR', new THREE.BufferAttribute(r, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
  var haloU = { uT: blobU.uT, uPR: { value: dpr }, uA: { value: COL_A } };
  var halo = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: haloU, vertexShader: S.haloVert, fragmentShader: S.haloFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.rotation.set(.35, 0, -.25); hero.add(halo);
  var halo2 = halo.clone(); halo2.rotation.set(-.9, .4, .6); halo2.scale.setScalar(.82); hero.add(halo2);
}
// dust field
const dustU = { uT: blobU.uT, uPR: { value: dpr }, uSize: { value: .8 }, uMouse: { value: new THREE.Vector3(99, 99, 99) }, uA: { value: COL_A }, uB: { value: COL_B } };
{
  const n = LOW ? 7000 : 26000, p = new Float32Array(n * 3), r = new Float32Array(n);
  for (let i = 0; i < n; i++) { p[i * 3] = (R() - .5) * 46; p[i * 3 + 1] = (R() - .5) * 26; p[i * 3 + 2] = 16 - R() * 62; r[i] = R(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aR', new THREE.BufferAttribute(r, 1));
  scene.add(new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: dustU, vertexShader: S.dustVert, fragmentShader: S.dustFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
}

// ------------------------------------------------------------------ project gallery (ring)
function cover(p, i, w = 1600, h = 1000) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); const r = rng(1000 + i * 77);
  const [c0, c1, c2] = p.colors; x.fillStyle = c0; x.fillRect(0, 0, w, h);
  for (let k = 0; k < 7; k++) { const gx = r() * w, gy = r() * h, rad = (.25 + r() * .5) * w; const g = x.createRadialGradient(gx, gy, 0, gx, gy, rad); g.addColorStop(0, k % 2 ? c1 : c2); g.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = .55 + r() * .3; x.fillStyle = g; x.fillRect(0, 0, w, h); }
  x.globalAlpha = 1; x.globalCompositeOperation = 'overlay';
  for (let k = 0; k < 60; k++) { x.strokeStyle = `rgba(255,255,255,${.04 + r() * .12})`; x.lineWidth = 1 + r() * 2; x.beginPath(); const y0 = (k / 60) * h * 1.4 - h * .2; x.moveTo(-20, y0); x.bezierCurveTo(w * .3, y0 - 260 * Math.sin(i + k * .1), w * .65, y0 + 300 * Math.cos(i * 2 + k * .07), w + 20, y0 - 80); x.stroke(); }
  x.globalCompositeOperation = 'source-over';
  const img = x.getImageData(0, 0, w, h), d = img.data; for (let k = 0; k < d.length; k += 4) { const n = (r() - .5) * 22; d[k] += n; d[k + 1] += n; d[k + 2] += n; } x.putImageData(img, 0, 0);
  x.fillStyle = 'rgba(255,255,255,.92)'; x.font = '500 34px Helvetica, Arial, sans-serif'; x.fillText(String(i + 1).padStart(2, '0') + ' — ' + p.year, 70, 100);
  x.textAlign = 'right'; x.font = '500 26px Helvetica, Arial, sans-serif'; x.fillText('EXAMPLE PROJECT', w - 70, 100); x.textAlign = 'left';
  x.font = '600 150px Helvetica, Arial, sans-serif'; x.fillText(p.title, 64, h - 110);
  x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '400 30px Helvetica, Arial, sans-serif'; x.fillText(p.role.toUpperCase() + '  ·  ' + p.zh, 70, h - 50);
  return c;
}
const N = PROJECTS.length, RING_R = 8.2, STEP = THREE.MathUtils.degToRad(37), RING_Z = -28;
const ring = new THREE.Group(); ring.position.set(0, 0, RING_Z); scene.add(ring);
const cards = [], covers = [];
const KINDS = { fluid: 0, type: 1, topo: 2, halftone: 3, glass: 4 };
const CW = 4.6, CH = 2.875, cardGeo = new THREE.PlaneGeometry(CW, CH, 40, 24);
function uiLayers(p, i) {
  const W = 1600, H = 1000, mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d')]; };
  const [mc, m] = mk(), [fc, f] = mk(); const F = 'Helvetica Neue, Helvetica, Arial, PingFang SC, sans-serif';
  // mid: frame lines, labels, chips, stats
  m.strokeStyle = 'rgba(255,255,255,.35)'; m.lineWidth = 2; m.strokeRect(46, 46, W - 92, H - 92);
  m.strokeStyle = 'rgba(255,255,255,.18)'; m.beginPath(); m.moveTo(46, 150); m.lineTo(W - 46, 150); m.moveTo(W * .62, 46); m.lineTo(W * .62, 150); m.stroke();
  [[46, 46], [W - 46, 46], [46, H - 46], [W - 46, H - 46]].forEach(([x, y]) => { m.fillStyle = '#d4ff3a'; m.fillRect(x - 6, y - 6, 12, 12); });
  m.fillStyle = 'rgba(255,255,255,.9)'; m.font = `500 30px ${F}`; m.fillText(String(i + 1).padStart(2, '0') + ' / ' + String(N).padStart(2, '0'), 84, 112);
  m.fillStyle = 'rgba(255,255,255,.55)'; m.font = `400 24px ${F}`; m.fillText('EXAMPLE PROJECT · 示例', 260, 112); m.fillText(p.year, W * .62 + 36, 112);
  let x = W - 84; m.font = `500 22px ${F}`; [...p.tags].reverse().forEach(t => { const w = m.measureText(t).width + 40; x -= w; m.strokeStyle = 'rgba(255,255,255,.45)'; m.beginPath(); m.roundRect(x, 82, w, 44, 22); m.stroke(); m.fillStyle = 'rgba(255,255,255,.85)'; m.fillText(t, x + 20, 112); x -= 12; });
  (p.stats || [['FPS', '60'], ['DRAW', '1.2k'], ['LIVE', '●']]).forEach(([k, v], j) => { const yy = 240 + j * 70; m.fillStyle = 'rgba(255,255,255,.45)'; m.font = `400 20px ${F}`; m.fillText(k, W - 300, yy); m.fillStyle = 'rgba(255,255,255,.9)'; m.font = `500 32px ${F}`; m.fillText(v, W - 180, yy); });
  m.fillStyle = 'rgba(255,255,255,.4)'; m.font = `400 20px ${F}`; m.fillText('LIVE PREVIEW', W * .68, H * .89 - 12);
  // fg: crisp title
  f.shadowColor = 'rgba(0,0,0,.45)'; f.shadowBlur = 30; f.fillStyle = '#fff'; f.font = `600 132px ${F}`; f.fillText(p.title, 80, H - 168);
  f.shadowBlur = 0; f.fillStyle = 'rgba(255,255,255,.75)'; f.font = `400 30px ${F}`; f.fillText(p.zh + '  ·  ' + p.role, 84, H - 110);
  const tex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; return t; };
  return [tex(mc), tex(fc)];
}
PROJECTS.forEach((p, i) => {
  const cv = cover(p, i); covers.push(cv.toDataURL('image/jpeg', .86));
  const [mid, fg] = uiLayers(p, i);
  const kind = KINDS[p.visual] ?? (i % 5);
  const u = { uMid: { value: mid }, uFg: { value: fg }, uT: blobU.uT, uHover: { value: 0 }, uVel: { value: 0 }, uActive: { value: 0 }, uReveal: { value: 0 }, uUV: { value: new THREE.Vector2(.5, .5) }, uPar: { value: new THREE.Vector2() },
    uKind: { value: kind }, uAspect: { value: CW / CH }, uC0: { value: new THREE.Color(p.colors[0]) }, uC1: { value: new THREE.Color(p.colors[1]) }, uC2: { value: new THREE.Color(p.colors[2]) } };
  const m = new THREE.Mesh(cardGeo, new THREE.ShaderMaterial({ uniforms: u, vertexShader: S.cardVert, fragmentShader: S.cardFrag, transparent: true }));
  m.userData = { i, tx: 0, ty: 0, vx: 0, vy: 0 }; ring.add(m); cards.push(m);
});
function layoutRing(rot) {
  cards.forEach((m, i) => { const th = i * STEP - rot; m.position.set(Math.sin(th) * RING_R, Math.sin(th * 1.3 + 1) * .25, -Math.cos(th) * RING_R); m.lookAt(ring.position.x, m.position.y * .4, ring.position.z); m.rotateY(m.userData.tx); m.rotateX(m.userData.ty); m.userData.th = th; });
}

// ------------------------------------------------------------------ post
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .42, .45, .82); composer.addPass(bloom);
const fin = new ShaderPass(S.finalShader); composer.addPass(fin);
composer.addPass(new OutputPass());
const fxaa = new ShaderPass(FXAAShader); composer.addPass(fxaa);
const setFxaa = () => fxaa.material.uniforms.resolution.value.set(1 / (innerWidth * renderer.getPixelRatio()), 1 / (innerHeight * renderer.getPixelRatio())); setFxaa();
if (REDUCED) fin.uniforms.uGrain.value = .01;

// ------------------------------------------------------------------ choreography
const V = (x, y, z) => new THREE.Vector3(x, y, z);
let KEYS = [], workTop = 0, workEnd = 0, maxS = 1, aboutTop = 0;
function layout() {
  const top = e => e.getBoundingClientRect().top + scrollY;
  $('.work').style.height = (N * 70 + 100) + 'vh';
  workTop = top($('.work')); workEnd = workTop + $('.work').offsetHeight - innerHeight; aboutTop = top($('.about'));
  maxS = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const asp = innerWidth / innerHeight, port = asp < 1, xs = port ? 0 : clamp(asp / 1.6, .6, 1.1), dz = port ? 5 : 0, ly = port ? 1.1 : 0;
  // [scroll, cam, look, blobPos, blobScale, morph, hue, via]
  KEYS = [
    [0, V(0, 0, 8.6 + dz), V(0, 0, 0), V(1.95 * xs, .15 + ly * 1.5, 0), port ? .9 : 1.32, 0, 0],
    [workTop * .55, V(-5.2, 1.3, -3), V(0, 0, -20), V(2.4 * xs, 0, -1), 1.1, .2, .1, 1],
    [workTop, V(0, 0, RING_Z), V(0, 0, RING_Z - 8), V(2.4, 0, -1), 1.1, .3, .2],
    [workEnd, V(0, 0, RING_Z), V(0, 0, RING_Z - 8), V(2.4, 0, -1), 1.1, .3, .2],
    [lerp(workEnd, aboutTop + innerHeight * .3, .45), V(6.2, 1.6, -4), V(0, 0, 0), V(-1.6, 0, 0), 1.15, .7, .35, 1],
    [aboutTop + innerHeight * .3, V(.6, 0, 9 + dz), V(.6, 0, 0), V(-2.3 * xs, ly, 0), port ? .95 : 1.2, 1, .5],
    [maxS, V(0, -.25, 7.8 + dz), V(0, .15, 0), V(0, .35 + ly * .5, 0), port ? .8 : 1.0, .45, .78],
  ];
  if (port) cards.forEach(c => c.scale.setScalar(.62)); else cards.forEach(c => c.scale.setScalar(1));
}
const pose = { cam: V(), look: V(), blob: V(), scale: 1, morph: 0, hue: 0 };
function poseAt(s) {
  let k = 0; while (k < KEYS.length - 2 && s > KEYS[k + 1][0]) k++;
  const A = KEYS[k], B = KEYS[k + 1]; let f = clamp((s - A[0]) / Math.max(1, B[0] - A[0]));
  // ease: smooth at real stops, linear-through at via points
  const e = A[7] && B[7] ? f : A[7] ? 1 - (1 - f) * (1 - f) : B[7] ? f * f : smooth(f);
  const eb = smooth(f);
  pose.cam.lerpVectors(A[1], B[1], e); pose.look.lerpVectors(A[2], B[2], e); pose.blob.lerpVectors(A[3], B[3], eb);
  pose.scale = lerp(A[4], B[4], eb); pose.morph = lerp(A[5], B[5], eb); pose.hue = lerp(A[6], B[6], eb);
}
function galleryRot(s) {
  const g = clamp((s - workTop) / Math.max(1, workEnd - workTop)) * (N - 1); const i = Math.floor(g), f = g - i;
  return (i + smooth(clamp((f - .15) / .7))) * STEP; // dwell on each card
}

// ------------------------------------------------------------------ input
const ptr = { x: 0, y: 0, nx: 0, ny: 0, sx: 0, sy: 0, active: false };
function setPtr(x, y) { ptr.x = x; ptr.y = y; ptr.nx = x / innerWidth * 2 - 1; ptr.ny = -(y / innerHeight) * 2 + 1; ptr.active = true; }
addEventListener('pointermove', e => setPtr(e.clientX, e.clientY), { passive: true });
addEventListener('touchmove', e => { const t = e.touches[0]; setPtr(t.clientX, t.clientY); }, { passive: true });
// cursor
const cur = $('.cur'), dot = $('.dot', cur), rng_ = $('.ring', cur), lbl = $('.lbl', cur); const cpos = { x: innerWidth / 2, y: innerHeight / 2 };
if (CAPTURE) cur.style.display = 'none';
$$('a, button, .mag').forEach(el => { el.addEventListener('pointerenter', () => { cur.classList.add('hov'); sfx('hover'); }); el.addEventListener('pointerleave', () => cur.classList.remove('hov')); });
// magnetic
if (!TOUCH && !REDUCED) $$('.mag').forEach(b => {
  const inner = b.querySelector('span');
  b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(), dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2; gsap.to(b, { x: dx * .32, y: dy * .38, duration: .5, ease: 'power3.out' }); inner && gsap.to(inner, { x: dx * .14, y: dy * .14, duration: .5, ease: 'power3.out' }); });
  b.addEventListener('pointerleave', () => { gsap.to(b, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1,.35)' }); inner && gsap.to(inner, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1,.35)' }); });
});

// ------------------------------------------------------------------ scroll
let lenis = null, scrollY_ = 0, vel = 0, svel = 0;
if (!CAPTURE) {
  lenis = new Lenis({ lerp: REDUCED ? 1 : .085, smoothWheel: !REDUCED, wheelMultiplier: .9, touchMultiplier: 1.4 });
  lenis.on('scroll', e => { scrollY_ = e.scroll; vel = e.velocity; });
}
function scrollTo(y, dur = 2.2) { if (lenis) lenis.scrollTo(y, { duration: REDUCED ? 0 : dur, easing: t => 1 - Math.pow(1 - t, 4) }); else scrollTo_(y); }
function scrollTo_(y) { window.scrollTo(0, y); scrollY_ = y; }
$$('.nav a, .logo').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const h = a.getAttribute('href'); const el = $(h); scrollTo(h === '#top' ? 0 : h === '#about' ? aboutTop + innerHeight * .3 : h === '#contact' ? maxS : el.getBoundingClientRect().top + scrollY); }));
// reveal on view
const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; const t = e.target; io.unobserve(t); if (t.classList.contains('split')) reveal(t); else fadeIn([t]); }), { threshold: .2 });
$$('.about .split, .contact .split, .about .fade, .stmt-zh').forEach(e => io.observe(e));
if (!CAPTURE) gsap.set($$('.about .fade, .stmt-zh, .svc li, .stats div'), { opacity: 0, y: 24 });

// ------------------------------------------------------------------ work UI
let active = -1;
function setActive(i, instant) {
  if (i === active) return; active = i; const p = PROJECTS[i];
  $('.cnum').textContent = String(i + 1).padStart(2, '0');
  $('.pj-year').textContent = p.year; $('.pj-role').textContent = p.role; $('.pj-tags').textContent = p.tags.join(' / ');
  const el = $('.pj-name'); el.textContent = p.title; split(el); if (instant || CAPTURE) gsap.set($$('.c', el), { y: 0, yPercent: 0, rotate: 0 }); else reveal(el, 0, 1);
  sfx('tick');
}
$('.work .open').addEventListener('click', () => openDetail(active));

// ------------------------------------------------------------------ detail overlay
const det = $('#detail'); let detOpen = false, detIdx = 0, detTl = null, capVel = 0;
function openDetail(i) {
  detIdx = i; const p = PROJECTS[i]; detOpen = true; lenis && lenis.stop(); sfx('open');
  $('.d-idx', det).textContent = String(i + 1).padStart(2, '0') + ' / ' + String(N).padStart(2, '0');
  $('.cover', det).style.backgroundImage = `url(${p.image || covers[i]})`;
  const h = $('h3', det); h.textContent = p.title; split(h);
  $('.zh', det).textContent = p.zh + ' · ' + p.tags.join(' / ');
  $('p.d', det).textContent = p.desc;
  $('dl', det).innerHTML = `<dt>YEAR 年份</dt><dd>${p.year}</dd><dt>ROLE 角色</dt><dd>${p.role}</dd><dt>CLIENT 客户</dt><dd>Example Client（示例）</dd>`;
  det.classList.add('is-open'); det.setAttribute('aria-hidden', 'false');
  const tl = gsap.timeline({ defaults: { ease: 'expo.inOut' } });
  tl.fromTo($('.bg', det), { clipPath: `circle(0% at ${ptr.x || innerWidth / 2}px ${ptr.y || innerHeight / 2}px)` }, { clipPath: `circle(150% at ${ptr.x || innerWidth / 2}px ${ptr.y || innerHeight / 2}px)`, duration: REDUCED ? .01 : 1.2 })
    .fromTo($('.cover', det), { clipPath: 'inset(100% 0 0 0)', scale: 1.15 }, { clipPath: 'inset(0% 0 0 0)', scale: 1, duration: 1.3 }, .25)
    .add(() => reveal(h, 0, 1.2), .5)
    .fromTo($$('.d-fade', det), { opacity: 0, y: 24 }, { opacity: 1, y: 0, stagger: .07, duration: 1, ease: 'expo.out' }, .6);
  if (CAPTURE) { tl.pause(); tl.progress(1); detTl = tl; reveal(h); } else gsap.to(fx, { flash: .18, duration: .15, yoyo: true, repeat: 1 });
}
function closeDetail() {
  if (!detOpen) return; detOpen = false;
  gsap.timeline({ onComplete: () => { det.classList.remove('is-open'); det.setAttribute('aria-hidden', 'true'); lenis && lenis.start(); } })
    .to($$('.d-fade', det), { opacity: 0, y: -16, duration: .4, stagger: .03 })
    .to($('.cover', det), { clipPath: 'inset(0 0 100% 0)', duration: .7, ease: 'expo.in' }, 0)
    .to($('.bg', det), { clipPath: `circle(0% at 50% 50%)`, duration: .9, ease: 'expo.inOut' }, .2);
}
$('.x', det).addEventListener('click', closeDetail);
$('.nx', det).addEventListener('click', () => { const n = (detIdx + 1) % N; closeDetail(); setTimeout(() => { scrollTo_(workTop + n / (N - 1) * (workEnd - workTop)); lenis && lenis.scrollTo(workTop + n / (N - 1) * (workEnd - workTop), { immediate: true }); openDetail(n); }, 1000); });
addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });

// ------------------------------------------------------------------ sound
const amb = new Ambient(); const snd = $('.snd');
function sfx(k) { amb.on && amb.blip(k); }
snd.addEventListener('click', () => { const on = amb.toggle(); snd.classList.toggle('on', on); snd.setAttribute('aria-pressed', on); $('.snd-t').textContent = on ? '声音 ON' : '声音 OFF'; });

// clock
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: SITE.contact.timezone, hour: '2-digit', minute: '2-digit' });
const tick = () => $('.clock').textContent = SITE.contact.city.toUpperCase() + ' ' + fmt.format(new Date()); tick(); if (!CAPTURE) setInterval(tick, 10000);

// ------------------------------------------------------------------ frame
const fx = { intro: CAPTURE ? 1 : 0, flash: 0 };
const ray = new THREE.Raycaster(), plane = new THREE.Plane(), hit = new THREE.Vector3(), tmp = new THREE.Vector3(), lookS = V();
let time = 0, hoverIdx = -1, lastSec = [];
function update(dt) {
  const k = 1 - Math.exp(-dt * 5.5), kf = 1 - Math.exp(-dt * 9);
  blobU.uT.value = time;
  ptr.sx += (ptr.nx - ptr.sx) * k; ptr.sy += (ptr.ny - ptr.sy) * k;
  svel += (clamp(vel / 60, -1, 1) - svel) * kf;
  const s = scrollY_;
  poseAt(s);
  // camera with intro dolly + pointer parallax
  const it = fx.intro, ie = 1 - Math.pow(1 - it, 3);
  camera.position.copy(pose.cam); camera.position.z += (1 - ie) * 9; camera.position.y += (1 - ie) * -1.2;
  const par = REDUCED ? 0 : 1; camera.position.x += ptr.sx * .45 * par; camera.position.y += ptr.sy * .3 * par;
  lookS.copy(pose.look); camera.lookAt(lookS); camera.rotateZ(-ptr.sx * .015 * par + (1 - ie) * .08);
  // hero form
  hero.position.copy(pose.blob); hero.position.y += Math.sin(time * .6) * .08;
  const sc = pose.scale * (it >= 1 ? 1 : (.001 + .999 * gsap.parseEase('elastic.out(1,.6)')(it)));
  hero.scale.setScalar(sc);
  blob.rotation.y = time * .07 + ptr.sx * .3; blob.rotation.x = Math.sin(time * .11) * .3 + ptr.sy * .2;
  halo.rotation.y = time * .05; halo2.rotation.z = .6 + time * .03;
  blobU.uMorph.value = pose.morph; blobU.uHue.value = pose.hue + time * .004; blobU.uAmp.value = lerp(.26, .2, pose.morph) + Math.abs(svel) * .08 + (1 - it) * .35;
  // pointer → world
  ray.setFromCamera(new THREE.Vector2(ptr.sx, ptr.sy), camera);
  camera.getWorldDirection(tmp); plane.setFromNormalAndCoplanarPoint(tmp, hero.position);
  if (ptr.active && ray.ray.intersectPlane(plane, hit)) { blobU.uMouse.value.copy(blob.worldToLocal(hit.clone())); dustU.uMouse.value.copy(hit); }
  // gallery
  const rot = galleryRot(s); layoutRing(rot);
  ring.visible = s > workTop * .25 && s < lerp(workEnd, aboutTop + innerHeight * .3, .55);
  const gIn = clamp((s - workTop * .45) / (workTop * .55 + 1));
  const hits = (s > workTop * .7 && s < workEnd + innerHeight * .4 && !detOpen) ? ray.intersectObjects(cards) : [];
  const hIdx = hits.length ? hits[0].object.userData.i : -1;
  if (hIdx !== hoverIdx) { hoverIdx = hIdx; cur.classList.toggle('view', hIdx >= 0); if (hIdx >= 0) sfx('hover'); }
  cards.forEach((m, i) => {
    const u = m.material.uniforms; const isH = hIdx === i;
    u.uHover.value += ((isH ? 1 : 0) - u.uHover.value) * k; if (isH) u.uUV.value.lerp(hits[0].uv, kf);
    const D = m.userData, gx = isH ? (u.uUV.value.x - .5) : 0, gy = isH ? (u.uUV.value.y - .5) : 0;
    D.vx += ((gx * .32 - D.tx) * 120 - D.vx * 14) * dt; D.vy += ((-gy * .28 - D.ty) * 120 - D.vy * 14) * dt; D.tx += D.vx * dt; D.ty += D.vy * dt;
    u.uPar.value.set(lerp(Math.sin(time * .3 + i) * .08, gx, u.uHover.value), lerp(Math.cos(time * .25 + i) * .06, gy, u.uHover.value));
    u.uActive.value = clamp(1 - Math.abs(m.userData.th) / STEP); u.uVel.value = svel;
    u.uReveal.value = clamp(gIn * 1.6 - i * .12);
    m.visible = u.uReveal.value > 0;
  });
  const gp = clamp((s - workTop) / Math.max(1, workEnd - workTop));
  if (s > workTop - innerHeight * .5) setActive(Math.round(rot / STEP));
  $('.pbar i').style.width = (gp * 100) + '%';
  // nav state
  const sec = s < workTop - innerHeight * .5 ? 0 : s < workEnd + innerHeight * .3 ? 1 : s < maxS - innerHeight * .6 ? 2 : 3;
  if (sec !== lastSec) { lastSec = sec; $$('.nav a').forEach(a => a.classList.toggle('on', +a.dataset.s === sec)); }
  // post
  fin.uniforms.uT.value = time; fin.uniforms.uCA.value = .0011 + Math.abs(svel) * .012 + (1 - it) * .02;
  fin.uniforms.uFlash.value = fx.flash; bloom.strength = .42 + (1 - it) * .8 + fx.flash * 1.5;
  // cursor
  if (!TOUCH && !CAPTURE) { cpos.x += (ptr.x - cpos.x) * kf * 1.4; cpos.y += (ptr.y - cpos.y) * kf * 1.4; dot.style.transform = `translate(${ptr.x}px,${ptr.y}px)`; rng_.style.transform = ''; rng_.style.translate = `${cpos.x}px ${cpos.y}px`; lbl.style.translate = `${cpos.x}px ${cpos.y}px`; }
  if (amb.on) amb.drive(clamp(s / maxS), Math.abs(svel));
}
function render() { composer.render(); }

// adaptive resolution
let slow = 0;
function adapt(dt) { if (CAPTURE) return; if (dt > 1 / 40) slow += dt; else slow = Math.max(0, slow - dt * .5); if (slow > 2 && dpr > 1) { dpr = Math.max(1, dpr - .25); renderer.setPixelRatio(dpr); composer.setPixelRatio(dpr); setFxaa(); slow = 0; } }

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 1 / 20); last = now; time += dt;
  lenis && lenis.raf(now); update(dt); render(); adapt(dt); requestAnimationFrame(loop);
}
function resize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); bloom.resolution.set(innerWidth, innerHeight);
  haloU.uPR.value = dustU.uPR.value = renderer.getPixelRatio(); setFxaa(); layout();
}
addEventListener('resize', resize);
layout();

// ------------------------------------------------------------------ intro
function intro() {
  const num = $('.ld-num'), o = { v: 0 };
  renderer.compile(scene, camera);
  const tl = gsap.timeline();
  tl.to(o, { v: 100, duration: REDUCED ? .3 : 2.4, ease: 'power3.inOut', onUpdate: () => { num.textContent = Math.round(o.v); gsap.set('.ld-line', { scaleX: o.v / 100 }); } })
    .to('.ld', { opacity: 0, duration: .4 })
    .to('.ld-line', { scaleY: 40, opacity: 0, duration: .6, ease: 'expo.in' }, '-=.2')
    .add(() => { gsap.to(fx, { flash: .35, duration: .08, yoyo: true, repeat: 1 }); })
    .to('#loader .pane.t', { yPercent: -100, duration: 1.3, ease: 'expo.inOut' }, '-=.1')
    .to('#loader .pane.b', { yPercent: 100, duration: 1.3, ease: 'expo.inOut' }, '<')
    .to(fx, { intro: 1, duration: REDUCED ? .1 : 3.2, ease: 'power2.out' }, '<')
    .add(() => { reveal($('.hero h1'), 0, 1.6); fadeIn($$('.hero .fade'), .5); gsap.to('.hdr', { opacity: 1, duration: 1.2, delay: .4 }); }, '<.35')
    .add(() => { $('#loader').remove(); lenis && lenis.start(); });
  lenis && lenis.stop();
}

if (CAPTURE) {
  // ---------------------------------------------------------- deterministic capture API
  $('#loader').remove(); gsap.set('.hdr', { opacity: 1 }); $$('.split').forEach(e => reveal(e)); gsap.set($$('.fade, .stmt-zh, .svc li, .stats div'), { opacity: 1, y: 0 });
  gsap.ticker.sleep && gsap.ticker.sleep();
  window.__capture = true; window.__dbg = { dustU, fin, bloom, haloU, composer };
  window.__setScroll = p => { scrollTo_(clamp(p) * maxS); return scrollY_; };
  window.__setPointer = (x, y) => setPtr(x, y);
  window.__setIntro = v => { fx.intro = clamp(v); };
  window.__setTime = t => { // advance with fixed 1/60 steps (max 600) then render one frame
    let steps = Math.max(1, Math.min(600, Math.round((t - time) * 60)));
    if (t < time) { time = t; steps = 1; }
    for (let i = 0; i < steps; i++) { time = Math.min(t, time + 1 / 60); vel = capVel; update(1 / 60); }
    time = t; render(); return time;
  };
  window.__setActive = i => setActive(i, true);
  window.__openDetail = i => openDetail(i);
  window.__setVelocity = v => { capVel = v; };
  window.__galleryP = i => (workTop + i / (N - 1) * (workEnd - workTop)) / maxS;
  window.__aboutP = () => (aboutTop + innerHeight * .3) / maxS;
  window.__workEndP = () => workEnd / maxS;
  window.__detail = (i, p) => { if (!detOpen) openDetail(i); detTl.progress(clamp(p)); };
  window.__closeDetail = () => { detOpen = false; det.classList.remove('is-open'); gsap.set($$('.d-fade', det), { opacity: 0 }); };
  window.__setTime(0); window.__ready = true;
} else {
  requestAnimationFrame(t => { last = t; requestAnimationFrame(loop); intro(); window.__ready = true; });
}
