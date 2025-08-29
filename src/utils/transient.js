export function detectTransientsMultiFeature(waveform, options = {}) {
  // Simple, robust: use short energy window and diff, with normalization and minGap
  const frameSize = options.frameSize ?? 1;
  const hopSize = options.hopSize ?? 1;
  if (options.debug) {
    console.log('detectTransientsMultiFeature: frameSize =', frameSize, 'hopSize =', hopSize);
  }
  // If sensitivity is provided as a UI slider value (0-1, logarithmic), map to threshold
  let threshold;
  if (typeof options.sensitivity === 'number') {
    // Map slider 0 (most sensitive) to 0.0001, 1 (least sensitive) to 0.2
    threshold = 0.0001 * Math.pow(200, options.sensitivity); // 0.0001 to 0.2
  } else {
    threshold = options.threshold ?? 0.08;
  }
  const minGap = options.minGap ?? 3;

  // Normalize waveform
  let max = 0;
  for (let i = 0; i < waveform.length; i++) {
    const abs = Math.abs(waveform[i]);
    if (abs > max) max = abs;
  }
  let normWaveform = waveform;
  if (max > 0 && max !== 1) {
    normWaveform = waveform.map(v => v / max);
  }

  // Compute short-time energy
  const energy = [];
  for (let i = 0; i + frameSize <= normWaveform.length; i += hopSize) {
    let sum = 0;
    for (let j = 0; j < frameSize; j++) {
      sum += normWaveform[i + j] * normWaveform[i + j];
    }
    energy.push(sum / frameSize);
  }
  // Normalize energy
  const maxE = Math.max(...energy);
  const minE = Math.min(...energy);
  const normE = energy.map(e => (maxE > minE) ? (e - minE) / (maxE - minE) : 0);

  // Compute energy difference (onset function)
  const diff = [0];
  for (let i = 1; i < normE.length; i++) {
    diff.push(Math.max(0, normE[i] - normE[i - 1]));
  }

  // Debug: log waveform length, diff length, and peaks above threshold
  if (options.debug) {
    console.log('detectTransientsMultiFeature: waveform.length =', normWaveform.length);
    console.log('detectTransientsMultiFeature: diff.length =', diff.length);
    console.log('detectTransientsMultiFeature: diff (energy difference):', diff);
    const peaks = diff.filter(v => v > threshold).length;
    console.log('detectTransientsMultiFeature: # of values above threshold:', peaks);
  }

  const peakPicking = false; //options.peakPicking == false; // default true, set to false to disable
  const zeroCrossingRefine = false ;//options.zeroCrossingRefine == false; // default true, set to false to disable

  const transients = [];
  let last = -minGap;
  if (peakPicking) {
    for (let i = 1; i < diff.length - 1; i++) {
      if (
        diff[i] > threshold &&
        diff[i] >= diff[i - 1] &&
        diff[i] >= diff[i + 1] &&
        (i - last) * hopSize > minGap
      ) {
        const frameStart = i * hopSize;
        const frame = normWaveform.slice(frameStart, frameStart + frameSize);
        let zeroCross = frameStart;
        if (zeroCrossingRefine) {
          for (let j = frame.length - 1; j > 0; j--) {
            if (frame[j-1] <= 0 && frame[j] > 0) {
              zeroCross = frameStart + j;
              break;
            }
          }
        }
        transients.push(zeroCross);
        last = i;
      }
    }
  } else {
    // No peak picking: every value above threshold and minGap
    for (let i = 1; i < diff.length; i++) {
      if (
        diff[i] > threshold &&
        (i - last) * hopSize > minGap
      ) {
        const frameStart = i * hopSize;
        const frame = normWaveform.slice(frameStart, frameStart + frameSize);
        let zeroCross = frameStart;
        if (zeroCrossingRefine) {
          for (let j = frame.length - 1; j > 0; j--) {
            if (frame[j-1] <= 0 && frame[j] > 0) {
              zeroCross = frameStart + j;
              break;
            }
          }
        }
        transients.push(zeroCross);
        last = i;
      }
    }
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
