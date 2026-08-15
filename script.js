(() => {
  'use strict';

  // ─── Configuration ───────────────────────────────────────────────────
  const FRAME_COUNT = 300;
  const FOLDER_PATH = 'New folder';
  const FILE_PREFIX = 'ezgif-frame-';
  const FILE_EXT = '.webp';
  const LERP_FACTOR = 0.06;
  const CONCURRENCY = 6;
  const LOOKAHEAD_WINDOW = 25; // Priority window around current scroll frame
  const EVICTION_DISTANCE = 40; // Unload frames beyond this distance to keep memory bounded

  // Title and button reveal timing (as fraction of total scroll 0–1)
  const MCAS_START = 0.45;       // MCAS begins to appear
  const MCAS_FULL = 0.58;        // MCAS fully visible
  const PRESENTS_START = 0.55;   // PRESENTS begins
  const PRESENTS_FULL = 0.65;    // PRESENTS fully visible
  const BUTTON_START = 0.66;     // NAME REVEAL button begins reveal
  const BUTTON_FULL = 0.76;      // NAME REVEAL button fully visible

  // ─── DOM Elements ────────────────────────────────────────────────────
  const canvas = document.getElementById('animationCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const loader = document.getElementById('loader');
  const loaderText = document.getElementById('loaderText');
  const loaderBar = document.getElementById('loaderBar');
  const titleMCAS = document.getElementById('titleMCAS');
  const titlePresents = document.getElementById('titlePresents');
  const btnNameReveal = document.getElementById('btnNameReveal');
  const transitionOverlay = document.getElementById('transitionOverlay');

  // ─── State ───────────────────────────────────────────────────────────
  const images = new Array(FRAME_COUNT);
  const loadedSet = new Set();
  const inFlightSet = new Set();
  let loadedCount = 0;
  let currentRenderedFrame = -1;
  let targetProgress = 0;
  let currentProgress = 0;
  let lastTimestamp = 0;
  let scrollDirection = 1;

  // ─── Frame URL builder ───────────────────────────────────────────────
  const getFrameUrl = (index) => {
    const frameNum = String(index).padStart(3, '0');
    return `${FOLDER_PATH}/${FILE_PREFIX}${frameNum}${FILE_EXT}`;
  };

  // ─── Easing helper ───────────────────────────────────────────────────
  const easeInOutCubic = (t) => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  const mapRange = (value, inMin, inMax) => {
    return Math.min(1, Math.max(0, (value - inMin) / (inMax - inMin)));
  };

  // ─── Canvas Resize (iOS Safari Memory Safe) ───────────────────────────
  const resizeCanvas = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (currentRenderedFrame >= 0 && images[currentRenderedFrame]) {
      drawFrame(currentRenderedFrame);
    }
  };

  // ─── Frame Eviction (Bounded Memory Management) ──────────────────────
  const evictDistantFrames = (currentFrame) => {
    for (const idx of loadedSet) {
      if (Math.abs(idx - currentFrame) > EVICTION_DISTANCE) {
        const item = images[idx];
        if (item && typeof item.close === 'function') {
          item.close();
        }
        images[idx] = null;
        loadedSet.delete(idx);
      }
    }
  };

  // ─── Draw Frame (Cover Mode with Memory Eviction) ────────────────────
  const drawFrame = (frameIndex) => {
    const img = images[frameIndex];
    if (!img) return;

    const imgW = img.naturalWidth || img.width || 1280;
    const imgH = img.naturalHeight || img.height || 720;
    if (imgW === 0 || imgH === 0) return;

    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const scale = Math.max(vpW / imgW, vpH / imgH);
    const drawW = Math.round(imgW * scale);
    const drawH = Math.round(imgH * scale);
    const x = Math.round((vpW - drawW) / 2);
    const y = Math.round((vpH - drawH) / 2);

    ctx.drawImage(img, 0, 0, imgW, imgH, x, y, drawW, drawH);
    currentRenderedFrame = frameIndex;

    // Unload distant frames to keep resident decoded memory strictly bounded
    evictDistantFrames(frameIndex);
  };

  // ─── Find Nearest Loaded Frame (Fallback for Smooth Scrubbing) ────────
  const findNearestLoaded = (frameIndex) => {
    if (loadedSet.has(frameIndex)) return frameIndex;
    for (let radius = 1; radius < FRAME_COUNT; radius++) {
      const ahead = frameIndex + radius * scrollDirection;
      const behind = frameIndex - radius * scrollDirection;
      if (ahead >= 0 && ahead < FRAME_COUNT && loadedSet.has(ahead)) return ahead;
      if (behind >= 0 && behind < FRAME_COUNT && loadedSet.has(behind)) return behind;
    }
    return -1;
  };

  // ─── Title & Button Animation ────────────────────────────────────────
  const updateTitleOverlay = (progress) => {
    // ── MCAS reveal ──
    if (titleMCAS) {
      const mcasRevealRaw = mapRange(progress, MCAS_START, MCAS_FULL);
      const mcasReveal = easeInOutCubic(mcasRevealRaw);

      if (mcasReveal <= 0) {
        titleMCAS.style.opacity = '0';
        titleMCAS.style.transform = 'scale(0.85) translateY(20px)';
        titleMCAS.style.filter = 'drop-shadow(0 0 30px rgba(212,175,55,0)) drop-shadow(0 2px 4px rgba(0,0,0,0))';
      } else {
        const scale = 0.85 + mcasReveal * 0.15;
        const translateY = 20 * (1 - mcasReveal);
        const glowAlpha = mcasReveal * 0.6;
        const shadowAlpha = mcasReveal * 0.7;

        titleMCAS.style.opacity = String(mcasReveal);
        titleMCAS.style.transform = `scale(${scale}) translateY(${translateY}px)`;
        titleMCAS.style.filter = `drop-shadow(0 0 ${30 + mcasReveal * 20}px rgba(212,175,55,${glowAlpha})) drop-shadow(0 3px 6px rgba(0,0,0,${shadowAlpha}))`;
      }
    }

    // ── PRESENTS reveal ──
    if (titlePresents) {
      const presRevealRaw = mapRange(progress, PRESENTS_START, PRESENTS_FULL);
      const presReveal = easeInOutCubic(presRevealRaw);

      if (presReveal <= 0) {
        titlePresents.style.opacity = '0';
        titlePresents.style.transform = 'translateY(12px)';
        titlePresents.style.filter = 'drop-shadow(0 0 15px rgba(212,175,55,0)) drop-shadow(0 1px 3px rgba(0,0,0,0))';
      } else {
        const translateY = 12 * (1 - presReveal);
        const glowAlpha = presReveal * 0.4;
        const shadowAlpha = presReveal * 0.5;

        titlePresents.style.opacity = String(presReveal);
        titlePresents.style.transform = `translateY(${translateY}px)`;
        titlePresents.style.filter = `drop-shadow(0 0 ${15 + presReveal * 10}px rgba(212,175,55,${glowAlpha})) drop-shadow(0 1px 3px rgba(0,0,0,${shadowAlpha}))`;
      }
    }

    // ── NAME REVEAL Button reveal ──
    if (btnNameReveal) {
      const btnRevealRaw = mapRange(progress, BUTTON_START, BUTTON_FULL);
      const btnReveal = easeInOutCubic(btnRevealRaw);

      if (btnReveal <= 0) {
        btnNameReveal.style.opacity = '0';
        btnNameReveal.style.transform = 'translateY(14px) scale(0.94)';
        btnNameReveal.style.filter = 'none';
        btnNameReveal.style.pointerEvents = 'none';
      } else {
        const translateY = 14 * (1 - btnReveal);
        const scale = 0.94 + btnReveal * 0.06;

        btnNameReveal.style.opacity = String(btnReveal);
        btnNameReveal.style.transform = `translateY(${translateY}px) scale(${scale})`;
        btnNameReveal.style.filter = 'none';
        btnNameReveal.style.pointerEvents = btnReveal > 0.7 ? 'auto' : 'none';
      }
    }
  };

  // ─── Page Navigation (instant, no transition/loading delay) ──────────
  window.cinematicNavigate = () => {
    window.location.href = 'name-reveal.html';
  };

  if (btnNameReveal) {
    btnNameReveal.addEventListener('click', (e) => {
      e.preventDefault();
      window.cinematicNavigate();
    });
  }

  // ─── Scroll Progress ─────────────────────────────────────────────────
  const updateScrollProgress = () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const newProgress = maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
    scrollDirection = newProgress >= targetProgress ? 1 : -1;
    targetProgress = newProgress;
  };

  // ─── Render Loop ─────────────────────────────────────────────────────
  const renderLoop = (timestamp) => {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
    lastTimestamp = timestamp;

    const smoothFactor = 1 - Math.pow(1 - LERP_FACTOR, dt * 60);
    const delta = targetProgress - currentProgress;
    currentProgress += delta * smoothFactor;

    if (Math.abs(delta) < 0.00005) {
      currentProgress = targetProgress;
    }

    const frameIndex = Math.min(
      FRAME_COUNT - 1,
      Math.max(0, Math.round(currentProgress * (FRAME_COUNT - 1)))
    );

    if (frameIndex !== currentRenderedFrame) {
      const targetFrame = findNearestLoaded(frameIndex);
      if (targetFrame !== -1 && targetFrame !== currentRenderedFrame) {
        drawFrame(targetFrame);
      }
    }

    updateTitleOverlay(currentProgress);
    requestAnimationFrame(renderLoop);
  };

  // ─── Instant Page Reveal (Non-blocking) ──────────────────────────────
  let pageRevealed = false;
  const revealPage = () => {
    if (pageRevealed) return;
    pageRevealed = true;
    if (loader) loader.classList.add('hidden');
    updateScrollProgress();
    currentProgress = targetProgress;
    const initialFrame = Math.min(
      FRAME_COUNT - 1,
      Math.max(0, Math.round(currentProgress * (FRAME_COUNT - 1)))
    );
    const frameToDraw = findNearestLoaded(initialFrame);
    if (frameToDraw !== -1) {
      drawFrame(frameToDraw);
    }
    updateTitleOverlay(currentProgress);
  };

  // ─── Single Frame Loader ─────────────────────────────────────────────
  const loadSingleFrame = (frameIdx) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        images[frameIdx] = img;
        loadedSet.add(frameIdx);
        loadedCount++;
        const percent = Math.floor((loadedCount / FRAME_COUNT) * 100);
        if (loaderText) loaderText.textContent = `${percent}%`;
        if (loaderBar) loaderBar.style.width = `${percent}%`;
        resolve(img);
      };
      img.onerror = () => {
        console.warn(`Failed to load: ${getFrameUrl(frameIdx + 1)}`);
        loadedSet.add(frameIdx); // Prevent endless retry loops
        reject();
      };
      img.src = getFrameUrl(frameIdx + 1);
    });
  };

  // Picks next candidate frame prioritizing scroll position & lookahead
  const pickNextCandidate = () => {
    const anchor = Math.min(
      FRAME_COUNT - 1,
      Math.max(0, Math.round(targetProgress * (FRAME_COUNT - 1)))
    );

    let best = -1;
    let bestDist = Infinity;

    // Search lookahead window first
    const minSearch = Math.max(0, anchor - LOOKAHEAD_WINDOW);
    const maxSearch = Math.min(FRAME_COUNT - 1, anchor + LOOKAHEAD_WINDOW);

    for (let idx = minSearch; idx <= maxSearch; idx++) {
      if (loadedSet.has(idx) || inFlightSet.has(idx)) continue;
      const dist = Math.abs(idx - anchor);
      if (dist < bestDist) {
        bestDist = dist;
        best = idx;
      }
    }

    // If local lookahead window is loaded, pick remaining frames closest to anchor
    if (best === -1) {
      for (let idx = 0; idx < FRAME_COUNT; idx++) {
        if (loadedSet.has(idx) || inFlightSet.has(idx)) continue;
        const dist = Math.abs(idx - anchor);
        if (dist < bestDist) {
          bestDist = dist;
          best = idx;
        }
      }
    }

    return best;
  };

  // ─── Idle-Scheduled Progressive Preloader (Non-competing) ────────────
  const scheduleIdleWork = typeof window.requestIdleCallback === 'function'
    ? (cb) => window.requestIdleCallback(cb, { timeout: 150 })
    : (cb) => setTimeout(cb, 20);

  const preloadImages = async () => {
    // Step 1: Preload initial active frame (or frame 0) to reveal instantly
    const initialAnchor = Math.min(
      FRAME_COUNT - 1,
      Math.max(0, Math.round(targetProgress * (FRAME_COUNT - 1)))
    );
    try {
      await loadSingleFrame(initialAnchor);
    } catch (e) {}
    revealPage();

    // Step 2: Spawn background worker streams scheduled during idle browser periods
    const runWorker = () => {
      scheduleIdleWork(async () => {
        const nextIdx = pickNextCandidate();
        if (nextIdx !== -1) {
          inFlightSet.add(nextIdx);
          try {
            await loadSingleFrame(nextIdx);
          } catch (e) {
          } finally {
            inFlightSet.delete(nextIdx);
          }
        }

        // Continue fetching on next idle period
        runWorker();
      });
    };

    for (let w = 0; w < CONCURRENCY; w++) {
      runWorker();
    }

    // Safety fallback: guaranteed reveal within 800ms
    setTimeout(revealPage, 800);
  };

  // ─── Events ──────────────────────────────────────────────────────────
  window.addEventListener('resize', resizeCanvas, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 100), { passive: true });
  window.addEventListener('scroll', updateScrollProgress, { passive: true });

  // ─── Init ────────────────────────────────────────────────────────────
  resizeCanvas();
  updateScrollProgress();
  updateTitleOverlay(0);
  preloadImages();
  requestAnimationFrame(renderLoop);
})();
