/*
 WIRED AUDIO SYSTEM
 - Ambient drone (always-on)
 - Boot tone
 - Save pulse
 - Offline muffling
 - Mood-linked modulation
*/

let audioCtx;
let masterGain, ambientGain, noiseGain;
let oscLow, oscHigh, noiseNode, noiseFilter;
let started = false;

function initAudio(){
  if (started) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.15;

  ambientGain = audioCtx.createGain();
  ambientGain.gain.value = 0.25;

  // Low oscillator (floor hum)
  oscLow = audioCtx.createOscillator();
  oscLow.type = "sine";
  oscLow.frequency.value = 48;

  // High unstable oscillator
  oscHigh = audioCtx.createOscillator();
  oscHigh.type = "triangle";
  oscHigh.frequency.value = 96;

  // Noise generator
  const bufferSize = 2 * audioCtx.sampleRate;
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  noiseNode = audioCtx.createBufferSource();
  noiseNode.buffer = noiseBuffer;
  noiseNode.loop = true;

  noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = 1200;

  noiseGain = audioCtx.createGain();
  noiseGain.gain.value = 0.05;

  oscLow.connect(ambientGain);
  oscHigh.connect(ambientGain);
  noiseNode.connect(noiseFilter).connect(noiseGain);

  ambientGain.connect(masterGain);
  noiseGain.connect(masterGain);
  masterGain.connect(audioCtx.destination);

  oscLow.start();
  oscHigh.start();
  noiseNode.start();

  started = true;
}

function resumeAudio(){
  if (!audioCtx) initAudio();
  if (audioCtx.state !== "running") audioCtx.resume();
}

// --- Event sounds ---
function bootSound(){
  resumeAudio();
  oscHigh.frequency.setValueAtTime(120, audioCtx.currentTime);
  oscHigh.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 1.2);
}

function saveSound(){
  resumeAudio();
  oscHigh.frequency.setValueAtTime(180, audioCtx.currentTime);
  oscHigh.frequency.exponentialRampToValueAtTime(90, audioCtx.currentTime + 0.25);
}

function errorSound(){
  resumeAudio();
  oscHigh.frequency.setValueAtTime(40, audioCtx.currentTime);
}

function setOffline(on){
  if (!audioCtx) return;
  noiseFilter.frequency.setTargetAtTime(on ? 400 : 1200, audioCtx.currentTime, 0.5);
  ambientGain.gain.setTargetAtTime(on ? 0.15 : 0.25, audioCtx.currentTime, 0.5);
}

// Mood mapping (-10..10)
function applyMood(m){
  if (!audioCtx || isNaN(m)) return;
  const t = audioCtx.currentTime;
  const f = 48 + m * 2.5;
  oscLow.frequency.setTargetAtTime(Math.max(20,f), t, 0.8);
  noiseGain.gain.setTargetAtTime(0.05 + Math.abs(m) * 0.01, t, 0.8);
}

// expose
window.WiredAudio = {
  resumeAudio,
  bootSound,
  saveSound,
  errorSound,
  setOffline,
  applyMood
};
