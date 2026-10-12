/* Sokoview hero totem — a 3D street signal with its signs, in the hero's amber panel.
   - Lamps: LED dots showing how many DSE stocks fell (red), held (amber) and rose (green).
     They flash together, play in turn, then rest on the day's lamp.
   - LED sign: a ticker of the day's biggest movers.
   - Plaque: the close date.
   Data arrives from app.js through the 'sv:signal' event (or window.svSignal if it came first). */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const LAMPS = [
  { key: 'down', color: '#ff3b2f', hot: '#ffd2cc', dim: '#3a0b08', y: 1.34, glyph: 'down' },
  { key: 'flat', color: '#ffb81f', hot: '#fff0c2', dim: '#3a2806', y: 0, glyph: 'flat' },
  { key: 'up', color: '#22d463', hot: '#d3ffe2', dim: '#07301a', y: -1.34, glyph: 'up' }
];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = document.getElementById('signal');
const hero = canvas.closest('.hero');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
catch (err) { hero.classList.add('no-3d'); throw err; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.03).texture;

/* A long lens from the front-left, level with the middle of the object, like a product shot. */
const camera = new THREE.PerspectiveCamera(21, 1, 5, 80);
const LOOK = new THREE.Vector3(-0.8, -2.45, 0);

/* A warm key from the upper left; the amber panel bounces back into the undersides. */
const key = new THREE.DirectionalLight(0xfff4e2, 2.3);
key.position.set(-9, 12, 14);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.radius = 7;
key.shadow.bias = -0.0005;
Object.assign(key.shadow.camera, { left: -8, right: 8, top: 9, bottom: -11, near: 1, far: 60 });
scene.add(key, new THREE.HemisphereLight(0xffffff, 0xfed76a, 0.75));

const totem = new THREE.Group();
scene.add(totem);

/* ---------- Materials ---------- */
const paint = new THREE.MeshPhysicalMaterial({ color: 0xf3f2ee, roughness: 0.38, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25 });
const chrome = new THREE.MeshStandardMaterial({ color: 0xeef0ef, roughness: 0.3, metalness: 0.55 });
const gloss = new THREE.MeshPhysicalMaterial({ color: 0x0c0d0c, roughness: 0.22, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 });
const amber = new THREE.MeshPhysicalMaterial({ color: 0xf6c94c, roughness: 0.32, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.2 });
const greenRim = new THREE.MeshPhysicalMaterial({ color: 0x0a3d1f, roughness: 0.35, clearcoat: 0.7 });
const white = new THREE.MeshPhysicalMaterial({ color: 0xfbfaf6, roughness: 0.4, clearcoat: 0.5 });
const ink = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.5 });

