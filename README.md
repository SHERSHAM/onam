# Onam - Smooth Scroll Frame Animation

A high-performance, full-screen, responsive scroll-driven particle and sequence animation built with HTML5 Canvas and Bootstrap 5.

## Features
- **Smooth Scroll Scrubbing**: 300 sequential frames rendered with linear interpolation (`lerp`) and momentum for fluid 60fps/120fps motion.
- **Bootstrap 5 Responsive Grid**: Seamless full-screen adaptation across extra small (`xs`), medium (`md`), large (`lg`), extra large (`xl`), and `xxl` viewports.
- **GPU-Accelerated Rendering**: Frames are preloaded and converted to `ImageBitmap` textures for fast drawing without CPU decoding lag.
- **Full Screen Edge-to-Edge**: Dynamic viewport fitting (`100vw`, `100vh`, `100dvh`) without letterboxing on mobile devices.
- **Clarity Post-Processing**: Enhanced contrast and sharpness filters for rich particle highlights and crisp text rendering.

## Setup & Running
Open `index.html` in any modern web browser or serve locally with any static server:
```bash
python -m http.server 8000
```
