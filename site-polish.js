(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return;

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const random = (low, high) => low + Math.random() * (high - low);
  const coarsePointer = window.matchMedia('(pointer: coarse)');
  const canvas = document.createElement('canvas');
  canvas.id = 'siteAtmosphere';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('role', 'presentation');
  document.body.prepend(canvas);

  const context = canvas.getContext('2d', { alpha: true });
  if (context) {
    let width = 0;
    let height = 0;
    let dpr = 1;
    let lastFrame = 0;
    let frameHandle = 0;
    let timeoutHandle = 0;
    let elapsed = 0;
    const floaters = [];
    const sparks = [];
    const tapRings = [];
    const maxSparks = 42;
    let lastPointer = { x: -100, y: -100, at: 0 };

    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    const planktonHues = [188, 188, 176, 200, 168, 292];
    const BUBBLE_GLYPHS = ['o', 'o', 'O', '.'];
    const PLANKTON_GLYPHS = ['.', '.', '*', '+', ':'];

    // Particles live in the PAGE, not on the glass: bubbles drift up the page and scroll away with it
    // (factor 1), plankton sit a little deeper and scroll more slowly (factor .45).
    const makeFloater = (kind, startAtBottom = false) => {
      const factor = kind === 'bubble' ? 1 : .45;
      const screenY = startAtBottom ? height + random(10, height * .55) : random(0, height);
      return {
        kind, factor,
        glyph: pick(kind === 'bubble' ? BUBBLE_GLYPHS : PLANKTON_GLYPHS),
        hue: pick(planktonHues),
        size: kind === 'bubble' ? random(10, 17) : random(8, 12),
        x: random(0, Math.max(1, width)),
        y: screenY + (window.scrollY || 0) * factor,
        alpha: kind === 'bubble' ? random(.45, .75) : random(.55, 1),
        rise: kind === 'bubble' ? random(16, 30) : random(3, 8),
        drift: random(3, 9),
        phase: random(0, Math.PI * 2),
        twinkle: random(.5, 1.3)
      };
    };

    function resizeCanvas() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const targetDots = coarsePointer.matches ? 14 : 26;
      const targetBubbles = coarsePointer.matches ? 2 : 4;
      floaters.length = 0;
      for (let i = 0; i < targetDots; i++) floaters.push(makeFloater('plankton'));
      for (let i = 0; i < targetBubbles; i++) floaters.push(makeFloater('bubble'));
    }

    function addSpark(x, y, vx = random(-9, 9), vy = random(-28, -10)) {
      if (sparks.length >= maxSparks) sparks.shift();
      sparks.push({ x, y, vx, vy, age: 0, life: random(.48, .78), radius: random(.8, 1.8), hue: random(188, 204) });
    }

    function addTapSparkle(x, y) {
      for (let i = 0; i < 7; i++) {
        const angle = (Math.PI * 2 * i) / 7 + random(-.14, .14);
        const speed = random(17, 39);
        addSpark(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed);
      }
      tapRings.push({ x, y, age: 0, life: .48 });
      if (tapRings.length > 8) tapRings.shift();
    }

    function scheduleFrame() {
      if (frameHandle || timeoutHandle || document.hidden) return;
      timeoutHandle = window.setTimeout(() => {
        timeoutHandle = 0;
        frameHandle = window.requestAnimationFrame(drawFrame);
      }, 1000 / 30);
    }

    function drawFrame(now) {
      frameHandle = 0;
      if (document.hidden) return;
      const dt = lastFrame ? Math.min(.05, (now - lastFrame) / 1000) : 1 / 30;
      lastFrame = now;
      elapsed += dt;
      context.clearRect(0, 0, width, height);

      const scrollY = window.scrollY || 0;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      for (const particle of floaters) {
        particle.y -= particle.rise * dt;
        particle.x += Math.sin(elapsed * particle.twinkle + particle.phase) * particle.drift * dt;
        const screenY = particle.y - scrollY * particle.factor;
        // floated off the top (or scrolled far past): respawn below the fold, staggered
        if (screenY < -24 || screenY > height * 1.6 + 80) { Object.assign(particle, makeFloater(particle.kind, true)); continue; }
        if (screenY > height + 20) continue;           // still waiting below the screen
        if (particle.x < -6) particle.x = width + 5;
        if (particle.x > width + 6) particle.x = -5;
        const shimmer = .78 + .22 * Math.sin(elapsed * particle.twinkle + particle.phase);
        context.globalAlpha = particle.alpha * shimmer;
        context.font = `600 ${particle.size.toFixed(1)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
        if (particle.kind === 'bubble') {
          context.shadowBlur = 0;
          context.fillStyle = 'rgb(170,232,247)';
        } else {
          context.shadowColor = `hsla(${particle.hue}, 100%, 65%, .9)`;
          context.shadowBlur = 6;
          context.fillStyle = `hsl(${particle.hue} 100% 80%)`;
        }
        context.fillText(particle.glyph, particle.x, screenY);
      }
      context.shadowBlur = 0;

      for (let i = sparks.length - 1; i >= 0; i--) {
        const spark = sparks[i];
        spark.age += dt;
        if (spark.age >= spark.life) { sparks.splice(i, 1); continue; }
        spark.x += spark.vx * dt;
        spark.y += spark.vy * dt;
        spark.vx *= Math.exp(-dt * 1.6);
        spark.vy += 7 * dt;
        const fade = 1 - spark.age / spark.life;
        context.globalAlpha = fade * .68;
        context.fillStyle = `hsl(${spark.hue.toFixed(0)} 94% 76%)`;
        context.beginPath();
        context.arc(spark.x, spark.y, spark.radius * (.7 + fade * .35), 0, Math.PI * 2);
        context.fill();
      }

      for (let i = tapRings.length - 1; i >= 0; i--) {
        const ring = tapRings[i];
        ring.age += dt;
        if (ring.age >= ring.life) { tapRings.splice(i, 1); continue; }
        const progress = ring.age / ring.life;
        context.globalAlpha = (1 - progress) * .38;
        context.strokeStyle = 'rgba(133,224,243,.92)';
        context.lineWidth = 1;
        context.beginPath();
        context.arc(ring.x, ring.y, 4 + progress * 19, 0, Math.PI * 2);
        context.stroke();
      }
      context.globalAlpha = 1;
      scheduleFrame();
    }

    function resume() {
      scheduleFrame();
    }
    function pause() {
      if (timeoutHandle) window.clearTimeout(timeoutHandle);
      if (frameHandle) window.cancelAnimationFrame(frameHandle);
      timeoutHandle = 0;
      frameHandle = 0;
      lastFrame = 0;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });
    document.addEventListener('visibilitychange', () => document.hidden ? pause() : resume());
    if (!coarsePointer.matches) {
      window.addEventListener('pointermove', event => {
        if (event.pointerType === 'touch') return;
        const now = performance.now();
        const distance = Math.hypot(event.clientX - lastPointer.x, event.clientY - lastPointer.y);
        if (distance < 14 || now - lastPointer.at < 28) return;
        lastPointer = { x: event.clientX, y: event.clientY, at: now };
        addSpark(event.clientX, event.clientY);
      }, { passive: true });
    }
    window.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch' || coarsePointer.matches) addTapSparkle(event.clientX, event.clientY);
    }, { passive: true });
    resume();
  }

  const parallaxQuery = window.matchMedia('(min-width: 760px) and (pointer: fine)');
  const layers = Array.from(document.querySelectorAll('.cut[data-speed], .art-inlay, .painting-bleed'));
  if (parallaxQuery.matches && layers.length) {
    let parallaxFrame = 0;
    const updateParallax = () => {
      parallaxFrame = 0;
      if (!parallaxQuery.matches || document.hidden) return;
      const viewHeight = window.innerHeight;
      for (const layer of layers) {
        const rect = layer.getBoundingClientRect();
        if (rect.bottom < -100 || rect.top > viewHeight + 100) continue;
        const speedValue = Number.parseFloat(layer.dataset.speed);
        const speed = Number.isFinite(speedValue) && speedValue !== 0
          ? speedValue
          : (layer.classList.contains('art-inlay') ? .032 : .045);
        const midpoint = rect.top + rect.height * .5;
        const offset = clamp((viewHeight * .5 - midpoint) * speed * 1.6, -16, 16);
        layer.style.setProperty('--parallax-y', `${offset.toFixed(1)}px`);
      }
    };
    const scheduleParallax = () => {
      if (!parallaxFrame) parallaxFrame = window.requestAnimationFrame(updateParallax);
    };
    window.addEventListener('scroll', scheduleParallax, { passive: true });
    window.addEventListener('resize', scheduleParallax, { passive: true });
    document.addEventListener('visibilitychange', scheduleParallax);
    scheduleParallax();
  }
})();


/* ---------- ASCII record + level meter for the music button ---------- */
(() => {
  const button = document.getElementById('musicToggle');
  const record = button && button.querySelector('.ascii-record');
  const meter = button && button.querySelector('.ascii-meter');
  if (!record) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLS = 9, ROWS = 5, CW = 5.1, CH = 8, RADIUS = 21;
  const GROOVE = ' .,:;-=+*';
  const RIM = [')', "'", '_', "'", '(', '.', '-', '.'];      // right, bottom-right, bottom, ... top-right
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = (c + .5) * CW - COLS * CW / 2, y = (r + .5) * CH - ROWS * CH / 2;
      cells.push({ x, y, d: Math.hypot(x, y), theta: Math.atan2(y, x) });
    }
  }
  const draw = (angle) => {
    let out = '';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = cells[r * COLS + c];
        if (cell.d > RADIUS + 1) out += ' ';
        else if (cell.d < 7.5) out += cell.x < -2 ? '<span class="label">(</span>' : cell.x > 2 ? '<span class="label">)</span>' : '<span class="label">o</span>';
        else if (cell.d > RADIUS - 6) out += RIM[(Math.round(cell.theta / (Math.PI / 4)) + 8) % 8];
        else {
          const sheen = .5 + .5 * Math.cos(2 * (cell.theta - angle));       // two opposite light streaks, like real vinyl
          out += GROOVE[Math.min(GROOVE.length - 1, Math.floor(sheen * GROOVE.length))];
        }
      }
      out += r < ROWS - 1 ? '\n' : '';
    }
    record.innerHTML = out;
  };
  let angle = .6, level = 3, timer = 0;
  const drawMeter = (on) => {
    if (!meter) return;
    const l = on ? level : 0;
    meter.textContent = '[' + '#'.repeat(l) + '.'.repeat(6 - l) + ']';
  };
  const tick = () => {
    angle += .5;
    level = Math.max(1, Math.min(6, level + Math.floor(Math.random() * 3) - 1));
    draw(angle);
    drawMeter(true);
  };
  const sync = () => {
    const playing = button.classList.contains('is-playing');
    if (timer) { window.clearInterval(timer); timer = 0; }
    if (playing && !reduced) timer = window.setInterval(tick, 95);
    drawMeter(playing);
    if (!playing || reduced) draw(angle);
  };
  new MutationObserver(sync).observe(button, { attributes: true, attributeFilter: ['class'] });
  sync();
})();
