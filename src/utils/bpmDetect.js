// src/utils/bpmDetect.js
// Simple BPM detection using energy peaks (not super accurate, but works for percussive material)
export function detectBpmFromBuffer(audioBuffer) {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const windowSize = Math.floor(sampleRate * 0.05); // 50ms window
  const energies = [];
  for (let i = 0; i < channelData.length; i += windowSize) {
    let sum = 0;
    for (let j = 0; j < windowSize && i + j < channelData.length; j++) {
      sum += channelData[i + j] * channelData[i + j];
    }
    energies.push(sum);
  }
  // Find peaks
  const threshold = Math.max(...energies) * 0.6;
  const peaks = [];
  for (let i = 1; i < energies.length - 1; i++) {
    if (energies[i] > threshold && energies[i] > energies[i - 1] && energies[i] > energies[i + 1]) {
      peaks.push(i * windowSize / sampleRate);
    }
  }
  if (peaks.length < 2) return null;
  // Get intervals between peaks
  const intervals = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }
  // Find the most common interval
  const histogram = {};
  for (const interval of intervals) {
    const rounded = Math.round(interval * 10) / 10;
    histogram[rounded] = (histogram[rounded] || 0) + 1;
  }
  let bestInterval = null, bestCount = 0;
  for (const interval in histogram) {
    if (histogram[interval] > bestCount) {
      bestCount = histogram[interval];
      bestInterval = parseFloat(interval);
    }
  }
  if (!bestInterval || bestInterval === 0) return null;
  const bpm = Math.round(60 / bestInterval);
  return bpm;
}
