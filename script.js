(() => {
  const FRAME_COUNT = 300;
  const FOLDER_PATH = 'New folder (2)';
  const FILE_PREFIX = 'ezgif-frame-';
  const FILE_EXT = '.jpg';

  const canvas = document.getElementById('animationCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const loader = document.getElementById('loader');
  const loaderText = document.getElementById('loaderText');
  const loaderBar = document.getElementById('loaderBar');

  const images = [];
  let loadedCount = 0;
  let currentRenderedFrame = -1;
  let targetProgress = 0;
  let currentProgress = 0;
  const LERP_FACTOR = 0.08; // Silky smooth momentum factor

  // Construct frame URL
  const getFrameUrl = (index) => {
    const frameNum = String(index).padStart(3, '0');
    return `${FOLDER_PATH}/${FILE_PREFIX}${frameNum}${FILE_EXT}`;
  };

  // Adjust canvas resolution for High DPI displays
  const resizeCanvas = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Re-draw current frame after resizing
    if (currentRenderedFrame >= 0 && images[currentRenderedFrame]) {
      drawFrame(currentRenderedFrame);
    }
  };

  // Draw frame full-screen and perfectly fit across all screen sizes (responsive cover)
  const drawFrame = (frameIndex) => {
    const img = images[frameIndex];
    if (!img) return;

    const imgWidth = img.naturalWidth || img.width || 1920;
    const imgHeight = img.naturalHeight || img.height || 1080;
    if (imgWidth === 0 || imgHeight === 0) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Full screen edge-to-edge cover scaling for perfect fit on any device size
    const scale = Math.max(width / imgWidth, height / imgHeight);
    const renderWidth = Math.round(imgWidth * scale);
    const renderHeight = Math.round(imgHeight * scale);
    const x = Math.round((width - renderWidth) / 2);
    const y = Math.round((height - renderHeight) / 2);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, imgWidth, imgHeight, x, y, renderWidth, renderHeight);
    currentRenderedFrame = frameIndex;
  };

  // Update target progress from scroll position
  const updateScrollProgress = () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll > 0) {
      targetProgress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
    } else {
      targetProgress = 0;
    }
  };

  // Animation render loop with linear interpolation (lerp)
  const renderLoop = () => {
    // Interpolate progress smoothly
    currentProgress += (targetProgress - currentProgress) * LERP_FACTOR;

    // Determine target frame index based on smooth progress
    const frameIndex = Math.min(
      FRAME_COUNT - 1,
      Math.max(0, Math.round(currentProgress * (FRAME_COUNT - 1)))
    );

    if (frameIndex !== currentRenderedFrame) {
      drawFrame(frameIndex);
    }

    requestAnimationFrame(renderLoop);
  };

  // Preload all frames into GPU ImageBitmaps for maximum rendering speed and sharpness
  const preloadImages = async () => {
    const promises = [];

    for (let i = 1; i <= FRAME_COUNT; i++) {
      const p = new Promise((resolve) => {
        const img = new Image();
        const frameIdx = i - 1;

        img.onload = async () => {
          try {
            // Convert to high quality GPU ImageBitmap
            const bitmap = await createImageBitmap(img, {
              imageOrientation: 'none',
              premultiplyAlpha: 'none',
              colorSpaceConversion: 'default'
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

  // Initialize event listeners
  window.addEventListener('resize', resizeCanvas, { passive: true });
  window.addEventListener('orientationchange', resizeCanvas, { passive: true });
  window.addEventListener('scroll', updateScrollProgress, { passive: true });

  resizeCanvas();
  updateScrollProgress();
  preloadImages();
  requestAnimationFrame(renderLoop);
})();
