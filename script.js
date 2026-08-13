(() => {
  // ─── Configuration ───────────────────────────────────────────────────
  const FRAME_COUNT = 300;
  const FOLDER_PATH = 'New folder (2)';
  const FILE_PREFIX = 'ezgif-frame-';
  const FILE_EXT = '.jpg';

  // Smooth interpolation factor: lower = smoother but more delayed
  // 0.08 gives a premium, cinematic momentum feel
  const LERP_FACTOR = 0.08;

  // ─── DOM Elements ────────────────────────────────────────────────────
  const canvas = document.getElementById('animationCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const loader = document.getElementById('loader');
  const loaderText = document.getElementById('loaderText');
  const loaderBar = document.getElementById('loaderBar');

  // ─── State ───────────────────────────────────────────────────────────
  const images = [];
  let loadedCount = 0;
  let currentRenderedFrame = -1;
  let targetProgress = 0;    // Where scroll wants us to be (0–1)
  let currentProgress = 0;   // Where we actually are (smoothed, 0–1)

  // ─── Frame URL builder ───────────────────────────────────────────────
  const getFrameUrl = (index) => {
    const frameNum = String(index).padStart(3, '0');
    return `${FOLDER_PATH}/${FILE_PREFIX}${frameNum}${FILE_EXT}`;
  };

  // ─── Canvas Resize (HiDPI-aware) ────────────────────────────────────
  // Sets internal pixel buffer to match viewport × devicePixelRatio.
  // CSS handles the visual display size (100vw × 100dvh).
  const resizeCanvas = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Set internal buffer resolution
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    // Set CSS display size to exactly match the viewport
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    // Reset transform and apply DPR scaling
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Re-draw current frame at new size
    if (currentRenderedFrame >= 0 && images[currentRenderedFrame]) {
      drawFrame(currentRenderedFrame);
    }
  };

  // ─── Draw Frame (Responsive Contain Fit) ─────────────────────────────
  // Uses CONTAIN scaling: the entire composition (MCAS PRESENTS) is always
  // fully visible and centered. Black bars fill any aspect ratio mismatch.
  // This ensures nothing is ever cropped on any screen size or orientation.
  const drawFrame = (frameIndex) => {
    const img = images[frameIndex];
    if (!img) return;

    const imgW = img.naturalWidth || img.width || 1920;
    const imgH = img.naturalHeight || img.height || 1080;
    if (imgW === 0 || imgH === 0) return;

    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    // COVER: scale so the image fills the entire viewport edge-to-edge.
    // Math.max ensures no black bars — the video always covers 100% of the viewport.
    // On portrait phones, side edges get naturally cropped; on landscape, top/bottom.
    // The composition remains centered so MCAS PRESENTS stays visible.
    const scale = Math.max(vpW / imgW, vpH / imgH);

    const drawW = Math.round(imgW * scale);
    const drawH = Math.round(imgH * scale);

    // Center the scaled image within the viewport
    const x = Math.round((vpW - drawW) / 2);
    const y = Math.round((vpH - drawH) / 2);

    // Draw the frame covering the full viewport
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

  // ─── Animation Render Loop (Lerp Interpolation) ──────────────────────
  // Runs at display refresh rate (60/120fps). Smoothly interpolates
  // currentProgress toward targetProgress for premium cinematic motion.
  const renderLoop = () => {
    // Smooth interpolation: exponential ease toward target
    const delta = targetProgress - currentProgress;
    currentProgress += delta * LERP_FACTOR;

    // Snap when extremely close to avoid infinite micro-animations
    if (Math.abs(delta) < 0.0001) {
      currentProgress = targetProgress;
    }

    // Map smooth progress to frame index
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

  // ─── Image Preloader ─────────────────────────────────────────────────
  // Loads all 300 frames, converts each to GPU-accelerated ImageBitmap
  // for maximum canvas rendering speed. Shows progress in the loader UI.
  const preloadImages = async () => {
    const promises = [];

    for (let i = 1; i <= FRAME_COUNT; i++) {
      const p = new Promise((resolve) => {
        const img = new Image();
        const frameIdx = i - 1;

        img.onload = async () => {
          try {
            // GPU-accelerated ImageBitmap for faster drawImage
            const bitmap = await createImageBitmap(img, {
              imageOrientation: 'none',
              premultiplyAlpha: 'none',
              colorSpaceConversion: 'default'
            });
            images[frameIdx] = bitmap;
          } catch (e) {
            // Fallback to regular Image element
            images[frameIdx] = img;
          }

          loadedCount++;
          const percent = Math.floor((loadedCount / FRAME_COUNT) * 100);
          if (loaderText) loaderText.textContent = `${percent}%`;
          if (loaderBar) loaderBar.style.width = `${percent}%`;

          // Show first frame as soon as it loads (immediate visual feedback)
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
      // Sync to current scroll position
      updateScrollProgress();
      currentProgress = targetProgress;
      const initialFrame = Math.min(
        FRAME_COUNT - 1,
        Math.max(0, Math.round(currentProgress * (FRAME_COUNT - 1)))
      );
      drawFrame(initialFrame);
    }, 150);
  };

  // ─── Event Listeners ─────────────────────────────────────────────────
  // All passive for maximum scroll performance (no jank)
  window.addEventListener('resize', resizeCanvas, { passive: true });
  window.addEventListener('orientationchange', () => {
    // Delay to let the browser finish orientation change layout
    setTimeout(resizeCanvas, 100);
  }, { passive: true });
  window.addEventListener('scroll', updateScrollProgress, { passive: true });

  // ─── Initialize ──────────────────────────────────────────────────────
  resizeCanvas();
  updateScrollProgress();
  preloadImages();
  requestAnimationFrame(renderLoop);
})();
