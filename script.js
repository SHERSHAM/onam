(() => {
  // ─── Configuration ───────────────────────────────────────────────────
  const FRAME_COUNT = 300;
  const FOLDER_PATH = 'New folder';
  const FILE_PREFIX = 'ezgif-frame-';
  const FILE_EXT = '.jpg';

  // Smooth interpolation: lower = smoother cinematic glide
  // 0.06 gives ultra-smooth premium momentum with natural deceleration
  const LERP_FACTOR = 0.06;

  // ─── DOM Elements ────────────────────────────────────────────────────
  const canvas = document.getElementById('animationCanvas');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  const loader = document.getElementById('loader');
  const loaderText = document.getElementById('loaderText');
  const loaderBar = document.getElementById('loaderBar');

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

  // ─── Canvas Resize (Full Native DPI) ─────────────────────────────────
  // Uses the FULL device pixel ratio (no capping) for maximum sharpness.
  // On a 2x Retina display, the canvas pixel buffer is 2× the CSS size,
  // delivering razor-sharp rendering without any browser upscaling blur.
  const resizeCanvas = () => {
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Internal pixel buffer at full native resolution
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    // CSS display size matches viewport
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    // Reset transform for fresh DPR scaling
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // High-quality bicubic interpolation for upscaled frames
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Re-draw current frame at new resolution
    if (currentRenderedFrame >= 0 && images[currentRenderedFrame]) {
      drawFrame(currentRenderedFrame);
    }
  };

  // ─── Draw Frame (Cover Mode, Full Viewport) ──────────────────────────
  // COVER scaling fills the entire viewport edge-to-edge with no black bars.
  // The frame is centered so the MCAS PRESENTS composition stays visible.
  const drawFrame = (frameIndex) => {
    const img = images[frameIndex];
    if (!img) return;

    const imgW = img.naturalWidth || img.width || 1920;
    const imgH = img.naturalHeight || img.height || 1080;
    if (imgW === 0 || imgH === 0) return;

    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    // Cover: always fill the viewport completely
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

  // ─── Scroll Progress Tracker ─────────────────────────────────────────
  const updateScrollProgress = () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll > 0) {
      targetProgress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
    } else {
      targetProgress = 0;
    }
  };

  // ─── Animation Render Loop (Frame-Rate Independent Lerp) ─────────────
  // Uses delta-time interpolation so scrolling feels identical at 60fps,
  // 120fps, or any refresh rate. Produces ultra-smooth cinematic motion.
  const renderLoop = (timestamp) => {
    // Calculate delta time for frame-rate independent smoothing
    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1); // cap at 100ms
    lastTimestamp = timestamp;

    // Frame-rate independent exponential interpolation
    // At 60fps: factor ≈ 0.06 * 60 * 0.0167 = ~0.06 per frame
    // At 120fps: factor ≈ 0.06 * 120 * 0.0083 = ~0.06 per frame (same feel)
    const smoothFactor = 1 - Math.pow(1 - LERP_FACTOR, dt * 60);
    const delta = targetProgress - currentProgress;
    currentProgress += delta * smoothFactor;

    // Snap to target when very close (prevents infinite micro-drift)
    if (Math.abs(delta) < 0.00005) {
      currentProgress = targetProgress;
    }

    // Map smoothed progress to frame index
    const frameIndex = Math.min(
      FRAME_COUNT - 1,
      Math.max(0, Math.round(currentProgress * (FRAME_COUNT - 1)))
    );

    // Only repaint when the frame actually changes
    if (frameIndex !== currentRenderedFrame) {
      drawFrame(frameIndex);
    }

    requestAnimationFrame(renderLoop);
  };

  // ─── Image Preloader (GPU ImageBitmap + High Quality) ─────────────────
  // Converts each JPEG frame to a GPU-resident ImageBitmap with high-quality
  // color space conversion for the sharpest possible canvas rendering.
  const preloadImages = async () => {
    const promises = [];

    for (let i = 1; i <= FRAME_COUNT; i++) {
      const p = new Promise((resolve) => {
        const img = new Image();
        const frameIdx = i - 1;

        img.onload = async () => {
          try {
            // Create GPU-accelerated ImageBitmap with high quality settings
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

          // Show first frame immediately for instant visual feedback
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

  // ─── Post-Load Setup ─────────────────────────────────────────────────
  const onAllImagesLoaded = () => {
    setTimeout(() => {
      if (loader) {
        loader.classList.add('hidden');
      }
      updateScrollProgress();
      currentProgress = targetProgress;
      const initialFrame = Math.min(
        FRAME_COUNT - 1,
        Math.max(0, Math.round(currentProgress * (FRAME_COUNT - 1)))
      );
      drawFrame(initialFrame);
    }, 150);
  };

  // ─── Event Listeners (all passive for zero-jank scrolling) ────────────
  window.addEventListener('resize', resizeCanvas, { passive: true });
  window.addEventListener('orientationchange', () => {
    setTimeout(resizeCanvas, 100);
  }, { passive: true });
  window.addEventListener('scroll', updateScrollProgress, { passive: true });

  // ─── Initialize ──────────────────────────────────────────────────────
  resizeCanvas();
  updateScrollProgress();
  preloadImages();
  requestAnimationFrame(renderLoop);
})();