function add(parent, geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function label(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/* ---------- Main pole, with its sleeve and hazard band ---------- */
add(totem, new THREE.CylinderGeometry(0.2, 0.2, 14, 48), paint, 0, 0.5, 0);
add(totem, new THREE.CylinderGeometry(0.245, 0.245, 5, 48), paint, 0, -8.3, 0);
add(totem, new THREE.CylinderGeometry(0.245, 0.2, 0.3, 48), paint, 0, -5.65, 0);
const stripes = label(256, 64, function (g, w, h) {
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#0a0a0a' : '#f6c94c'; g.fillRect(i * w / 8, 0, w / 8, h); }
});
stripes.wrapS = THREE.RepeatWrapping; stripes.repeat.set(2, 1);
add(totem, new THREE.CylinderGeometry(0.212, 0.212, 1.7, 48, 1, true), new THREE.MeshPhysicalMaterial({ map: stripes, roughness: 0.35, clearcoat: 0.6 }), 0, -4.3, 0);

/* ---------- Signal head on two chrome brackets ---------- */
const HEAD_X = 1.72;
[2.5, -2.5].forEach(function (y) {
  const s = Math.sign(y);
  add(totem, new THREE.CylinderGeometry(0.075, 0.075, HEAD_X - 0.1, 20), chrome, HEAD_X / 2, y, 0).rotation.z = Math.PI / 2;
  add(totem, new THREE.CylinderGeometry(0.075, 0.075, 0.5, 20), chrome, HEAD_X - 0.12, y - s * 0.25, 0);
  add(totem, new THREE.SphereGeometry(0.075, 20, 12), chrome, HEAD_X - 0.12, y, 0);
  add(totem, new RoundedBoxGeometry(0.62, 0.3, 0.52, 4, 0.05), chrome, 0, y, 0);
});
const head = new THREE.Group();
head.position.set(HEAD_X, 0, 0.1);
head.rotation.y = -0.5;
totem.add(head);

/* An LED-dot face: a pictogram and the live count, drawn small and then enlarged dot by dot. */
const GRID = 30;
function drawLed(lamp, count) {
  const small = document.createElement('canvas'); small.width = small.height = GRID;
  const s = small.getContext('2d');
  s.fillStyle = '#fff';
  s.beginPath();
  if (lamp.glyph === 'up') { s.moveTo(15, 3); s.lineTo(22, 11); s.lineTo(8, 11); }
  else if (lamp.glyph === 'down') { s.moveTo(15, 11); s.lineTo(22, 3); s.lineTo(8, 3); }
  else { s.rect(8, 4, 14, 2.4); s.rect(8, 8, 14, 2.4); }
  s.fill();
  s.font = '800 15px Sora, sans-serif'; s.textAlign = 'center'; s.textBaseline = 'alphabetic';
  s.fillText(count == null ? '-' : String(count), 15, 25.5);
  const px = s.getImageData(0, 0, GRID, GRID).data;

  const g = lamp.ctx, S = 600, step = S / GRID;
  g.fillStyle = '#050505'; g.fillRect(0, 0, S, S);
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
    const on = px[(y * GRID + x) * 4 + 3] > 96;
    g.fillStyle = on ? lamp.hot : lamp.color;
    g.globalAlpha = on ? 1 : 0.2;
    g.beginPath(); g.arc((x + 0.5) * step, (y + 0.5) * step, step * (on ? 0.44 : 0.3), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  lamp.map.needsUpdate = true;
}

LAMPS.forEach(function (lamp) {
  const c = document.createElement('canvas'); c.width = c.height = 600;
  lamp.ctx = c.getContext('2d');
  lamp.map = new THREE.CanvasTexture(c);
  lamp.map.colorSpace = THREE.SRGBColorSpace; lamp.map.anisotropy = 8;
  lamp.face = new THREE.MeshStandardMaterial({ map: lamp.map, emissiveMap: lamp.map, emissive: 0xffffff, roughness: 0.4, toneMapped: false });
  lamp.level = 0; lamp.target = 0;

  // Housing module with four small bolts.
  add(head, new RoundedBoxGeometry(1.34, 1.3, 0.95, 6, 0.1), gloss, 0, lamp.y, 0);
  [[-0.56, 0.54], [0.56, 0.54], [-0.56, -0.54], [0.56, -0.54]].forEach(function (b) {
    add(head, new THREE.CylinderGeometry(0.035, 0.035, 0.04, 12), chrome, b[0], lamp.y + b[1], 0.48).rotation.x = Math.PI / 2;
  });
  // Deep hood: a short full tube plus a long top half, tinted plastic outside, chrome-lined inside.
  const hood = new THREE.Group();
  hood.position.set(0, lamp.y, 0.47); hood.rotation.x = 0.1;
  head.add(hood);
  const tint = new THREE.MeshPhysicalMaterial({ color: lamp.dim, roughness: 0.18, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06, emissive: lamp.color, emissiveIntensity: 0 });
  const lining = new THREE.MeshStandardMaterial({ color: 0x9a9d9c, roughness: 0.22, metalness: 0.9, side: THREE.BackSide, emissive: lamp.color, emissiveIntensity: 0 });
  lamp.tint = tint; lamp.lining = lining;
  const ring = new THREE.CylinderGeometry(0.61, 0.57, 0.5, 64, 1, true);
  const top = new THREE.CylinderGeometry(0.68, 0.61, 0.8, 64, 1, true, Math.PI * 0.42, Math.PI * 1.16);
  add(hood, ring, tint, 0, 0, 0.25).rotation.x = Math.PI / 2;
  add(hood, ring, lining, 0, 0, 0.25).rotation.x = Math.PI / 2;
  add(hood, top, tint, 0, 0, 0.9).rotation.x = Math.PI / 2;
  add(hood, top, lining, 0, 0, 0.9).rotation.x = Math.PI / 2;
  add(hood, new THREE.TorusGeometry(0.68, 0.03, 12, 64, Math.PI * 1.16), tint, 0, 0, 1.3).rotation.z = -Math.PI * 0.08;
  // Lens at the back of the hood, under a glassy dome.
  add(head, new THREE.CircleGeometry(0.55, 64), lamp.face, 0, lamp.y, 0.485).castShadow = false;
  const dome = add(head, new THREE.SphereGeometry(0.55, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, roughness: 0.03, clearcoat: 1 }), 0, lamp.y, 0.485);
  dome.scale.y = 0.22; dome.rotation.x = Math.PI / 2; dome.castShadow = false;
  lamp.light = new THREE.PointLight(lamp.color, 0, 5, 1.5);
  lamp.light.position.set(0, lamp.y + 0.15, 1.1);
  head.add(lamp.light);
  drawLed(lamp, null);
});
add(head, new RoundedBoxGeometry(0.9, 3.7, 0.4, 4, 0.08), gloss, 0, 0, -0.5);

/* ---------- LED sign: a live ticker of the day's biggest movers ---------- */
const sign = new THREE.Group();
sign.position.set(-2.55, 0.35, 0.3);
sign.rotation.set(0, 0.34, -0.035);
totem.add(sign);
add(sign, new RoundedBoxGeometry(3.25, 1.95, 0.62, 8, 0.3), amber, 0, -0.06, -0.12);
add(sign, new RoundedBoxGeometry(3.05, 1.72, 0.5, 8, 0.24), gloss, 0, 0, 0.06);
add(totem, new THREE.CylinderGeometry(0.1, 0.1, 1.5, 20), amber, -0.75, 0.3, 0.05).rotation.z = Math.PI / 2;
add(totem, new THREE.CylinderGeometry(0.235, 0.235, 0.42, 40), amber, 0, 0.3, 0);
const TW = 768, TH = 432;
const tickerCanvas = document.createElement('canvas'); tickerCanvas.width = TW; tickerCanvas.height = TH;
const tk = tickerCanvas.getContext('2d');
const tickerMap = new THREE.CanvasTexture(tickerCanvas);
tickerMap.colorSpace = THREE.SRGBColorSpace; tickerMap.anisotropy = 8;
const screen = add(sign, new THREE.PlaneGeometry(2.72, 1.4), new THREE.MeshBasicMaterial({ map: tickerMap, toneMapped: false }), 0, 0, 0.315);
screen.castShadow = false;
// Text is drawn solid on a scratch canvas, then punched through a grid of dots so it reads as LEDs.
const scratch = document.createElement('canvas'); scratch.width = TW; scratch.height = TH;
const sc = scratch.getContext('2d');
const dots = document.createElement('canvas'); dots.width = TW; dots.height = TH;
(function () {
  const d = dots.getContext('2d'); d.fillStyle = '#fff';
  for (let y = 4; y < TH; y += 8) for (let x = 4; x < TW; x += 8) { d.beginPath(); d.arc(x, y, 3.1, 0, 7); d.fill(); }
})();
let ticker = { head: 'DSE · LAST CLOSE', items: [], width: 1, x: 0 };
function measureTicker() {
  sc.font = 'italic 800 150px Sora, sans-serif';
  ticker.items.forEach(function (it) { it.w1 = sc.measureText(it.sym + ' ').width; it.w2 = sc.measureText(it.move + '     ').width; });
  ticker.width = ticker.items.reduce(function (a, it) { return a + it.w1 + it.w2; }, 0) || 1;
}
function drawTicker(dt) {
  ticker.x = (ticker.x + dt * 190) % ticker.width;
  sc.clearRect(0, 0, TW, TH);
  sc.textBaseline = 'alphabetic'; sc.textAlign = 'left';
  sc.font = '700 54px Sora, sans-serif'; sc.fillStyle = '#c9cdc9';
  sc.fillText(ticker.head, 30, 96);
  sc.font = 'italic 800 150px Sora, sans-serif';
  let x = 30 - ticker.x;
  for (let pass = 0; pass < 3 && x < TW; pass++) {
    ticker.items.forEach(function (it) {
      if (x + it.w1 + it.w2 > 0 && x < TW) {
        sc.fillStyle = '#ffffff'; sc.fillText(it.sym, x, 300);
        sc.fillStyle = it.up ? '#3ee57b' : '#ff5a4d'; sc.fillText(it.move, x + it.w1, 300);
      }
      x += it.w1 + it.w2;
    });
  }
  sc.globalCompositeOperation = 'destination-in'; sc.drawImage(dots, 0, 0); sc.globalCompositeOperation = 'source-over';
  tk.fillStyle = '#070807'; tk.fillRect(0, 0, TW, TH);
  tk.drawImage(scratch, 0, 0);
  tickerMap.needsUpdate = true;
}

/* ---------- Sign post: diamond, amber plaque, date plaque ---------- */
const POST_X = -2.35;
add(totem, new THREE.CylinderGeometry(0.07, 0.07, 9, 24), chrome, POST_X, -7.1, -0.05);
const diamond = new THREE.Group();
diamond.position.set(POST_X, -3.75, 0.12);
diamond.rotation.set(0, 0.2, 0);
totem.add(diamond);
add(diamond, new RoundedBoxGeometry(2.42, 2.42, 0.1, 6, 0.05), greenRim, 0, 0, 0).rotation.z = Math.PI / 4;
const chart = label(512, 512, function (g) {
  g.fillStyle = '#10b750'; g.fillRect(0, 0, 512, 512);
  g.save(); g.translate(256, 256); g.rotate(Math.PI / 4); g.translate(-256, -256);
  g.strokeStyle = '#0a3d1f'; g.lineWidth = 44; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(112, 340); g.lineTo(206, 246); g.lineTo(272, 306); g.lineTo(396, 176); g.stroke();
  g.beginPath(); g.moveTo(300, 168); g.lineTo(400, 168); g.lineTo(400, 268); g.stroke();
  g.restore();
});
const face = add(diamond, new RoundedBoxGeometry(2.2, 2.2, 0.1, 6, 0.05), [greenRim, greenRim, greenRim, greenRim,
  new THREE.MeshPhysicalMaterial({ map: chart, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.3, envMapIntensity: 0.5 }), greenRim], 0, 0, 0.03);
face.rotation.z = Math.PI / 4;

const plaqueText = label(512, 400, function (g, w, h) {
  g.fillStyle = '#f6c94c'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#3b2c05'; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28);
  g.fillStyle = '#231a03'; g.font = '700 82px Sora, sans-serif'; g.textAlign = 'center';
  ['Stocks', 'Bonds', 'Dividends'].forEach(function (t, i) { g.fillText(t, w / 2, 132 + i * 104); });
});
add(totem, new RoundedBoxGeometry(1.75, 1.37, 0.07, 4, 0.03), [amber, amber, amber, amber, new THREE.MeshPhysicalMaterial({ map: plaqueText, roughness: 0.4, clearcoat: 0.5 }), amber], POST_X, -5.95, 0.1).rotation.set(0, 0.2, 0.02);
const dateCanvas = document.createElement('canvas'); dateCanvas.width = 640; dateCanvas.height = 150;
const dateMap = new THREE.CanvasTexture(dateCanvas); dateMap.colorSpace = THREE.SRGBColorSpace; dateMap.anisotropy = 8;
function drawDate(text) {
  const g = dateCanvas.getContext('2d');
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, 640, 150);
  g.strokeStyle = '#0a0a0a'; g.lineWidth = 8; g.strokeRect(10, 10, 620, 130);
  g.fillStyle = '#0a0a0a'; g.font = '700 58px ui-monospace, Menlo, monospace'; g.textAlign = 'center';
  g.fillText(text, 320, 96);
  dateMap.needsUpdate = true;
}
add(totem, new RoundedBoxGeometry(1.75, 0.41, 0.06, 4, 0.03), [white, white, white, white, new THREE.MeshPhysicalMaterial({ map: dateMap, roughness: 0.45, clearcoat: 0.4 }), white], POST_X, -6.98, 0.1).rotation.set(0, 0.2, -0.02);
drawDate('LAST CLOSE');

/* ---------- The loop of light: all on, then fell, held, rose, then rest on the day's lamp ---------- */
let mood = 'up';
const STEPS = [
  { on: [], t: 0.5 }, { on: ['down', 'flat', 'up'], t: 0.7 }, { on: [], t: 0.55 },
  { on: ['down'], t: 1.15 }, { on: [], t: 0.3 }, { on: ['flat'], t: 1.15 }, { on: [], t: 0.3 }, { on: ['up'], t: 1.15 }, { on: [], t: 0.45 },
  { on: 'mood', t: 3.4 }
];
const LOOP = STEPS.reduce(function (a, s) { return a + s.t; }, 0);
function lit(time) {
  if (reducedMotion) return [mood];
  let t = time % LOOP;
  for (const s of STEPS) { if (t < s.t) return s.on === 'mood' ? [mood] : s.on; t -= s.t; }
  return [mood];
}

/* ---------- Live data, handed over by app.js ---------- */
function setData(d) {
  LAMPS.forEach(function (l) { drawLed(l, d[l.key]); });
  mood = d.up > d.down ? 'up' : d.down > d.up ? 'down' : 'flat';
  ticker.items = (d.movers || []).map(function (m) { return { sym: m.sym, up: m.up, move: m.move }; });
  if (d.stamp) { ticker.head = 'DSE · ' + d.stamp.toUpperCase(); drawDate(d.stamp.toUpperCase() + ' CLOSE'); }
  ticker.x = 0; ticker.drawn = false;
  measureTicker();
}
addEventListener('sv:signal', function (e) { setData(e.detail); });
Promise.all([document.fonts.load('800 150px Sora'), document.fonts.load('italic 800 150px Sora')]).then(function () {
  if (window.svSignal) setData(window.svSignal); else LAMPS.forEach(function (l) { drawLed(l, null); });
});

/* ---------- Frame ---------- */
const aim = { x: 0, y: 0 };
addEventListener('pointermove', function (e) { aim.x = e.clientX / innerWidth - 0.5; aim.y = e.clientY / innerHeight - 0.5; });
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Frame the whole object: 11.8 units tall, about 8.2 wide.
  const fov = THREE.MathUtils.degToRad(camera.fov / 2);
  const dist = Math.max(5.9 / Math.tan(fov), 4.1 / (Math.tan(fov) * camera.aspect));
  camera.position.set(LOOK.x - dist * 0.2, LOOK.y - 0.2, dist);
  camera.lookAt(LOOK);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.25), t = clock.elapsedTime;
  if (!reducedMotion) {
    totem.rotation.y += ((aim.x * 0.14) - totem.rotation.y) * Math.min(1, dt * 3);
    drawTicker(dt);
  } else if (ticker.items.length && !ticker.drawn) { drawTicker(0); ticker.drawn = true; }
  const on = lit(t);
  LAMPS.forEach(function (l) {
    l.target = on.indexOf(l.key) > -1 ? 1 : 0;
    l.level += (l.target - l.level) * Math.min(1, dt * 12);
    l.face.emissiveIntensity = 0.02 + l.level * 1.25;
    l.face.color.setScalar(0.1 * (1 - l.level));
    l.light.intensity = l.level * 14;
    l.tint.emissiveIntensity = l.level * 0.5;
    l.lining.emissiveIntensity = l.level * 0.55;
  });
  renderer.render(scene, camera);
}
// Only draw while the hero panel is on screen.
new IntersectionObserver(function (entries) {
  renderer.setAnimationLoop(entries[0].isIntersecting ? frame : null);
}).observe(canvas);
