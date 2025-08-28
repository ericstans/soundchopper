// Returns zero-crossing before each transient if available
export function detectAdjustedTransients(waveform, threshold = 0.3, minGap = 5) {
  const transients = [];
  let lastTransient = -minGap;
  for (let i = 1; i < waveform.length; i++) {
    const diff = waveform[i] - waveform[i - 1];
    if (diff > threshold && (i - lastTransient) > minGap) {
      // Look for zero-crossing just before i
      let zeroCross = i;
      for (let j = i - 1; j > lastTransient; j--) {
        if (waveform[j - 1] <= 0 && waveform[j] > 0) {
          zeroCross = j;
          break;
        }
      }
      transients.push(zeroCross);
      lastTransient = i;
    }
  }
  return transients;
}
