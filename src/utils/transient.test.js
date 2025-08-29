import { detectTransientsMultiFeature, detectAdjustedTransients } from './transient.js';

describe('Transient Detection', () => {
  // More realistic synthetic waveform: 3 percussive transients with decay
  // Each transient: [0, 0.8, 0.5, 0.2, 0, 0, 0, 0.9, 0.6, 0.3, 0, 0, 0, 1.0, 0.7, 0.3, 0, 0]
  const waveform = [0, 0.8, 0.5, 0.2, 0, 0, 0, 0.9, 0.6, 0.3, 0, 0, 0, 1.0, 0.7, 0.3, 0, 0];

  it('detectAdjustedTransients should detect all transients', () => {
    const result = detectAdjustedTransients(waveform, 0.5, 2);
    expect(result.length).toBe(3);
  });

  it('detectTransientsMultiFeature should detect at least as many as detectAdjustedTransients', () => {
    const adjusted = detectAdjustedTransients(waveform, 0.5, 2);
    const multi = detectTransientsMultiFeature(waveform, {
      frameSize: 4,
      hopSize: 1,
      ampWeight: 1.0,
      fluxWeight: 1.0,
      zcrWeight: 0.5,
      threshold: 0.2,
      minGap: 1
    });
    expect(multi.length).toBeGreaterThanOrEqual(adjusted.length);
  });
});
