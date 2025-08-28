// More sophisticated transient detection using amplitude, spectral flux, and zero-crossing rate
// waveform: Float32Array or Array of samples (mono)
// options: { frameSize, hopSize, ampWeight, fluxWeight, zcrWeight, threshold, minGap }
export function detectTransientsMultiFeature(waveform, options = {}) {
  const frameSize = options.frameSize || 1024;
  const hopSize = options.hopSize || 256;
  const ampWeight = options.ampWeight ?? 1.0;
  const fluxWeight = options.fluxWeight ?? 1.0;
  const zcrWeight = options.zcrWeight ?? 0.5;
  const threshold = options.threshold ?? 0.3;
  const minGap = options.minGap || 5;
  const transients = [];
  let lastTransient = -minGap;

  // Helper: magnitude spectrum (no windowing for simplicity)
  function magSpectrum(frame) {
    const N = frame.length;
    const re = new Float32Array(N/2);
    const im = new Float32Array(N/2);
    for (let k = 0; k < N/2; k++) {
      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * k * n) / N;
        re[k] += frame[n] * Math.cos(angle);
        im[k] -= frame[n] * Math.sin(angle);
      }
    }
    return Array.from(re, (r, k) => Math.sqrt(r*r + im[k]*im[k]));
  }

  // Helper: zero-crossing rate
  function zeroCrossingRate(frame) {
    let count = 0;
    for (let i = 1; i < frame.length; i++) {
      if ((frame[i-1] <= 0 && frame[i] > 0) || (frame[i-1] >= 0 && frame[i] < 0)) count++;
    }
    return count / frame.length;
  }

  let prevFrame = null, prevSpec = null;
  for (let i = 0; i + frameSize <= waveform.length; i += hopSize) {
    const frame = waveform.slice(i, i + frameSize);
    // Amplitude diff (energy)
    let amp = 0;
    for (let j = 0; j < frame.length; j++) amp += Math.abs(frame[j]);
    amp /= frame.length;
    let ampDiff = prevFrame ? Math.max(0, amp - prevFrame.amp) : 0;
    // Spectral flux
    const spec = magSpectrum(frame);
    let flux = 0;
    if (prevSpec) {
      for (let k = 0; k < spec.length; k++) {
        flux += Math.max(0, spec[k] - prevSpec[k]);
      }
      flux /= spec.length;
    }
    // Zero-crossing rate
    const zcr = zeroCrossingRate(frame);
    let zcrDiff = prevFrame ? Math.max(0, zcr - prevFrame.zcr) : 0;
    // Combine features
    const score = ampWeight * ampDiff + fluxWeight * flux + zcrWeight * zcrDiff;
    // Peak picking
    if (score > threshold && (i - lastTransient) > minGap * hopSize) {
      // Optionally, refine to nearest zero-crossing in frame
      let zeroCross = i;
      for (let j = frame.length - 1; j > 0; j--) {
        if (frame[j-1] <= 0 && frame[j] > 0) {
          zeroCross = i + j;
          break;
        }
      }
      transients.push(zeroCross);
      lastTransient = i;
    }
    prevFrame = { amp, zcr };
    prevSpec = spec;
  }
  return transients;
}
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
