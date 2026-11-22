(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const parallaxQuery = window.matchMedia('(min-width: 760px) and (pointer: fine)');
  const layers = Array.from(document.querySelectorAll('.cut[data-speed], .art-inlay, .painting-bleed'));
  if (!parallaxQuery.matches || !layers.length) return;

  let frame = 0;
  const updateParallax = () => {
    frame = 0;
    if (!parallaxQuery.matches || document.hidden) return;

    const viewHeight = window.innerHeight;
    for (const layer of layers) {
      const rect = layer.getBoundingClientRect();
      if (rect.bottom < -100 || rect.top > viewHeight + 100) continue;

      const speedValue = Number.parseFloat(layer.dataset.speed);
      const speed = Number.isFinite(speedValue) && speedValue !== 0
        ? speedValue
        : (layer.classList.contains('art-inlay') ? 0.032 : 0.045);
      const midpoint = rect.top + rect.height * 0.5;
      const offset = clamp((viewHeight * 0.5 - midpoint) * speed * 1.6, -16, 16);
      layer.style.setProperty('--parallax-y', `${offset.toFixed(1)}px`);
    }
  };

  const scheduleParallax = () => {
    if (!frame) frame = window.requestAnimationFrame(updateParallax);
  };

  window.addEventListener('scroll', scheduleParallax, { passive: true });
  window.addEventListener('resize', scheduleParallax, { passive: true });
  document.addEventListener('visibilitychange', scheduleParallax);
  scheduleParallax();
})();
