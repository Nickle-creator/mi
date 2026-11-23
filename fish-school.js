(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ------------------------------------------------------------------
     ASCII fish schools — every fish rolls its own:
       • colour   (full-spectrum hue, saturation, lightness, per-letter gradient)
       • size     (tiny minnows up to big slow cruisers)
       • glow     (steady / pulse / flicker / sweep / eye-lure / neon)
  ------------------------------------------------------------------- */

  const species = [
    { frames: [['  /\\   ', '<((o))>', '  \\/   '], ['  ><   ', '<((o))>', '  ><   ']] },
    { frames: [[' .---. ', '<( o )>', ' `---\' '], ['  ><   ', '<( o )>', '  ><   ']] },
    { frames: [['><(((o>'], ['><((o)>']] },
    { frames: [['  /\\  ', '><(O)>', '  \\/  '], ['  ><  ', '><(O)>', '  ><  ']] },
    { frames: [['  .-^^-. ', '<{{(o)}}>', '  `-vv-\' '], ['   ><   ', '<{{(o)}}>', '   ><   ']] },
    // new shapes for extra variety
    { frames: [['><>'], ['><>']] },
    { frames: [['<o)))><'], ['<o))><']] },
    { frames: [[' _/\\_  ', '<(@_@)>', '  \\/   '], [' _><_  ', '<(@_@)>', '  ><   ']] },
    { frames: [['  ,-~~-, ', '<{ (O) }>', "  `-~~-' "], ['   ~~~~  ', '<{ (O) }>', '   ~~~~  ']] }
  ];

  const GLOW_MODES = ['steady', 'pulse', 'flicker', 'sweep', 'eye', 'neon'];
  const EYES = 'oO@0';

  const canvas = document.createElement('canvas');
  canvas.id = 'asciiFishSchool';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100vw', height: '100vh',
    zIndex: '1', pointerEvents: 'none', userSelect: 'none',
    overflow: 'hidden'
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) { canvas.remove(); return; }

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const random = (min, max) => min + Math.random() * (max - min);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  let width = 0, height = 0, dpr = 1;
  let schools = [];
  let lastFrame = 0;
  let nextSchoolAt = performance.now() + random(800, 1600);
  let lastScareAt = 0;
  let frameHandle = 0;
  let canvasHasInk = false;
  const frameInterval = 1000 / 30;
  const jellyReactionRange = 170;
  const NIGHT_COLORS = [[232, 199, 102], [145, 202, 209]];
  const PAPER_COLORS = [[41, 32, 27], [44, 74, 134]];
  let paper = document.documentElement.dataset.theme === 'night' ? 0 : 1;   // 0 = night, 1 = paper (eased)
  let textRects = [], lastTextScan = -Infinity;

  function colorForFish(fish) {
    const paletteIndex = fish.look.paletteIndex;
    const night = NIGHT_COLORS[paletteIndex], paperColor = PAPER_COLORS[paletteIndex];
    const rgb = night.map((value, i) => Math.round(value + (paperColor[i] - value) * paper));
    return { rgb, css: `rgb(${rgb.join(', ')})` };
  }

  function refreshTextRects(now) {
    if (now - lastTextScan < 240) return;
    lastTextScan = now;
    const next = [];
    const range = document.createRange();
    document.querySelectorAll('h1,h2,h3,h4,p,li,a,figcaption,blockquote,dt,dd,label,small,caption,td,th').forEach((el) => {
      if (el.closest('.mast') || !el.textContent.trim()) return;
      if (el.closest('.js .reveal:not(.in)')) return;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.1) return;
      range.selectNodeContents(el);
      for (const rect of range.getClientRects()) {
        if (rect.width > 0 && rect.height > 0) next.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
      }
    });
    textRects = next;
  }

  function overlapsText(left, top, right, bottom) {
    return textRects.some((rect) => left < rect.right && right > rect.left && top < rect.bottom && bottom > rect.top);
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvasHasInk = false;
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  function shuffledSpecies() {
    return species.map((_, i) => i).sort(() => Math.random() - 0.5);
  }

  // size: log-uniform so there are plenty of small fish and a few big ones
  function rollSize() {
    return Math.exp(random(Math.log(0.5), Math.log(2.0)));
  }

  function rollLook(size, paletteIndex = 0) {
    const mode = pick(GLOW_MODES);
    return {
      paletteIndex,
      sat: random(72, 100),
      baseL: mode === 'neon' ? random(70, 82) : random(56, 74),
      glowMode: mode,
      glowBlur: random(3, 15) * Math.sqrt(size),
      glowAlpha: random(0.55, 1),
      glowSpeed: random(1.6, 5.5),
      glowDepth: random(0.35, 1),
      bodyAlpha: random(0.62, 1) * (size > 1.5 ? 0.88 : 1)
    };
  }

  function spawnSchool(now) {
    const direction = Math.random() < 0.5 ? 1 : -1;
    const count = 3 + Math.floor(Math.random() * 4);
    const accentFish = Math.floor(Math.random() * count);
    const speciesOrder = shuffledSpecies();
    const lane = random(Math.max(110, height * 0.14), Math.max(160, height * 0.86));
    const spread = random(19, 34);
    const baseSpeed = random(650, 1040);
    const school = { fishes: [], direction, startleSent: false };

    for (let i = 0; i < count; i++) {
      const type = species[speciesOrder[i % speciesOrder.length]];
      const size = rollSize();
      const delay = i * random(0.035, 0.105);
      const x = direction > 0
        ? -random(44, 120) - i * 24 * size
        : width + random(44, 120) + i * 24 * size;
      // big fish cruise a little slower, small ones dart
      const speed = baseSpeed * random(0.87, 1.16) * (1.12 - 0.22 * clamp((size - 0.5) / 1.5, 0, 1));
      school.fishes.push({
        type, direction, size, speed,
        look: rollLook(size, i === accentFish ? 1 : 0),
        x, y: lane + (i - (count - 1) / 2) * spread + random(-9, 9),
        phase: random(0, Math.PI * 2),
        seed: random(0, 100),
        bornAt: now + delay * 1000,
        width: Math.max(...type.frames[0].map(row => row.length)) * 8 * size
      });
    }
    schools.push(school);
    nextSchoolAt = now + random(2200, 3700);
  }

  function jellyCenter() {
    const root = document.getElementById('asciiJellyfish');
    if (!root) return null;
    const rect = root.getBoundingClientRect();
    return { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.31 };
  }

  // returns brightness boost (-1..1) and blur multiplier for one letter
  function glowAt(look, age, col, cols, isEye) {
    const t = age * look.glowSpeed;
    switch (look.glowMode) {
      case 'pulse': {
        const p = 0.5 + 0.5 * Math.sin(t);
        return { lift: (p - 0.5) * 0.5 * look.glowDepth, blur: 0.4 + 1.2 * p, alpha: 0.7 + 0.3 * p };
      }
      case 'flicker': {
        const f = Math.sin(t * 3.1 + col * 1.9) * Math.sin(t * 1.7 + col * 0.6);
        const on = f > 0.15 ? 1 : 0.2;
        return { lift: (on - 0.5) * 0.4 * look.glowDepth, blur: 0.3 + 1.3 * on, alpha: 0.65 + 0.35 * on };
      }
      case 'sweep': {
        const head = ((t * 0.28) % 1.6) * (cols + 2) - 1;
        const d = Math.abs(col - head);
        const band = Math.exp(-d * d / 2.2);
        return { lift: band * 0.35 * look.glowDepth, blur: 0.35 + 2.0 * band, alpha: 0.6 + 0.4 * band };
      }
      case 'eye': {
        const p = 0.5 + 0.5 * Math.sin(t);
        return isEye
          ? { lift: 0.3, blur: 2.4 + 1.4 * p, alpha: 1 }
          : { lift: -0.18, blur: 0, alpha: 0.5 };
      }
      case 'neon':
        return { lift: 0.12 + 0.06 * Math.sin(t * 0.6), blur: 2.2, alpha: 1 };
      default:
        return { lift: 0, blur: 1, alpha: 0.9 };
    }
  }

  function drawFish(fish, now) {
    if (now < fish.bornAt) return;
    const look = fish.look;
    const age = (now - fish.bornAt) * 0.001;
    const swimY = fish.y + Math.sin(age * 8.8 + fish.phase) * 4.5 * fish.size;
    const frames = fish.type.frames;
    const frameIndex = Math.floor((now + fish.seed * 37) / frameRate(fish.seed)) & 1;
    const rows = frames[Math.min(frameIndex, frames.length - 1)];
    const fontSize = 10.5 * fish.size;
    const lineHeight = fontSize * 1.08;
    const tilt = Math.sin(age * 5.4 + fish.phase) * 0.045;
    const cols = Math.max(...rows.map(r => r.length));

    ctx.save();
    ctx.translate(fish.x, swimY);
    if (fish.direction < 0) ctx.scale(-1, 1);
    ctx.rotate(tilt);
    ctx.font = `600 ${fontSize.toFixed(1)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const top = -((rows.length - 1) * lineHeight) / 2;
    const color = colorForFish(fish);
    const boxTop = swimY + top - lineHeight / 2 - 7;
    const boxBottom = swimY + top + (rows.length - 1) * lineHeight + lineHeight / 2 + 7;
    const overText = overlapsText(fish.x - 7, boxTop, fish.x + fish.width + 7, boxBottom);

    rows.forEach((row, rowIndex) => {
      const y = top + rowIndex * lineHeight;
      for (let col = 0; col < row.length; col++) {
        const glyph = row[col];
        if (glyph === ' ') continue;
        const g = glowAt(look, age, col, cols, EYES.includes(glyph));
        const shimmer = 5 * Math.sin(age * 4 + col * 0.7 + rowIndex);
        const nightL = clamp(look.baseL + shimmer + g.lift * 45, 40, 94) * 0.86;
        const paperL = clamp(nightL * 0.52, 20, 44);
        const brightness = (nightL / 60) + (paperL / 30 - nightL / 60) * paper;
        ctx.fillStyle = color.css;
        ctx.globalAlpha = clamp((look.bodyAlpha * g.alpha + 0.2 * paper) * brightness, 0.25, 1) * (overText ? 0.35 : 1);
        if (g.blur > 0.05 && paper < 0.6) {
          ctx.shadowColor = `rgba(${color.rgb.join(', ')}, ${(look.glowAlpha * g.alpha * (1 - paper)).toFixed(2)})`;
          ctx.shadowBlur = look.glowBlur * g.blur * (1 - paper);
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fillText(glyph, col * fontSize * 0.61, y);
      }
    });
    ctx.restore();
  }

  function frameRate(seed) { return 95 + (seed % 5) * 20; }

  function animate(now) {
    frameHandle = 0;
    if (document.hidden) {
      lastFrame = 0;
      frameHandle = requestAnimationFrame(animate);
      return;
    }
    if (lastFrame && now - lastFrame < frameInterval) {
      frameHandle = requestAnimationFrame(animate);
      return;
    }
    const dt = lastFrame ? Math.min(0.05, (now - lastFrame) * 0.001) : 0.016;
    lastFrame = now;
    const paperTarget = document.documentElement.dataset.theme === 'night' ? 0 : 1;
    paper += (paperTarget - paper) * Math.min(1, dt * 4);
    if (Math.abs(paperTarget - paper) < 0.005) paper = paperTarget;
    if (now >= nextSchoolAt && schools.reduce((n, school) => n + school.fishes.length, 0) < 24) {
      spawnSchool(now);
    }

    if (schools.length || canvasHasInk) ctx.clearRect(0, 0, width, height);
    let drewFish = false;
    if (schools.length) refreshTextRects(now);
    const jelly = jellyCenter();
    for (let s = schools.length - 1; s >= 0; s--) {
      const school = schools[s];
      for (let i = school.fishes.length - 1; i >= 0; i--) {
        const fish = school.fishes[i];
        if (now < fish.bornAt) continue;
        fish.x += fish.direction * fish.speed * dt;
        const centerX = fish.x + fish.direction * fish.width * 0.5;
        const centerY = fish.y + Math.sin((now - fish.bornAt) * 0.0088 + fish.phase) * 4.5;

        if (jelly && !school.startleSent && now - lastScareAt > 1250 &&
            Math.hypot(jelly.x - centerX, jelly.y - centerY) < jellyReactionRange) {
          school.startleSent = true;
          lastScareAt = now;
          window.dispatchEvent(new CustomEvent('ascii-fish-rush', {
            detail: { x: centerX, y: centerY, direction: fish.direction, speed: fish.speed }
          }));
        }

        drawFish(fish, now);
        drewFish = true;
        const offscreen = fish.direction > 0 ? fish.x > width + fish.width + 90 : fish.x < -fish.width - 90;
        if (offscreen) school.fishes.splice(i, 1);
      }
      if (!school.fishes.length) schools.splice(s, 1);
    }

    canvasHasInk = drewFish;
    if (!frameHandle) frameHandle = requestAnimationFrame(animate);
  }

  frameHandle = requestAnimationFrame(animate);
})();
