const SAMPLES = 150;

// utils/waveform.js
// Returns a normalized array of waveform data for a given audio file URL
export async function getWaveformData(url) {
  return new Promise((resolve) => {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  fetch(url)
      .then(res => res.arrayBuffer())
      .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
      .then(audioBuffer => {
        const rawData = audioBuffer.getChannelData(0);
        const blockSize = Math.floor(rawData.length / SAMPLES);
        const waveform = [];
        for (let i = 0; i < SAMPLES; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(rawData[i * blockSize + j]);
          }
          waveform.push(sum / blockSize);
        }
        // Normalize
        const max = Math.max(...waveform);
        resolve(waveform.map(n => n / max));
      });
  });
}
