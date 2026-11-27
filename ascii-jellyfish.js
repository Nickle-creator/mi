(() => {
  const root = document.getElementById('asciiJellyfish');
  const canvas = root?.querySelector('canvas');
  const ctx = canvas?.getContext('2d', { alpha: true });
  if (!root || !canvas || !ctx) return;
  const introNote = document.getElementById('jellyfishIntro');
  const arrivalIntro = !!introNote && document.documentElement.classList.contains('jellyfish-arrival');

  /* ------------------------------------------------------------------
     ASCII moon-jelly companion
     - translucent pulsing bell, glowing canals, 4 pink gonad loops
     - ruffled oral arms + long trailing tentacles with light beads
     - reacts to scrolling, the cursor, clicks, and falls asleep when idle
     - does a random trick every few seconds
  ------------------------------------------------------------------- */

  const SCALE = 0.60;                  // fixed overall scale; tricks do not enlarge the creature
  const COLS = 46, ROWS = 44, CELL_W = 7, CELL_H = 9;
  const SIZE = COLS * ROWS;
  const W = COLS * CELL_W, H = ROWS * CELL_H;
  const COL_SCALE = 10.5, ROW_SCALE = 8.2, ROW_C = 22, PIVOT_Y = -0.9, CAMERA = 5.3;

  const RAMP = ' .,:;-=+*oxOX#%@';
  const RIBS = ':;+=*';
  const ARMS = '~^{}=/\\:;';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const depths = new Float32Array(SIZE);
  const intensities = new Float32Array(SIZE);
  const hues = new Float32Array(SIZE);
  const lights = new Float32Array(SIZE);
  const coreCells = new Uint8Array(SIZE);
  const textOverlapCells = new Uint8Array(SIZE);
  const glyphs = new Array(SIZE);

  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  canvas.style.display = 'block';
  Object.assign(root.style, {
    position: 'fixed', left: '0', top: '0', width: W + 'px', height: H + 'px',
    pointerEvents: 'none', transformOrigin: '0 0', willChange: 'transform'
  });
  if (getComputedStyle(root).zIndex === 'auto') root.style.zIndex = '40';
  root.setAttribute('aria-hidden', 'true');

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const smooth = (a, b, v) => { const n = clamp((v - a) / (b - a), 0, 1); return n * n * (3 - 2 * n); };
  const fract = (v) => v - Math.floor(v);

  let paletteMix = 0;
  let targetPaletteMix = document.documentElement.dataset.theme === 'night' ? 0 : 1;
  const NIGHT_ACCENT = [217, 120, 138];
  const NIGHT_CORE = [243, 236, 223];
  const PAPER_MAROON = [122, 31, 46];
  const themeRgb = (core = false) => {
    const night = core ? NIGHT_CORE : NIGHT_ACCENT;
    return night.map((value, i) => Math.round(value + (PAPER_MAROON[i] - value) * paletteMix));
  };
  const themeColor = (core = false) => `rgb(${themeRgb(core).join(', ')})`;
  const themeRgba = (core, alpha) => `rgba(${themeRgb(core).join(', ')}, ${alpha})`;
  const mixv = (night, paper) => night + (paper - night) * paletteMix;
  const themeObserver = new MutationObserver(() => {
    targetPaletteMix = document.documentElement.dataset.theme === 'night' ? 0 : 1;
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------------- state ---------------- */
  let t = 0;
  const introStartedAt = performance.now();
  const introDuration = 2500;
  let yaw = 0, pitch = 0, roll = 0, lift = 0;
  let swimPhase = 0, pulse = 0;
  let excite = 0, glow = 0, rainbow = 0, rainbowT = 0, ruffle = 0;
  let bellBloom = 0, corkscrew = 0, fan = 0;
  let hover = 0, sleepy = 0;
  let lookX = 0, lookY = 0;
  let spinAnim = null, flipAnim = null;
  let bellR = 1.2, bellH = 0.92;
  let dragX = 0, dragY = 0;
  let dartVX = 0, dartVY = 0;
  let lastActive = performance.now();
  let nextTrick = 1.8;
  let zClock = 1;
  const ripples = [];
  const particles = [];
  const mouse = { x: -9999, y: -9999 };

  /* ---------------- helpers ---------------- */
  function clearCells() {
    depths.fill(-1000);
    intensities.fill(-1);
    coreCells.fill(0);
    glyphs.fill(' ');
  }

  function project(x, y, z) {
    y -= PIVOT_Y;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const x1 = x * cy - z * sy;
    const z1 = x * sy + z * cy;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const y1 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const x2 = x1 * cr - y1 * sr;
    const y2 = x1 * sr + y1 * cr;
    const distance = CAMERA - z2;
    if (distance < 1.1) return null;
    const persp = CAMERA / distance;
    return {
      col: COLS * 0.5 + x2 * COL_SCALE * persp,
      row: ROW_C - (y2 + lift) * ROW_SCALE * persp,
      z: z2
    };
  }

  // glass = translucent shell: brighter cells behind may stay visible
  function put(x, y, z, glyph, intensity, hue, light, depthBias = 0, glass = false, core = false) {
    const p = project(x, y, z);
    if (!p || p.col < 0 || p.col >= COLS || p.row < 0 || p.row >= ROWS) return;
    const i = Math.round(p.row) * COLS + Math.round(p.col);
    if (glass && intensities[i] > intensity) return;
    const depth = p.z + depthBias;
    if (depth < depths[i] - 0.035) return;
    if (depth > depths[i] + 0.025 || intensity > intensities[i]) {
      depths[i] = depth;
      intensities[i] = intensity;
      hues[i] = hue;
      lights[i] = light;
      coreCells[i] = core ? 1 : 0;
      glyphs[i] = glyph;
    }
  }

  function shadedGlyph(intensity) {
    return RAMP[clamp(Math.round(intensity * (RAMP.length - 1)), 1, RAMP.length - 1)];
  }

  // contraction is quick, recovery is slow — like a real swimming stroke
  function pulseShape(p) {
    return p < 0.2 ? 1 - (1 - p / 0.2) ** 2 : 1 - smooth(0.2, 1, (p - 0.2) / 0.8 * 0.8 + 0.2);
  }

  function ripGlow(theta) {
    let g = 0;
    for (const r of ripples) {
      if (r.age <= 0) continue;
      const d = (theta - r.age * 1.55) / 0.17;
      g += Math.exp(-d * d) * (1 - r.age / 2.4);
    }
    return g;
  }

  /* ---------------- bell ---------------- */
  function paintBell(time) {
    const R = 1.22 * (1 - 0.025 * pulse);
    const Ht = 0.92 * (1 + 0.025 * pulse);
    bellR = R; bellH = Ht;
    const baseY = 0.15;
    const hoverGlow = hover * 0.14;
    const rings = 24, around = 96;

    for (let ri = 0; ri <= rings; ri++) {
      const theta = 0.03 + (1.6 - 0.03) * ri / rings;
      const st = Math.sin(theta), ct = Math.cos(theta);
      const flare = 1 + 0.10 * smooth(1.0, 1.6, theta) * (1 - pulse * 0.9);
      const rg = ripGlow(theta);
      for (let ai = 0; ai < around; ai++) {
        const phi = ai / around * Math.PI * 2;
        const scallop = smooth(1.25, 1.6, theta) * 0.035 * Math.sin(phi * 14 + time * 1.8 + theta * 3);
        const rr = R * flare * st + scallop;
        const x = rr * Math.cos(phi), z = rr * Math.sin(phi);
        const y = baseY + Ht * ct;
        const nx = x / (R * R), ny = (y - baseY) / (Ht * Ht), nz = z / (R * R);
        const len = Math.hypot(nx, ny, nz) || 1;
        const nzn = nz / len;
        const fres = 1 - Math.abs(nzn);
        const diffuse = Math.max(0, (-0.4 * nx + 0.55 * ny + 0.73 * nz) / len);
        const front = nz > 0;
        const glint = front ? Math.exp(-(((x + 0.45) / 0.34) ** 2 + ((y - 1.0) / 0.2) ** 2)) +
                              0.5 * Math.exp(-(((x - 0.5) / 0.2) ** 2 + ((y - 0.8) / 0.12) ** 2)) : 0;
        let intensity = 0.13 + 0.5 * fres * fres + 0.2 * diffuse + 0.3 * glint + 0.5 * rg + hoverGlow + 0.13 * bellBloom;
        if (!front) intensity *= 0.7;
        intensity = clamp(intensity, 0.1, 1);
        const hue = 192 + 40 * st + 12 * Math.sin(phi * 3 + time * 0.4) + 75 * Math.min(1, rg);
        put(x, y, z, shadedGlyph(intensity), intensity, hue, 30 + 46 * intensity, 0, true);
      }
    }

    // glowing radial canals with light pulses running down them
    const canals = 12;
    for (let k = 0; k < canals; k++) {
      const phi = k / canals * Math.PI * 2;
      const front = fract(time * 0.33 + k * 0.137);
      for (let s = 0; s <= 24; s++) {
        const u = s / 24;
        const theta = 0.08 + u * 1.38;
        const st = Math.sin(theta), ct = Math.cos(theta);
        const rr = R * st * 1.005;
        const x = rr * Math.cos(phi), z = rr * Math.sin(phi);
        const y = baseY + Ht * ct;
        const bead = Math.exp(-(((u - front) / 0.07) ** 2));
        const intensity = clamp(0.36 + 0.22 * Math.max(0, Math.sin(phi)) + 0.45 * bead + 0.35 * ripGlow(theta), 0, 1);
        put(x, y, z, RIBS[(s + k) % RIBS.length], intensity, 188 + 30 * u + 60 * bead, 50 + 30 * intensity, 0.03);
      }
    }

    // scalloped bright rim
    for (let ai = 0; ai <= 136; ai++) {
      const phi = ai / 136 * Math.PI * 2;
      const r = R * 1.1 * (1 - 0.0 * pulse) + 0.035 * Math.sin(phi * 14 + time * 1.8);
      const x = r * Math.cos(phi), z = r * Math.sin(phi);
      const y = baseY - 0.02 + 0.03 * Math.sin(phi * 6 + time * 1.2);
      const intensity = 0.74 + 0.2 * (0.5 + 0.5 * Math.sin(phi * 8 + time * 1.6)) + 0.1 * glow;
      put(x, y, z, '=~*+'[(ai + Math.floor(time * 9)) % 4], clamp(intensity, 0, 1), 184 + 24 * Math.sin(phi + 0.5) + 50 * glow, 66 + 22 * intensity, 0.06);
    }

    // four pink horseshoe gonads seen through the glass
    const gScale = R / 1.22;
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + 0.785;
      const cx = 0.5 * Math.cos(a) * gScale, cz = 0.5 * Math.sin(a) * gScale;
      const cyy = baseY + Ht * 0.6;
      const tx = -Math.sin(a), tz = Math.cos(a);
      for (const ring of [0.23, 0.185]) {
        for (let j = 0; j <= 28; j++) {
          const ang = 0.4 + j / 28 * Math.PI * 2 * 0.86;
          const rx = ring * Math.cos(ang) * gScale, ry = ring * 0.72 * Math.sin(ang);
          const beat = 0.5 + 0.5 * Math.sin(time * 1.6 + k + j * 0.2);
          const intensity = 0.62 + 0.3 * beat + 0.1 * glow;
          put(cx + tx * rx, cyy + ry * (1 + 0.1 * pulse), cz + tz * rx, 'Oo0@'[(j + k) % 4], clamp(intensity, 0, 1), 305 + 25 * Math.sin(ang + k) + 20 * glow, 56 + 24 * beat, 0.7);
        }
      }
    }
    // glowing core
    for (let s = 0; s < 12; s++) {
      const a = s / 12 * Math.PI * 2;
      put(0.07 * Math.cos(a), baseY + Ht * 0.42 + 0.05 * Math.sin(a * 2), 0.07 * Math.sin(a), '@%#'[s % 3], 0.85, 320, 72, 0.7, false, true);
    }
  }

  /* ---------------- arms + tentacles ---------------- */
  function paintTrailing(time) {
    const lagXv = clamp(dragX * 0.0016, -1.1, 1.1);
    const lagYv = clamp(dragY * 0.0010, -0.9, 0.9);
    const rimR = bellR * 1.0;
    const amp0 = 1 + 0.8 * ruffle + 0.5 * excite + 0.42 * bellBloom + 0.55 * fan;
    const baseY = 0.15;

    // ruffled oral arms
    for (let arm = 0; arm < 4; arm++) {
      const a = arm * Math.PI / 2 + 0.4;
      const len = 1.35 + 0.25 * Math.sin(arm * 2.2);
      const tx = -Math.sin(a), tz = Math.cos(a);
      for (let s = 0; s <= 40; s++) {
        const u = s / 40, lag = u * u;
        const wave = time * 0.9 + a + u * 5.8;
        const flare = (0.04 + 0.22 * u) * amp0;
        const cx = 0.16 * Math.cos(a) + flare * Math.sin(wave) - lagXv * lag * 0.7;
        const cz = 0.16 * Math.sin(a) + flare * 0.72 * Math.cos(wave * 0.86);
        const cy = Math.min(0.12, baseY - 0.02 - len * u * (1 + 0.04 * pulse) + (0.04 + 0.2 * u) * Math.sin(time * 1.6 - u * 7.4 + a) + lagYv * lag * 0.7);
        const width = (0.05 + 0.08 * Math.sin(u * 3.1)) * (1 - 0.35 * u);
        const wl = 0.5 + 0.5 * Math.sin(time * 2 + u * 9 + a);
        for (let v = -2; v <= 2; v++) {
          const vv = v / 2;
          const fr = 0.03 * Math.sin(u * 38 + vv * 3 + time * 2.4 + arm) * (0.4 + u);
          const off = vv * width + fr;
          const glyph = ARMS[(s + v + 2 + arm) % ARMS.length];
          const intensity = 0.55 + 0.3 * wl + 0.1 * glow;
          put(cx + tx * off, cy, cz + tz * off, glyph, clamp(intensity, 0, 1), 282 + 45 * u + arm * 4 + 20 * glow, 54 + 24 * wl, 0.5);
        }
      }
    }

    // fringe of short margin tentacles + long thin trailing tentacles
    const groups = [
      { count: 36, steps: 12, minL: 0.4, varL: 0.4, amp: 0.1, bead: false },
      { count: 14, steps: 46, minL: 1.9, varL: 1.0, amp: 0.3, bead: true }
    ];
    for (const g of groups) {
      for (let k = 0; k < g.count; k++) {
        const phi = k / g.count * Math.PI * 2 + (g.bead ? 0.2 : 0);
        const L = g.minL + g.varL * (0.5 + 0.5 * Math.sin(k * 1.9 + 0.5));
        const phase = k * 0.82;
        const ax = rimR * Math.cos(phi), az = rimR * Math.sin(phi);
        const beadPos = fract(time * 0.42 + k * 0.173);
        let px = ax;
        for (let s = 0; s <= g.steps; s++) {
          const u = s / g.steps, lag = u * u;
          const amp = (0.04 + (g.amp + 0.1) * u) * amp0;
          const wave = time * (1.1 + 0.1 * Math.sin(k)) - u * 5.2 + phase;
          const x = ax * (1 - 0.15 * u) + amp * Math.sin(wave) - lagXv * lag;
          const z = az * (1 - 0.15 * u) + amp * 0.7 * Math.cos(wave * 0.83);
          let y = baseY - 0.03 - L * u * (1 + 0.035 * pulse) + (0.07 + 0.25 * u) * Math.sin(time * 1.9 - u * 7.2 + phase) * u + lagYv * lag;
          y = Math.min(y, baseY - 0.04);
          const dx = x - px; px = x;
          let glyph;
          if (u > 0.93) glyph = ".',"[(k + s) % 3];
          else if (Math.abs(dx * 14) > 0.55) glyph = dx > 0 ? '\\' : '/';
          else glyph = s % 4 === 0 ? ':' : '|';
          let intensity = 0.42 + 0.2 * (1 - u) + 0.15 * glow;
          let hue = 188 + 34 * u + 15 * Math.sin(phi + 0.4);
          let light = 50 + 20 * (1 - u);
          if (g.bead) {
            const b = Math.exp(-(((u - beadPos) / 0.035) ** 2));
            if (b > 0.35) { glyph = '*'; intensity = 0.95; hue = 300 + 30 * u; light = 78; }
          }
          put(x, y, z, glyph, clamp(intensity, 0, 1), hue, light, 0.012);
        }
      }
    }
  }

  /* ---------------- particles ---------------- */
  function anchor(x = 0, y = 0.05, z = 0) {
    return project(x, y, z) || { col: COLS / 2, row: ROW_C };
  }

  function addParticle(kind, delay = 0) {
    if (particles.length < 90) particles.push({ kind, age: -delay, life: 2.5, placed: false, col: 0, row: 0, vx: 0, vy: 0, seed: Math.random() });
  }

  function placeParticle(p) {
    p.placed = true;
    if (p.kind === 'heart') {
      const a = anchor(0, 1.1); p.col = a.col + (Math.random() - 0.5) * 8; p.row = a.row;
      p.vx = (Math.random() - 0.5) * 3; p.vy = -(3 + Math.random() * 2); p.life = 2.6;
    } else if (p.kind === 'zzz') {
      const a = anchor(0.8, 1.0); p.col = a.col; p.row = a.row;
      p.vx = 1.4; p.vy = -2.4; p.life = 3.4;
    } else {
      p.col = COLS / 2 + (Math.random() - 0.5) * 32; p.row = 6 + Math.random() * 26;
      p.life = 1.2 + Math.random() * 1.2;
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age < 0) continue;
      if (!p.placed) placeParticle(p);
      p.col += p.vx * dt;
      p.row += p.vy * dt;
      if (p.age > p.life) particles.splice(i, 1);
    }
  }

  function drawParticles() {
    for (const p of particles) {
      if (p.age < 0 || !p.placed) continue;
      const f = p.age / p.life;
      const col = Math.round(p.col), row = Math.round(p.row);
      if (col < 0 || col >= COLS - 1 || row < 0 || row >= ROWS) continue;
      const overText = textOverlapCells[row * COLS + col] || textOverlapCells[row * COLS + col + 1];
      ctx.globalAlpha = clamp(1 - f * f, 0, 1) * (1 - 0.35 * sleepy) * (overText ? 0.35 : 1);
      if (p.kind === 'heart') {
        ctx.fillStyle = themeColor();
        ctx.fillText('<', (col + 0.5) * CELL_W, (row + 0.5) * CELL_H);
        ctx.fillText('3', (col + 1.5) * CELL_W, (row + 0.5) * CELL_H);
      } else if (p.kind === 'zzz') {
        ctx.fillStyle = themeColor();
        ctx.fillText(f > 0.5 ? 'Z' : 'z', (col + 0.5) * CELL_W, (row + 0.5) * CELL_H);
      } else {
        ctx.fillStyle = themeColor();
        ctx.fillText('.+*+.'[Math.min(4, Math.floor(f * 5))], (col + 0.5) * CELL_W, (row + 0.5) * CELL_H);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- tricks ---------------- */
  const tricks = {
    spin() { spinAnim = { t: 0, dur: 2.3 }; excite = Math.max(excite, 0.5); },
    flip() { flipAnim = { t: 0, dur: 2.7, dir: Math.random() < 0.5 ? 1 : -1 }; excite = Math.max(excite, 0.8); },
    flash() { for (let i = 0; i < 3; i++) ripples.push({ age: -i * 0.65 }); glow = 1; },
    rainbow() { rainbowT = 5; },
    hearts() { for (let i = 0; i < 5; i++) addParticle('heart', i * 0.3); },
    dart() { dartVX = (Math.random() - 0.5) * 900; dartVY = (Math.random() - 0.5) * 600; excite = 1; },
    ruffle() { ruffle = 1; excite = Math.max(excite, 0.4); },
    sparkle() { for (let i = 0; i < 18; i++) addParticle('spark', Math.random() * 1.2); },
    corkscrew() {
      spinAnim = { t: 0, dur: 3.2 };
      flipAnim = { t: 0, dur: 3.2, dir: Math.random() < 0.5 ? 1 : -1 };
      ruffle = 1; excite = 1;
    },
    bellBloom() {
      bellBloom = 1; glow = 1; ruffle = 0.75;
      for (let i = 0; i < 4; i++) ripples.push({ age: -i * 0.32 });
    },
    pulseWave() {
      for (let i = 0; i < 5; i++) ripples.push({ age: -i * 0.38 });
      excite = Math.max(excite, 0.8); ruffle = 0.8;
    },
    currentSurge() {
      dartVX = (Math.random() < 0.5 ? -1 : 1) * 430;
      dartVY = (Math.random() - 0.5) * 450;
      corkscrew = Math.random() < 0.5 ? -0.7 : 0.7;
      ruffle = 1; excite = 1;
    },
    barrelRoll() {
      spinAnim = { t: 0, dur: 2.8 };
      flipAnim = { t: 0, dur: 2.8, dir: Math.random() < 0.5 ? 1 : -1 };
      corkscrew = Math.random() < 0.5 ? -0.55 : 0.55;
      ruffle = 1.2; excite = 1;
    },
    tentacleFan() {
      fan = 1; ruffle = 1; glow = 0.8; excite = Math.max(excite, 0.7);
      for (let i = 0; i < 12; i++) addParticle('spark', i * 0.06);
    },
    pulseCascade() {
      bellBloom = 0.8; glow = 1;
      for (let i = 0; i < 7; i++) ripples.push({ age: -i * 0.24 });
      excite = Math.max(excite, 0.8);
    }
  };
  const trickNames = Object.keys(tricks);
  let lastTrick = '';
  function randomTrick() {
    let n;
    do { n = trickNames[(Math.random() * trickNames.length) | 0]; } while (n === lastTrick);
    lastTrick = n;
    tricks[n]();
  }

  /* ---------------- page-aware expressions ----------------
     Jerry changes expression only after a reader settles on a story spread.
     Fast scrolling updates the active spread, but deliberately does not
     trigger a trick or expression until the reader pauses. */
  const moodProfiles = {
    idle: { face: '', color: false },
    bright: { face: '*_*', color: true, trick: 'sparkle' },
    curious: { face: 'o_o', color: false, trick: 'pulseWave' },
    sunglasses: { face: '[■_■]', color: true, trick: 'spin' },
    wave: { face: 'o/', color: false, trick: 'ruffle' },
    dreamy: { face: '♡_♡', color: true, trick: 'hearts' }
  };
  let mood = 'idle', targetMood = 'idle', moodMix = 0;
  let fastScrolling = false, scrollSettleTimer = 0, moodSettleTimer = 0;
  let lastScrollY = window.scrollY, lastScrollAt = performance.now();
  let activeSpreadMood = 'idle';

  function applyMood(nextMood) {
    if (reducedMotion || fastScrolling || nextMood === targetMood) return;
    const profile = moodProfiles[nextMood] || moodProfiles.idle;
    mood = targetMood;
    targetMood = nextMood;
    root.dataset.mood = nextMood;
    if (profile.trick && tricks[profile.trick]) tricks[profile.trick]();
    excite = Math.max(excite, nextMood === 'sunglasses' ? 0.9 : 0.45);
    glow = Math.max(glow, profile.color ? 0.8 : 0.35);
  }

  function requestMood(nextMood) {
    activeSpreadMood = nextMood || 'idle';
    window.clearTimeout(moodSettleTimer);
    if (reducedMotion || fastScrolling) return;
    moodSettleTimer = window.setTimeout(() => applyMood(activeSpreadMood), 620);
  }

  const spreadMoodObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.__jerryRatio = entry.isIntersecting ? entry.intersectionRatio : 0;
    });
    const visible = Array.from(document.querySelectorAll('[data-jerry]'))
      .map((el) => ({ el, ratio: el.__jerryRatio || 0 }))
      .sort((a, b) => b.ratio - a.ratio)[0];
    requestMood(visible && visible.ratio > 0.34 ? visible.el.dataset.jerry : 'idle');
  }, { threshold: [0.34, 0.55, 0.78], rootMargin: '-12% 0px -18% 0px' });
  document.querySelectorAll('[data-jerry]').forEach((spread) => spreadMoodObserver.observe(spread));

  function drawExpression(time) {
    const profile = moodProfiles[targetMood];
    if (!profile.face || moodMix < 0.05) return;
    const face = project(0, 0.76, 0.92);
    if (!face) return;
    ctx.save();
    ctx.globalAlpha = moodMix * (0.82 + 0.12 * Math.sin(time * 2.2));
    ctx.fillStyle = profile.color ? themeColor() : themeColor(true);
    ctx.font = '700 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(profile.face, face.col * CELL_W, face.row * CELL_H);
    ctx.restore();
  }

  /* ---------------- sim + render ---------------- */
  let frameCount = 0, lastHalo = -1;

  function update(dt) {
    t += dt;
    excite = Math.max(0, excite - dt * 0.35);
    glow = Math.max(0, glow - dt * 0.6);
    ruffle = Math.max(0, ruffle - dt * 0.33);
    bellBloom = Math.max(0, bellBloom - dt * 0.55);
    corkscrew *= Math.exp(-dt * 1.25);
    fan = Math.max(0, fan - dt * 0.42);
    paletteMix += (targetPaletteMix - paletteMix) * (1 - Math.exp(-dt * 2.2));
    if (Math.abs(targetPaletteMix - paletteMix) < 0.005) paletteMix = targetPaletteMix;
    if (rainbowT > 0) { rainbowT -= dt; rainbow = Math.min(1, rainbow + dt * 2); }
    else rainbow = Math.max(0, rainbow - dt * 1.2);
    const moodTarget = targetMood === 'idle' ? 0 : 1;
    moodMix += (moodTarget - moodMix) * (1 - Math.exp(-dt * 4.5));

    const rate = (0.62 + 0.9 * excite + (diving ? 0.35 : 0)) * (1 - 0.6 * sleepy);
    swimPhase += rate * dt;
    pulse = pulseShape(fract(swimPhase));

    for (let i = ripples.length - 1; i >= 0; i--) {
      ripples[i].age += dt;
      if (ripples[i].age > 2.4) ripples.splice(i, 1);
    }
    if (spinAnim) { spinAnim.t += dt; if (spinAnim.t >= spinAnim.dur) spinAnim = null; }
    if (flipAnim) { flipAnim.t += dt; if (flipAnim.t >= flipAnim.dur) flipAnim = null; }

    // sleep / wake
    const idleMs = performance.now() - lastActive;
    sleepy += ((idleMs > 45000 ? 1 : 0) - sleepy) * (1 - Math.exp(-dt * 0.8));
    if (sleepy > 0.8) {
      zClock -= dt;
      if (zClock <= 0) { addParticle('zzz'); zClock = 2; }
    }

    // random tricks while awake
    if (sleepy < 0.2 && !fastScrolling) {
      nextTrick -= dt;
      if (nextTrick <= 0) { randomTrick(); nextTrick = 2.2 + Math.random() * 1.8; }
    }

    // look at the cursor
    const cx = currentX + W * SCALE * 0.5, cy = currentY + H * SCALE * 0.27;
    const dx = mouse.x - cx, dy = mouse.y - cy;
    const dist = Math.hypot(dx, dy);
    const near = dist < 700;
    const tlx = near ? clamp(dx / 500, -1, 1) : 0;
    const tly = near ? clamp(dy / 500, -1, 1) : 0;
    const k = 1 - Math.exp(-dt * 3);
    lookX += (tlx - lookX) * k;
    lookY += (tly - lookY) * k;
    hover += ((dist < 170 * SCALE ? 1 : 0) - hover) * (1 - Math.exp(-dt * 5));

    // orientation
    let spinAngle = 0, flipAngle = 0;
    if (spinAnim) spinAngle = smooth(0, 1, spinAnim.t / spinAnim.dur) * Math.PI * 2;
    if (flipAnim) flipAngle = smooth(0, 1, flipAnim.t / flipAnim.dur) * Math.PI * 2 * flipAnim.dir;
    yaw = 0.2 * Math.sin(t * 0.27) + 0.035 * Math.sin(t * 0.73) + lookX * 0.4 + spinAngle + corkscrew * Math.sin(t * 4.2);
    pitch = 0.05 + 0.05 * Math.sin(t * 0.52) + lookY * 0.18 + (diving ? 0.05 : 0) + flipAngle + 0.09 * Math.sin(t * 1.7);
    roll = 0.05 * Math.sin(t * 0.61) - clamp(dragX * 0.00035, -0.3, 0.3) - lookX * 0.07 + corkscrew;
    lift = 0.04 * Math.sin(t * 1.08) + 0.14 * pulse - 0.05 * sleepy + 0.055 * Math.sin(t * 2.6);

    updateParticles(dt);
  }

  function draw() {
    clearCells();
    paintBell(t);
    paintTrailing(t);

    ctx.clearRect(0, 0, W, H);
    markTextCells();
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const i = row * COLS + col;
        const glyph = glyphs[i];
        if (!glyph || glyph === ' ') continue;
        ctx.fillStyle = themeColor(coreCells[i] === 1);
        ctx.globalAlpha = clamp(mixv(0.74 + intensities[i] * 0.26, 0.68 + intensities[i] * 0.32), 0.5, 1) * (1 - 0.35 * sleepy) * (textOverlapCells[i] ? 0.35 : 1);
        ctx.fillText(glyph, (col + 0.5) * CELL_W, (row + 0.5) * CELL_H);
      }
    }
    ctx.globalAlpha = 1;
    drawExpression(t);
    drawParticles();

    // cheap soft halo (CSS filter instead of per-glyph shadowBlur)
    if (++frameCount % 6 === 0) {
      const haloKey = Math.round(paletteMix * 10) + ':' + Math.round(pulse * 6);
      if (haloKey !== lastHalo) {
        lastHalo = haloKey;
        // Keep the original glow radii and pulse; paper mode uses a softer tinted maroon halo.
        const k = 0.72 + 0.28 * pulse;
        const haloScale = 1 - 0.72 * paletteMix;
        canvas.style.filter =
          `drop-shadow(0 0 2px ${themeRgba(false, (0.95 * k * haloScale).toFixed(2))}) ` +
          `drop-shadow(0 0 9px ${themeRgba(false, (0.8 * k * haloScale).toFixed(2))}) ` +
          `drop-shadow(0 0 22px ${themeRgba(false, (0.6 * k * haloScale).toFixed(2))})`;
      }
    }
  }

  /* ---------------- movement ---------------- */
  let diving = false;
  let idleTimer = 0;
  let currentX = 0, currentY = 0, prevX = 0, prevY = 0;
  let idleAnchorX = 0, idleXPhase = 0, idleYPhase = -Math.PI / 2, idleDrift = 0;
  let cornerClock = 0;
  let scrollDepth = 0, lastDraw = 0, lastTime = 0;
  let textRects = [], lastTextScan = -Infinity;
  function refreshTextRects(now) {
    if (now - lastTextScan < 240) return;
    lastTextScan = now;
    const next = [];
    const range = document.createRange();
    document.querySelectorAll('h1,h2,h3,h4,p,li,a,figcaption,blockquote,dt,dd,label,small,caption,td,th,span,strong,em').forEach((el) => {
      if (el.closest('.mast') || !el.textContent.trim() || el.closest('.js .reveal:not(.in)')) return;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.1) return;
      range.selectNodeContents(el);
      for (const rect of range.getClientRects()) {
        if (rect.width > 0 && rect.height > 0) next.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
      }
    });
    textRects = next;
  }
  function markTextCells() {
    textOverlapCells.fill(0);
    const bounds = canvas.getBoundingClientRect();
    const cellWidth = bounds.width / COLS, cellHeight = bounds.height / ROWS;
    if (!(cellWidth > 0 && cellHeight > 0)) return;
    for (const rect of textRects) {
      if (rect.left >= bounds.right || rect.right <= bounds.left || rect.top >= bounds.bottom || rect.bottom <= bounds.top) continue;
      const firstCol = clamp(Math.floor((Math.max(rect.left, bounds.left) - bounds.left) / cellWidth), 0, COLS - 1);
      const lastCol = clamp(Math.ceil((Math.min(rect.right, bounds.right) - bounds.left) / cellWidth) - 1, 0, COLS - 1);
      const firstRow = clamp(Math.floor((Math.max(rect.top, bounds.top) - bounds.top) / cellHeight), 0, ROWS - 1);
      const lastRow = clamp(Math.ceil((Math.min(rect.bottom, bounds.bottom) - bounds.top) / cellHeight) - 1, 0, ROWS - 1);
      for (let row = firstRow; row <= lastRow; row++) {
        textOverlapCells.fill(1, row * COLS + firstCol, row * COLS + lastCol + 1);
      }
    }
  }

  const maxX = () => Math.max(8, window.innerWidth - W * SCALE - 8);
  const maxY = () => Math.max(58, window.innerHeight - H * SCALE - 12);
  const depthOnPage = () => {
    const range = document.documentElement.scrollHeight - window.innerHeight;
    return range > 0 ? clamp(window.scrollY / range, 0, 1) : 0;
  };

  function setPosition(x, y, scale) {
    root.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${(SCALE * scale).toFixed(3)})`;
  }

  function introProgress(now) {
    if (!arrivalIntro || reducedMotion) return 1;
    return smooth(0, 1, clamp((now - introStartedAt) / introDuration, 0, 1));
  }
  function positionIntroNote() {
    if (!arrivalIntro || introNote.hidden) return;
    const r = root.getBoundingClientRect();
    const noteWidth = introNote.offsetWidth || 190, noteHeight = introNote.offsetHeight || 120;
    const safeTop = (document.querySelector('.mast')?.getBoundingClientRect().bottom || 0) + 10;
    const maxLeft = Math.max(12, window.innerWidth - noteWidth - 12);
    const maxTop = Math.max(safeTop, window.innerHeight - noteHeight - 12);
    introNote.style.left = `${Math.round(clamp(r.left - noteWidth - 12, 12, maxLeft))}px`;
    introNote.style.top = `${Math.round(clamp(r.top + 46, safeTop, maxTop))}px`;
  }
  let introDismissTimer = 0;
  function hideIntroNote() {
    if (!arrivalIntro || introNote.hidden) return;
    window.clearTimeout(introDismissTimer);
    introNote.classList.remove('is-visible');
    window.setTimeout(() => {
      introNote.hidden = true;
      document.documentElement.classList.remove('jellyfish-arrival');
    }, reducedMotion ? 30 : 500);
  }
  function showIntroNote() {
    if (!arrivalIntro) return;
    introNote.hidden = false;
    positionIntroNote();
    requestAnimationFrame(() => introNote.classList.add('is-visible'));
    introNote.querySelector('.jellyfish-intro__dismiss')?.addEventListener('click', hideIntroNote, { once: true });
    introDismissTimer = window.setTimeout(hideIntroNote, 7500);
  }

  function readjustIdleAnchor() {
    const limit = maxX();
    idleAnchorX = clamp(currentX, 8, limit);
    const hp = clamp((idleAnchorX - 8) / Math.max(1, limit - 8), 0, 1);
    idleXPhase = Math.asin(hp * 2 - 1);
    idleYPhase = -Math.PI / 2;
    idleDrift = 0;
  }

  const wake = () => { lastActive = performance.now(); };

  function onScroll() {
    const now = performance.now();
    const elapsed = Math.max(8, now - lastScrollAt);
    const speed = Math.abs(window.scrollY - lastScrollY) / elapsed;
    lastScrollY = window.scrollY;
    lastScrollAt = now;
    wake();
    if (reducedMotion) return;
    if (speed > 1.25) {
      fastScrolling = true;
      root.dataset.scroll = 'fast';
      window.clearTimeout(moodSettleTimer);
    }
    diving = true;
    scrollDepth = depthOnPage();
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => { diving = false; readjustIdleAnchor(); }, 760);
    window.clearTimeout(scrollSettleTimer);
    scrollSettleTimer = window.setTimeout(() => {
      fastScrolling = false;
      root.dataset.scroll = 'settled';
      requestMood(activeSpreadMood);
    }, 480);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; wake(); }, { passive: true });
  window.addEventListener('keydown', wake, { passive: true });
  // Fish rush past -> the jellyfish flinches with a light ripple, then jets away from the school.
  let lastFlinch = 0;
  const fishReactionRange = 170;
  window.addEventListener('ascii-fish-rush', (e) => {
    if (reducedMotion) return;
    const fish = e.detail;
    if (!fish || !Number.isFinite(fish.x) || !Number.isFinite(fish.y)) return;
    const rect = root.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5, cy = rect.top + rect.height * 0.31;
    const fx = fish.x, fy = fish.y;
    if (Math.hypot(cx - fx, cy - fy) > fishReactionRange) return;
    const now = performance.now();
    if (now - lastFlinch < 3200) return;          // don't get jittery
    lastFlinch = now;
    let dx = cx - fx, dy = cy - fy;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    excite = 1;
    glow = 1;
    bellBloom = Math.max(bellBloom, 0.65);
    ruffle = Math.max(ruffle, 0.8);
    fan = Math.max(fan, 0.45);
    ripples.push({ age: 0 }, { age: -0.35 });
    dartVX = dx * 430;
    dartVY = dy * 430 - 70;                        // always a little upward, like a startled swim stroke
    nextTrick = Math.max(nextTrick, 2.6);          // let the flinch play out before the next trick
  });

  window.addEventListener('pointerdown', (e) => {
    wake();
    if (reducedMotion) return;
    const cx = currentX + W * SCALE * 0.5, cy = currentY + H * SCALE * 0.27;
    const dx = cx - e.clientX, dy = cy - e.clientY;
    if (Math.hypot(dx, dy) < 140 * SCALE) {
      const d = Math.hypot(dx, dy) || 1;
      excite = 1;
      dartVX = dx / d * 560; dartVY = dy / d * 560 - 120;
      glow = Math.max(glow, 0.7);
      ripples.push({ age: 0 });
      if (Math.random() < 0.45) randomTrick();
      nextTrick = 8;
    }
  }, { passive: true });
  window.addEventListener('resize', () => {
    currentX = clamp(currentX, 8, maxX());
    currentY = clamp(currentY, 26, maxY());
    readjustIdleAnchor();
  }, { passive: true });

  const initialDepth = depthOnPage();
  scrollDepth = initialDepth;
  diving = !reducedMotion && window.scrollY > 4;
  currentX = maxX() * 0.62;
  currentY = diving ? 48 + initialDepth * (maxY() - 48) : Math.max(26, window.innerHeight * 0.035);
  prevX = currentX; prevY = currentY;
  readjustIdleAnchor();
  const firstIntroProgress = introProgress(performance.now());
  const firstIntroOffset = arrivalIntro && !reducedMotion ? (1 - firstIntroProgress) * (window.innerWidth + W * SCALE) : 0;
  setPosition(currentX + firstIntroOffset, currentY, arrivalIntro && !reducedMotion ? 0.76 + 0.24 * firstIntroProgress : 1);
  if (arrivalIntro) showIntroNote();

  function animate(now) {
    const dt = lastTime ? Math.min(0.05, (now - lastTime) * 0.001) : 0.016;
    lastTime = now;

    update(dt);
    cornerClock += dt * (diving ? 0.26 : 0.22);

    let targetX, targetY, targetScale;
    if (diving) excite = Math.max(excite, 0.3);
    scrollDepth = depthOnPage();

    // A rounded four-corner circuit runs continuously; scrolling nudges it farther along.
    const route = (cornerClock + scrollDepth * 0.8) % 4;
    const leg = Math.floor(route);
    const phase = route - leg;
    const eased = smooth(0, 1, phase);
    const corners = [
      [8, 58],
      [maxX(), 58],
      [maxX(), maxY()],
      [8, maxY()]
    ];
    const from = corners[leg];
    const to = corners[(leg + 1) % corners.length];
    const arc = Math.sin(Math.PI * phase) * Math.min(30, window.innerWidth * 0.055);
    const arcSign = leg === 0 || leg === 2 ? -1 : 1;
    targetX = from[0] + (to[0] - from[0]) * eased + (to[0] === from[0] ? arc * arcSign : 0);
    targetY = from[1] + (to[1] - from[1]) * eased + (to[1] === from[1] ? arc * arcSign : 0);
    targetX = clamp(targetX, 8, maxX());
    targetY = clamp(targetY, 8, maxY());
    targetScale = 1;

    const follow = diving ? 1 - Math.exp(-dt * 1.8) : 1 - Math.exp(-dt * 1.65);
    currentX += (targetX - currentX) * follow + dartVX * dt;
    currentY += (targetY - currentY) * follow + dartVY * dt;
    const decay = Math.exp(-dt * 2.4);
    dartVX *= decay; dartVY *= decay;
    currentX = clamp(currentX, 8, maxX());
    currentY = clamp(currentY, 8, maxY());
    const intro = introProgress(now);
    const introOffset = arrivalIntro && !reducedMotion ? (1 - intro) * (window.innerWidth + W * SCALE) : 0;
    const introScale = arrivalIntro && !reducedMotion ? 0.76 + 0.24 * intro : targetScale;
    setPosition(currentX + introOffset, currentY, introScale);
    if (arrivalIntro && !introNote.hidden) positionIntroNote();
    refreshTextRects(now);

    // velocity (px/s) drives tentacle drag + body lean
    const vk = 1 - Math.exp(-dt * 5);
    dragX += ((currentX - prevX) / dt - dragX) * vk;
    dragY += ((currentY - prevY) / dt - dragY) * vk;
    prevX = currentX; prevY = currentY;

    if (now - lastDraw >= 1000 / 24) { draw(); lastDraw = now; }
    window.requestAnimationFrame(animate);
  }

  if (reducedMotion) {
    pulse = 0.3;
    setPosition(currentX, currentY, 1);
    if (arrivalIntro) positionIntroNote();
    refreshTextRects(performance.now());
    draw();
  } else {
    window.requestAnimationFrame(animate);
  }
})();
