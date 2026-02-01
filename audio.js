// docs/audio.js
// iOS / PWA SAFE AUDIO ENGINE

class WiredAudioEngine {
  constructor(){
    this.ctx = null;
    this.noiseNode = null;
    this.enabled = false;
  }

  init(){
    if (this.ctx) return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();
    this.enabled = false;

    // ノイズ生成
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.noiseNode = this.ctx.createBufferSource();
    this.noiseNode.buffer = noiseBuffer;
    this.noiseNode.loop = true;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.03; // 静かなノイズ

    this.noiseNode.connect(gain).connect(this.ctx.destination);
  }

  async unlock(){
    this.init();
    if (this.ctx.state === "suspended"){
      await this.ctx.resume();
    }
    this.enabled = true;
    try{
      this.noiseNode.start();
    }catch(e){}
    console.log("[AUDIO] unlocked");
  }

  staticNoise(){
    if (!this.enabled) return;
    // 既に loop 再生しているので何もしない
  }

  pulse(){
    if (!this.enabled) return;
    // 将来の効果音用フック
  }
}

// グローバル公開
window.WiredAudio = new WiredAudioEngine();
