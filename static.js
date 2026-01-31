<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="theme-color" content="#05080c" />
  <link rel="manifest" href="./manifest.json" />
  <link rel="apple-touch-icon" href="./assets/icon-192.png" />
  <title>STATIC ROOM // THE WIRED</title>
  <link rel="stylesheet" href="./styles.css" />
  <style>
    .static-shell{ position: relative; min-height: 100vh; overflow: hidden; }

    /* Background video */
    .static-video{
      position: fixed;
      inset: 0;
      z-index: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: .62;
      filter: contrast(1.05) saturate(.85) brightness(.85);
      transform: translateZ(0);
      pointer-events: none;
    }

    /* Canvas noise layer */
    .static-stage{ position: fixed; inset: 0; z-index: 1; }
    #staticCanvas{ width: 100%; height: 100%; display:block; image-rendering: pixelated; }

    /* Blink mosaic layer */
    #blinkLayer{
      position: fixed;
      inset: 0;
      z-index: 2;
      pointer-events: none;
      opacity: 0;
      mix-blend-mode: screen;
      filter: contrast(1.2) saturate(.9);
      transform: translateZ(0);
    }
    #blinkLayer.on{ opacity: .9; }

    /* Reuse existing vibes */
    .static-overlay{ position: fixed; inset: 0; pointer-events:none; z-index: 3; }

    .static-ui{
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%);
      z-index: 4;
      width: min(920px, calc(100% - 24px));
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      align-items: center;
    }
    .static-panel{
      border: 1px solid rgba(120,255,170,.22);
      background: rgba(0,0,0,.35);
      padding: 10px 12px;
      border-radius: 12px;
      backdrop-filter: blur(6px);
      box-shadow: 0 0 18px rgba(80,255,160,.08);
    }
    .static-title{
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      letter-spacing: .08em;
      font-size: 12px;
      opacity: .9;
      margin-bottom: 6px;
    }
    .static-row{ display:flex; gap:8px; align-items:center; justify-content: space-between; }
    .static-row label{
      width:100%;
      display:flex;
      gap:8px;
      align-items:center;
      font-size: 12px;
      opacity: .9;
    }
    .static-row input[type="range"]{ width:100%; }
