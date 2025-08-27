// Detects transients in a normalized waveform array
// Returns an array of indices where transients are detected
export function detectTransients(waveform, threshold = 0.3, minGap = 5) {
  const transients = [];
  let lastTransient = -minGap;
  for (let i = 1; i < waveform.length; i++) {
    const diff = waveform[i] - waveform[i - 1];
    if (diff > threshold && (i - lastTransient) > minGap) {
      transients.push(i);
      lastTransient = i;
    }
  }
  return transients;
}
