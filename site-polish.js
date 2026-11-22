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

    const makeFloater = (kind, startAtBottom = false) => ({
      kind,
      x: random(0, Math.max(1, width)),
      y: startAtBottom ? height + random(4, 32) : random(0, Math.max(1, height)),
      radius: kind === 'bubble' ? random(1.3, 3.0) : random(.65, 1.55),
      alpha: kind === 'bubble' ? random(.055, .13) : random(.07, .19),
      rise: kind === 'bubble' ? random(7, 15) : random(1.5, 4.5),
      drift: random(2, 7),
      phase: random(0, Math.PI * 2),
      twinkle: random(.35, .95)
    });

    function resizeCanvas() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const targetDots = coarsePointer.matches ? 11 : 19;
      const targetBubbles = coarsePointer.matches ? 3 : 6;
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

      for (const particle of floaters) {
        particle.y -= particle.rise * dt;
        particle.x += Math.sin(elapsed * particle.twinkle + particle.phase) * particle.drift * dt;
        if (particle.y < -8) Object.assign(particle, makeFloater(particle.kind, true));
        if (particle.x < -6) particle.x = width + 5;
        if (particle.x > width + 6) particle.x = -5;
        const shimmer = .78 + .22 * Math.sin(elapsed * particle.twinkle + particle.phase);
        context.globalAlpha = particle.alpha * shimmer;
        context.lineWidth = .8;
        if (particle.kind === 'bubble') {
          context.strokeStyle = 'rgba(127,215,236,.78)';
          context.beginPath();
          context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
          context.stroke();
          context.fillStyle = 'rgba(218,250,255,.55)';
          context.fillRect(particle.x - particle.radius * .35, particle.y - particle.radius * .55, .8, .8);
        } else {
          context.fillStyle = 'rgba(131,221,241,.86)';
          context.beginPath();
          context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
          context.fill();
        }
      }

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
