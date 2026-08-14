(() => {
  // ─── Configuration ───────────────────────────────────────────────────
  const FRAME_COUNT = 300;
  const FOLDER_PATH = 'New folder';
  const FILE_PREFIX = 'ezgif-frame-';
  const FILE_EXT = '.jpg';
  const LERP_FACTOR = 0.06;

  // Title and button reveal timing (as fraction of total scroll 0–1)
  const MCAS_START = 0.45;       // MCAS begins to appear
  const MCAS_FULL = 0.58;        // MCAS fully visible
  const PRESENTS_START = 0.55;   // PRESENTS begins
  const PRESENTS_FULL = 0.65;    // PRESENTS fully visible
  const BUTTON_START = 0.66;     // NAME REVEAL button begins reveal
  const BUTTON_FULL = 0.76;      // NAME REVEAL button fully visible
  // No fade-out — titles and button stay permanently visible after reveal

  // ─── DOM Elements ────────────────────────────────────────────────────
  const canvas = document.getElementById('animationCanvas');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  const loader = document.getElementById('loader');
  const loaderText = document.getElementById('loaderText');
  const loaderBar = document.getElementById('loaderBar');
  const titleMCAS = document.getElementById('titleMCAS');
  const titlePresents = document.getElementById('titlePresents');
  const btnNameReveal = document.getElementById('btnNameReveal');
  const transitionOverlay = document.getElementById('transitionOverlay');

  // ─── State ───────────────────────────────────────────────────────────
  const images = [];
  let loadedCount = 0;
  let currentRenderedFrame = -1;
  let targetProgress = 0;
  let currentProgress = 0;
  let lastTimestamp = 0;

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

  // ─── Canvas Resize ───────────────────────────────────────────────────
  const resizeCanvas = () => {
    const dpr = window.devicePixelRatio || 1;
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

  // ─── Draw Frame (Cover Mode) ─────────────────────────────────────────
  const drawFrame = (frameIndex) => {
    const img = images[frameIndex];
    if (!img) return;

    const imgW = img.naturalWidth || img.width || 1920;
    const imgH = img.naturalHeight || img.height || 1080;
    if (imgW === 0 || imgH === 0) return;

    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const scale = Math.max(vpW / imgW, vpH / imgH);
    const drawW = Math.round(imgW * scale);
    const drawH = Math.round(imgH * scale);
    const x = Math.round((vpW - drawW) / 2);
    const y = Math.round((vpH - drawH) / 2);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, imgW, imgH, x, y, drawW, drawH);
    currentRenderedFrame = frameIndex;
  };

  // ─── Title & Button Animation ────────────────────────────────────────
  const updateTitleOverlay = (progress) => {
    // ── MCAS reveal (permanently visible once fully revealed) ──
    if (titleMCAS) {
      const mcasRevealRaw = mapRange(progress, MCAS_START, MCAS_FULL);
      const mcasReveal = easeInOutCubic(mcasRevealRaw);

      if (mcasReveal <= 0) {
        titleMCAS.style.opacity = '0';
        titleMCAS.style.transform = 'scale(0.85) translateY(20px)';
        titleMCAS.style.filter = 'drop-shadow(0 0 30px rgba(212,175,55,0)) drop-shadow(0 2px 4px rgba(0,0,0,0)) blur(8px)';
      } else {
        const scale = 0.85 + mcasReveal * 0.15;
        const translateY = 20 * (1 - mcasReveal);
        const blur = 8 * (1 - mcasReveal);
        const glowAlpha = mcasReveal * 0.6;
        const shadowAlpha = mcasReveal * 0.7;

        titleMCAS.style.opacity = String(mcasReveal);
        titleMCAS.style.transform = `scale(${scale}) translateY(${translateY}px)`;
        titleMCAS.style.filter = `drop-shadow(0 0 ${30 + mcasReveal * 20}px rgba(212,175,55,${glowAlpha})) drop-shadow(0 3px 6px rgba(0,0,0,${shadowAlpha})) blur(${blur}px)`;
      }
    }

    // ── PRESENTS reveal (permanently visible once fully revealed) ──
    if (titlePresents) {
      const presRevealRaw = mapRange(progress, PRESENTS_START, PRESENTS_FULL);
      const presReveal = easeInOutCubic(presRevealRaw);

      if (presReveal <= 0) {
        titlePresents.style.opacity = '0';
        titlePresents.style.transform = 'translateY(12px)';
        titlePresents.style.filter = 'drop-shadow(0 0 15px rgba(212,175,55,0)) drop-shadow(0 1px 3px rgba(0,0,0,0)) blur(6px)';
      } else {
        const translateY = 12 * (1 - presReveal);
        const blur = 6 * (1 - presReveal);
        const glowAlpha = presReveal * 0.4;
        const shadowAlpha = presReveal * 0.5;

        titlePresents.style.opacity = String(presReveal);
        titlePresents.style.transform = `translateY(${translateY}px)`;
        titlePresents.style.filter = `drop-shadow(0 0 ${15 + presReveal * 10}px rgba(212,175,55,${glowAlpha})) drop-shadow(0 1px 3px rgba(0,0,0,${shadowAlpha})) blur(${blur}px)`;
      }
    }

    // ── NAME REVEAL Button reveal (naturally follows MCAS PRESENTS) ──
    if (btnNameReveal) {
      const btnRevealRaw = mapRange(progress, BUTTON_START, BUTTON_FULL);
      const btnReveal = easeInOutCubic(btnRevealRaw);

      if (btnReveal <= 0) {
        btnNameReveal.style.opacity = '0';
        btnNameReveal.style.transform = 'translateY(14px) scale(0.94)';
        btnNameReveal.style.filter = 'blur(4px)';
        btnNameReveal.style.pointerEvents = 'none';
      } else {
        const translateY = 14 * (1 - btnReveal);
        const scale = 0.94 + btnReveal * 0.06;
        const blur = 4 * (1 - btnReveal);

        btnNameReveal.style.opacity = String(btnReveal);
        btnNameReveal.style.transform = `translateY(${translateY}px) scale(${scale})`;
        btnNameReveal.style.filter = `blur(${blur}px)`;
        btnNameReveal.style.pointerEvents = btnReveal > 0.7 ? 'auto' : 'none';
      }
    }
  };

  // ─── Cinematic Page Navigation ───────────────────────────────────────
  window.cinematicNavigate = () => {
    if (transitionOverlay) {
      transitionOverlay.classList.add('active');
    }
    setTimeout(() => {
      window.location.href = 'name-reveal.html';
    }, 700);
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
    if (maxScroll > 0) {
      targetProgress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
    } else {
      targetProgress = 0;
    }
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
      drawFrame(frameIndex);
    }

    updateTitleOverlay(currentProgress);
    requestAnimationFrame(renderLoop);
  };

  // ─── Image Preloader ─────────────────────────────────────────────────
  const preloadImages = async () => {
    const promises = [];

    for (let i = 1; i <= FRAME_COUNT; i++) {
      const p = new Promise((resolve) => {
        const img = new Image();
        const frameIdx = i - 1;

        img.onload = async () => {
          try {
            const bitmap = await createImageBitmap(img, {
              imageOrientation: 'none',
              premultiplyAlpha: 'none',
              colorSpaceConversion: 'default',
              resizeQuality: 'high'
            });
            images[frameIdx] = bitmap;
          } catch (e) {
            images[frameIdx] = img;
          }

          loadedCount++;
          const percent = Math.floor((loadedCount / FRAME_COUNT) * 100);
          if (loaderText) loaderText.textContent = `${percent}%`;
          if (loaderBar) loaderBar.style.width = `${percent}%`;

          if (frameIdx === 0 && currentRenderedFrame === -1) {
            drawFrame(0);
          }
          resolve();
        };

        img.onerror = () => {
          console.warn(`Failed to load frame: ${getFrameUrl(i)}`);
          loadedCount++;
          resolve();
        };

        img.src = getFrameUrl(i);
      });

      promises.push(p);
    }

    await Promise.all(promises);
    onAllImagesLoaded();
  };

  // ─── Post-Load ───────────────────────────────────────────────────────
  const onAllImagesLoaded = () => {
    setTimeout(() => {
      if (loader) loader.classList.add('hidden');
      updateScrollProgress();
      currentProgress = targetProgress;
      const initialFrame = Math.min(
        FRAME_COUNT - 1,
        Math.max(0, Math.round(currentProgress * (FRAME_COUNT - 1)))
      );
      drawFrame(initialFrame);
      updateTitleOverlay(currentProgress);
    }, 150);
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
