<template>
  <div class="waveform-loader">
    <div class="builtin-loop-select-container">
      <select id="builtin-loop-select" v-model="selectedLoop" @change="onSelectLoop" class="builtin-loop-select">
        <option value="">-- Select a loop --</option>
        <option v-for="loop in builtinLoops" :key="loop.value" :value="loop.value">{{ loop.label }}</option>
      </select>
      <input type="file" accept="audio/mp3,audio/wav" @change="onFileChange" />

      <!-- End sequencer block -->
      <div class="loading-text" v-if="loading">Loading...</div>
      <div class="play-sensitivity-row" v-if="waveform.length">
        <button class="circle-play-btn" @click="toggleFullSamplePlay"
          :title="isFullSamplePlaying ? 'Stop' : 'Play full sample'">
          <svg v-if="!isFullSamplePlaying" viewBox="0 0 40 40" width="32" height="32" aria-hidden="true">
            <circle cx="20" cy="20" r="19" fill="#222" stroke="#42b983" stroke-width="2" />
            <polygon points="16,12 30,20 16,28" fill="#42b983" />
          </svg>
          <svg v-else viewBox="0 0 40 40" width="32" height="32" aria-hidden="true">
            <circle cx="20" cy="20" r="19" fill="#222" stroke="#ff5252" stroke-width="2" />
            <rect x="13" y="12" width="14" height="16" rx="2" fill="#ff5252" />
          </svg>
        </button>
        <div>
          <div class="guess-bpm-container">
            <label class="guess-bpm-label">
              <input type="checkbox" v-model="guessBpmOnImport" class="guess-bpm-checkbox" />
              Guess BPM on import
            </label>
          </div>
          <div class="sensitivity-controls">
            <span>Sensitivity</span>
            <button @click="decreaseSensitivity">-</button>
            <span>{{ sensitivity.toFixed(2) }}</span>
            <button @click="increaseSensitivity">+</button>
          </div>
        </div>
      </div>
      <div class="waveform-container" v-if="transients.length > 1">
        <svg :width="svgWidth" :height="svgHeight" class="waveform-svg" @click="playAudio">
          <polyline :points="waveformPoints" fill="none" stroke="#42b983" stroke-width="2" />
          <g v-for="(idx, segIdx) in transients" :key="'transient-' + idx">
            <line v-if="segIdx > 0" :x1="(idx / (waveform.length - 1)) * svgWidth" y1="0"
              :x2="(idx / (waveform.length - 1)) * svgWidth" :y2="svgHeight"
              :stroke="segmentEnabled[segIdx - 1] ? '#ff5252' : '#888'" stroke-width="2" stroke-dasharray="4,2"
              class="waveform-segment-line" />
          </g>
          <!-- Add transparent rects for right-click toggling -->
          <g v-for="(enabled, segIdx) in segmentEnabled" :key="'togglearea-' + segIdx">
            <rect :x="(transients[segIdx] / (waveform.length - 1)) * svgWidth" y="0"
              :width="((transients[segIdx + 1] - transients[segIdx]) / (waveform.length - 1)) * svgWidth"
              :height="svgHeight" fill="transparent" class="waveform-segment-rect"
              @contextmenu.prevent="toggleSegmentEnabled(segIdx, $event)" @click="playSegmentByIndex(segIdx)" />
          </g>
          <!-- Grey overlay for disabled segments -->
          <g v-for="(enabled, segIdx) in segmentEnabled" :key="'overlay-' + segIdx">
            <rect v-if="!enabled" :x="(transients[segIdx] / (waveform.length - 1)) * svgWidth" y="0"
              :width="((transients[segIdx + 1] - transients[segIdx]) / (waveform.length - 1)) * svgWidth"
              :height="svgHeight" fill="#888" fill-opacity="0.35" class="waveform-segment-disabled" />
          </g>
          <!-- Highlight currently playing waveform section -->
          <rect v-if="isPlaying && currentStep.value >= 0 && playingSectionBounds" :x="playingSectionBounds.x" y="0"
            :width="playingSectionBounds.width" :height="svgHeight" fill="#42b983" fill-opacity="0.18" stroke="#42b983"
            stroke-width="2" class="waveform-section-playing" />
          <!-- Highlight waveform section played by click -->
          <rect v-if="clickedSectionHighlight" :x="clickedSectionHighlight.x" y="0"
            :width="clickedSectionHighlight.width" :height="svgHeight" fill="#ff5252" fill-opacity="0.18"
            stroke="#ff5252" stroke-width="2" class="waveform-section-clicked" />
        </svg>
      </div>
      <div v-if="transients.length > 1" class="sequencer">
        <div class="sequencer-grid" :style="{ '--pattern-length': patternLength }">
          <div v-for="(row, rowIdx) in sequencer.length" :key="'row-' + rowIdx" class="sequencer-row"
            v-show="segmentEnabled[rowIdx]" :class="{ 'playing-row': isPlaying && isRowPlaying(rowIdx) }">
            <div v-for="(cell, colIdx) in sequencer[rowIdx]" :key="'cell-' + rowIdx + '-' + colIdx"
              class="sequencer-cell" :class="{ active: cell, playing: isPlaying && isCellPlaying(rowIdx, colIdx) }"
              @mousedown="onCellMouseDown(rowIdx, colIdx, $event)"
              @mouseenter="onCellMouseEnter(rowIdx, colIdx, $event)" @mouseup="onCellMouseUp(rowIdx, colIdx, $event)"
              @contextmenu.prevent="clearCell(rowIdx, colIdx)"></div>
          </div>
          <!-- Lock icons row -->
          <div class="sequencer-lock-row">
            <button v-for="col in patternLength" :key="'lock-' + (col - 1)" @click="toggleColumnLock(col - 1)"
              :title="columnLocks[col - 1] ? 'Unlock column' : 'Lock column'" class="sequencer-lock-btn">
              <svg v-if="columnLocks[col - 1]" width="20" height="20" viewBox="0 0 20 20">
                <rect x="4" y="8" width="12" height="8" rx="2" fill="#42b983" />
                <path d="M7 8V6a3 3 0 0 1 6 0v2" stroke="#fff" stroke-width="2" fill="none" />
              </svg>
              <svg v-else width="20" height="20" viewBox="0 0 20 20">
                <rect x="4" y="8" width="12" height="8" rx="2" fill="#888" />
                <path d="M7 8V6a3 3 0 0 1 6 0v2" stroke="#fff" stroke-width="2" fill="none" />
                <rect x="8.5" y="12" width="3" height="3" rx="1.5" fill="#fff" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div class="sequencer-control-row" v-if="transients.length > 1">
        <div class="sequencer-rotate-col">
          <button class="rotate-btn" @click="rotateSequencerLeft" title="Rotate Left">&lt;</button>
          <button class="rotate-btn halve-btn" @click="halvePatternLength" title="Halve pattern length">-</button>
        </div>
        <button class="circle-play-btn sequencer-play-btn" @click="toggleSequencerPlay"
          title="{{ isPlaying ? 'Pause' : 'Play' }}">
          <svg v-if="!isPlaying" viewBox="0 0 40 40" width="32" height="32" aria-hidden="true">
            <circle cx="20" cy="20" r="19" fill="#222" stroke="#42b983" stroke-width="2" />
            <polygon points="16,12 30,20 16,28" fill="#42b983" />
          </svg>
          <svg v-else viewBox="0 0 40 40" width="32" height="32" aria-hidden="true">
            <circle cx="20" cy="20" r="19" fill="#222" stroke="#42b983" stroke-width="2" />
            <rect x="13" y="12" width="5" height="16" rx="2" fill="#42b983" />
            <rect x="22" y="12" width="5" height="16" rx="2" fill="#42b983" />
          </svg>
        </button>
        <button @click="randomizeSequencer" title="Randomize pattern" class="sequencer-random-btn">
          🎲
        </button>
        <div class="sequencer-rotate-col">
          <button class="rotate-btn" @click="rotateSequencerRight" title="Rotate Right">&gt;</button>
          <button class="rotate-btn double-btn" @click="doublePatternLength" title="Double pattern length">+</button>
        </div>
      </div>
      <div class="controls" v-if="transients.length > 1">
        <div>
          <div class="bpm-controls">
            <label for="bpm-input" class="bpm-label">BPM</label>
            <input id="bpm-input" type="number" v-model.number="bpmInput" min="40" max="300" step="1"
              class="bpm-input" />
            <label class="bpm-x2-label">
              <input type="checkbox" v-model="bpmDouble" class="bpm-x2-checkbox" />
              x2
            </label>
          </div>
        </div>
        <label class="normalize-label">
          <input type="checkbox" v-model="normalizeSegments" class="normalize-checkbox" />
          Normalize segments
        </label>
        <div class="controls-row">
          <div class="density-controls">
            <label for="density-slider" class="density-label">Pattern density</label>
            <input id="density-slider" type="range" min="0" max="100" v-model.number="patternDensity"
              class="density-slider" />
            <span>{{ patternDensity }}%</span>
          </div>
        </div>
        <div class="controls-row">

          <div class="speed-controls">
            <label for="speed-slider" class="speed-label">Playback speed</label>
            <input id="speed-slider" type="range" min="0.5" max="2" step="0.01" v-model.number="playbackSpeed"
              class="speed-slider" />
            <span>{{ playbackSpeed.toFixed(2) }}x</span>
          </div>
        </div>
        <div class="controls-row">

          <div class="swing-controls">
            <label for="swing-slider" class="swing-label">Swing</label>
            <input id="swing-slider" type="range" min="0" max="50" step="1" v-model.number="swing"
              class="swing-slider" />
            <span>{{ swing }}%</span>
          </div>
        </div>
        <div class="controls-row export-row">
          <button @click="exportSequencerToWav" class="export-btn">Export to WAV</button>
        </div>
      </div>
    </div>
    <div class="info" v-if="waveform.length">
      <div class="info-title">Stuff I'm going to fix:</div>
      <ul>
        <li>Transient detection needs improvement.</li>
        <li>Loops dropdown is spicy on mobile. Stop the sequencer before trying to use it.</li>
        <li>Halving or doubling the sequencer length doesn't apply correctly unless you pause and play.</li>
        <li>The first note doesn't play after starting the sequencer.</li>
      </ul>
      <div class="info-contact">Find another issue? Contact me: <a
          href="mailto:eric@estansbury.net">eric@estansbury.net</a></div>
    </div>
  </div>
</template>
<script setup>
import '../assets/main.css';
// Drag-to-enable state
const isDragging = ref(false);
const dragRow = ref(null);
const dragButton = ref(null);
function onCellMouseDown(row, col, e) {
  if (e.button !== 0) return; // Only left mouse
  isDragging.value = true;
  dragRow.value = row;
  dragButton.value = e.button;
  enableCell(row, col);
  window.addEventListener('mouseup', onGridMouseUp);
}
function onCellMouseEnter(row, col, e) {
  if (isDragging.value && dragRow.value === row && dragButton.value === 0) {
    enableCell(row, col);
  }
}
function onCellMouseUp(row, col, e) {
  if (isDragging.value && dragRow.value === row && dragButton.value === 0) {
    isDragging.value = false;
    dragRow.value = null;
    dragButton.value = null;
    window.removeEventListener('mouseup', onGridMouseUp);
  }
}
function onGridMouseUp() {
  isDragging.value = false;
  dragRow.value = null;
  dragButton.value = null;
  window.removeEventListener('mouseup', onGridMouseUp);
}
function enableCell(row, col) {
  if (col >= patternLength.value) return;
  // If already active, deactivate (toggle off)
  if (sequencer.value[row][col]) {
    sequencer.value[row][col] = false;
    return;
  }
  // Only one cell per column: turn off all others in this column
  for (let r = 0; r < sequencer.value.length; r++) {
    if (col < sequencer.value[r].length) {
      sequencer.value[r][col] = false;
    }
  }
  sequencer.value[row][col] = true;
}
const guessBpmOnImport = ref(false);
function playSegmentByIndex(segIdx) {
  if (!audioBuffer || !audioCtx || !transients.value.length) return;
  const startIdx = transients.value[segIdx];
  const endIdx = transients.value[segIdx + 1];
  const segStart = (startIdx / (waveform.value.length - 1)) * audioBuffer.duration;
  const segEnd = (endIdx / (waveform.value.length - 1)) * audioBuffer.duration;
  const highlightX = (startIdx / (waveform.value.length - 1)) * svgWidth;
  const highlightWidth = ((endIdx - startIdx) / (waveform.value.length - 1)) * svgWidth;
  if (audioCtx._currentSource) {
    try { audioCtx._currentSource.stop(); } catch { }
  }
  const duration = Math.max(0.1, segEnd - segStart);
  const FADE_MS = 0.008; // 8 ms fade-out
  const gainNode = audioCtx.createGain();
  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  // Fade out at end: always FADE_MS seconds at the end of the segment
  gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
  gainNode.gain.setValueAtTime(1, audioCtx.currentTime + duration - FADE_MS);
  gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);
  source.onended = () => { clickedSectionHighlight.value = null; };
  source.start(0, segStart, duration);
  audioCtx._currentSource = source;
  clickedSectionHighlight.value = { x: highlightX, width: highlightWidth };
}
// Highlight for waveform section played by click
const clickedSectionHighlight = ref(null);
import { ref, computed, onUnmounted, watch, nextTick } from 'vue';
import { getWaveformData } from '../utils/waveform.js';
import { detectAdjustedTransients, detectTransientsMultiFeature } from '../utils/transient.js';
import { detectBpmFromBuffer } from '../utils/bpmDetect.js';
const patternLength = ref(8);
const bpmDouble = ref(false);
const bpm = ref(120);
const playbackSpeed = ref(1.0); // 1.0 = normal speed
const waveform = ref([]);
const loading = ref(false);
const svgWidth = 600;
const svgHeight = 100;
const audioUrl = ref(null);
let audio = null;
const transients = ref([]);
let audioBuffer = null;
let audioCtx = null;
const sensitivity = ref(0.1); // Lower = more sensitive
const isPlaying = ref(false);
const currentStep = ref(-1);
let sequencerInterval = null;
let activeSources = [];
const sequencer = ref([]);
const segmentEnabled = ref([]);

const columnLocks = ref([]);
watch(patternLength, (len) => {
  // Resize columnLocks array to match patternLength
  if (columnLocks.value.length < len) {
    columnLocks.value = columnLocks.value.concat(Array(len - columnLocks.value.length).fill(false));
  } else if (columnLocks.value.length > len) {
    columnLocks.value = columnLocks.value.slice(0, len);
  }
});
function toggleColumnLock(colIdx) {
  columnLocks.value[colIdx] = !columnLocks.value[colIdx];
}
// Swing amount (0-100)
const swing = ref(0);
const isFullSamplePlaying = ref(false);
let currentSwingFrac = 0;
watch(swing, (val) => {
  currentSwingFrac = val / 100;
});

function toggleFullSamplePlay() {
  if (isFullSamplePlaying.value) {
    stopFullSample();
  } else {
    playFullSample();
  }
}

function stopFullSample() {
  if (audioCtx && audioCtx._currentSource) {
    try { audioCtx._currentSource.stop(); } catch { }
    audioCtx._currentSource = null;
  }
  isFullSamplePlaying.value = false;
}
function stopAllSound() {
  if (audioCtx && audioCtx._currentSource) {
    try { audioCtx._currentSource.stop(); } catch { }
    audioCtx._currentSource = null;
  }
  isFullSamplePlaying.value = false;
  isPlaying.value = false;
  currentStep.value = -1;
  if (sequencerInterval) clearTimeout(sequencerInterval);
  if (activeSources && activeSources.length) {
    for (const src of activeSources) {
      try { src.stop(); } catch { }
    }
    activeSources = [];
  }
}
// Helper: encode AudioBuffer to WAV (16-bit PCM, stereo/mono)
function encodeWAV(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length * numChannels * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  // RIFF identifier 'RIFF'
  [0x52, 0x49, 0x46, 0x46].forEach((c, i) => view.setUint8(i, c));
  view.setUint32(4, length - 8, true); // file length - 8
  // 'WAVE'
  [0x57, 0x41, 0x56, 0x45].forEach((c, i) => view.setUint8(8 + i, c));
  // 'fmt '
  [0x66, 0x6d, 0x74, 0x20].forEach((c, i) => view.setUint8(12 + i, c));
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
  view.setUint16(32, numChannels * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  // 'data'
  [0x64, 0x61, 0x74, 0x61].forEach((c, i) => view.setUint8(36 + i, c));
  view.setUint32(40, length - 44, true);
  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = audioBuffer.getChannelData(ch)[i];
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

async function exportSequencerToWav() {
  if (!audioBuffer || !transients.value.length || !sequencer.value.length) return;
  const nRows = sequencer.value.length;
  const nCols = patternLength.value;
  const stepDuration = 60 / effectiveBpm.value / 2; // seconds per step
  const totalDuration = nCols * stepDuration;
  const sampleRate = audioBuffer.sampleRate;
  const offlineCtx = new OfflineAudioContext(audioBuffer.numberOfChannels, Math.ceil(totalDuration * sampleRate), sampleRate);
  const FADE_MS = 0.008; // 8 ms fade-out
  // For each step, schedule enabled segments
  for (let col = 0; col < nCols; col++) {
    for (let row = 0; row < nRows; row++) {
      if (sequencer.value[row][col]) {
        // Find segment start/end
        const segIdx = enabledSegmentIndices.value[row];
        if (segIdx == null) continue;
        const startIdx = transients.value[segIdx];
        const endIdx = transients.value[segIdx + 1];
        const segStart = (startIdx / (waveform.value.length - 1)) * audioBuffer.duration;
        const segEnd = (endIdx / (waveform.value.length - 1)) * audioBuffer.duration;
        const duration = Math.max(0.1, segEnd - segStart);
        // Create buffer source for this segment
        const source = offlineCtx.createBufferSource();
        let gainNode = offlineCtx.createGain();
        if (normalizeSegments.value) {
          // Normalize segment
          const numChannels = audioBuffer.numberOfChannels;
          const segLength = Math.floor(duration * sampleRate);
          const segmentBuffer = offlineCtx.createBuffer(numChannels, segLength, sampleRate);
          for (let ch = 0; ch < numChannels; ch++) {
            const src = audioBuffer.getChannelData(ch);
            const dst = segmentBuffer.getChannelData(ch);
            const startSample = Math.floor(segStart * sampleRate);
            const endSample = Math.min(startSample + segLength, src.length);
            let max = 0;
            for (let i = startSample; i < endSample; i++) {
              if (Math.abs(src[i]) > max) max = Math.abs(src[i]);
            }
            const norm = max > 0 ? 1 / max : 1;
            for (let i = 0; i < segLength && (startSample + i) < src.length; i++) {
              dst[i] = src[startSample + i] * norm;
            }
          }
          source.buffer = segmentBuffer;
        } else {
          source.buffer = audioBuffer;
        }
        source.playbackRate.value = playbackSpeed.value;
        source.connect(gainNode);
        gainNode.connect(offlineCtx.destination);
        // Fade out at end
        gainNode.gain.setValueAtTime(1, col * stepDuration);
        gainNode.gain.linearRampToValueAtTime(0, col * stepDuration + duration - FADE_MS + FADE_MS);
        if (normalizeSegments.value) {
          source.start(col * stepDuration);
        } else {
          source.start(col * stepDuration, segStart, duration);
        }
      }
    }
  }
  const renderedBuffer = await offlineCtx.startRendering();
  const wavBlob = encodeWAV(renderedBuffer);
  const url = URL.createObjectURL(wavBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sequencer_export.wav';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
}
// Built-in loops (update this list if you add more files to public/loops)
const builtinLoops = [
  { label: 'Acoustic Drums', value: '/soundchopper/loops/acousticdrums1.mp3' },
  { label: 'Acoustic Drums 2', value: '/soundchopper/loops/acousticdrums2.mp3' },
  { label: 'Beatbox', value: '/soundchopper/loops/beatbox.mp3' },
  { label: 'Ping Pong', value: '/soundchopper/loops/ping pong.mp3' },
  { label: 'track1', value: '/soundchopper/loops/track1.mp3' },
  { label: 'track2', value: '/soundchopper/loops/track2.mp3' },
];
const selectedLoop = ref("");

function onSelectLoop(e) {
  stopAllSound();
  const url = selectedLoop.value;
  if (!url) return;
  loading.value = true;
  // Simulate a file input event with the selected URL
  audioUrl.value = url;
  fetch(url)
    .then(res => res.arrayBuffer())
    .then(arrayBuffer => {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      return audioCtx.decodeAudioData(arrayBuffer);
    })
    .then(buffer => {
      audioBuffer = buffer;
      // Try to detect BPM from buffer if enabled
      if (guessBpmOnImport.value) {
        let detectedBpm = detectBpmFromBuffer(buffer);
        if (detectedBpm && detectedBpm >= 40 && detectedBpm <= 300) {
          bpm.value = Math.min(detectedBpm, 200);
        }
      }
      getWaveformData(url).then(data => {
        waveform.value = data;
        updateTransients();
        loading.value = false;
      });
    });
}
// When transients change, reset enabled state (all enabled by default)
watch(transients, (newTrans) => {
  segmentEnabled.value = Array(Math.max(0, newTrans.length - 1)).fill(true);
});

// Helper: get enabled segment indices
const enabledSegmentIndices = computed(() => segmentEnabled.value
  .map((enabled, i) => enabled ? i : null)
  .filter(i => i !== null));

// Patch playSequencer to use enabled segments
function playSequencer() {
  if (!audioBuffer || !audioCtx) return;
  isPlaying.value = true;
  currentStep.value = -1;
  let step = 0;
  const nRows = sequencer.value.length;
  const nSteps = patternLength.value;
  const baseStepDuration = 60 / effectiveBpm.value / 2;
  currentSwingFrac = swing.value / 100;

  function scheduleStep() {
    if (!isPlaying.value) return;
    currentStep.value = step;
    for (let row = 0; row < nRows; row++) {
      if (sequencer.value[row] && sequencer.value[row][step]) {
        playSection(row);
      }
    }
    // Calculate delay for next step using current swing value
    let stepDelay = baseStepDuration;
    // Odd steps (2nd, 4th, etc) are delayed by swing amount
    if (step % 2 === 1) {
      stepDelay = baseStepDuration * (1 + currentSwingFrac);
    } else if (step % 2 === 0) {
      // Even steps after a swung odd step are shortened to keep the bar length
      stepDelay = baseStepDuration * (1 - currentSwingFrac);
    }
    step = (step + 1) % nSteps;
    sequencerInterval = setTimeout(scheduleStep, stepDelay * 1000);
  }
  scheduleStep();
}

// Patch isCellPlaying/isRowPlaying to use enabled segments

// Right-click waveform segment to toggle enabled/disabled
function toggleSegmentEnabled(idx, e) {
  e.preventDefault();
  if (idx < 0 || idx >= segmentEnabled.value.length) return;
  segmentEnabled.value[idx] = !segmentEnabled.value[idx];
  // If disabling, clear all cells in that row
  if (!segmentEnabled.value[idx] && sequencer.value[idx]) {
    for (let col = 0; col < sequencer.value[idx].length; col++) {
      sequencer.value[idx][col] = false;
    }
  }
  // If playing, stop and restart sequencer to avoid index mismatches
  if (isPlaying.value) {
    stopSequencer();
    playSequencer();
  }
}
function playFullSample() {
  if (!audioBuffer || !audioCtx) return;
  stopFullSample();
  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination);
  source.onended = () => {
    isFullSamplePlaying.value = false;
    if (audioCtx._currentSource === source) audioCtx._currentSource = null;
  };
  source.start(0);
  audioCtx._currentSource = source;
  isFullSamplePlaying.value = true;
}
// If user triggers other playback, stop full sample play state
watch(isPlaying, (val) => { if (val) stopFullSample(); });
onUnmounted(() => { stopFullSample(); });
const bpmInput = computed({
  get() {
    return bpm.value;
  },
  set(val) {
    bpm.value = val;
  }
});
const effectiveBpm = computed(() => bpmDouble.value ? bpm.value * 2 : bpm.value);
function halvePatternLength() {
  if (patternLength.value > 1) {
    patternLength.value = Math.max(1, Math.floor(patternLength.value / 2));
  }
}

function doublePatternLength() {
  if (patternLength.value >= 64) return;
  const oldLength = patternLength.value;
  const newLength = Math.min(64, oldLength * 2);
  // For each row, repeat the pattern in the new columns
  for (let row = 0; row < sequencer.value.length; row++) {
    const oldRow = sequencer.value[row].slice(0, oldLength);
    sequencer.value[row] = oldRow.concat(oldRow.slice(0, newLength - oldLength));
  }
  patternLength.value = newLength;
}

function resizeSequencerColumns() {
  for (let row = 0; row < sequencer.value.length; row++) {
    const oldRow = sequencer.value[row];
    if (oldRow.length > patternLength.value) {
      sequencer.value[row] = oldRow.slice(0, patternLength.value);
    } else if (oldRow.length < patternLength.value) {
      sequencer.value[row] = oldRow.concat(Array(patternLength.value - oldRow.length).fill(false));
    }
  }
}

watch(patternLength, () => {
  resizeSequencerColumns();
  if (isPlaying.value && currentStep.value >= patternLength.value) {
    stopSequencer();
    playSequencer();
  }
});
function rotateSequencerLeft() {
  const nRows = sequencer.value.length;
  if (nRows === 0) return;
  for (let row = 0; row < nRows; row++) {
    const first = sequencer.value[row][0];
    for (let col = 0; col < patternLength.value - 1; col++) {
      sequencer.value[row][col] = sequencer.value[row][col + 1];
    }
    sequencer.value[row][patternLength.value - 1] = first;
  }
}

function rotateSequencerRight() {
  const nRows = sequencer.value.length;
  if (nRows === 0) return;
  for (let row = 0; row < nRows; row++) {
    const last = sequencer.value[row][patternLength.value - 1];
    for (let col = patternLength.value - 1; col > 0; col--) {
      sequencer.value[row][col] = sequencer.value[row][col - 1];
    }
    sequencer.value[row][0] = last;
  }
}
const playingSectionBounds = computed(() => {
  if (!isPlaying.value || currentStep.value < 0 || sequencer.value.length === 0) return null;
  // Find the first row with an active cell at currentStep
  let rowIdx = -1;
  for (let r = 0; r < sequencer.value.length; r++) {
    if (sequencer.value[r][currentStep.value]) {
      rowIdx = r;
      break;
    }
  }
  if (rowIdx === -1 || transients.value.length < 2) return null;
  const startIdx = transients.value[rowIdx];
  const endIdx = transients.value[rowIdx + 1];
  const x = (startIdx / (waveform.value.length - 1)) * svgWidth;
  const width = ((endIdx - startIdx) / (waveform.value.length - 1)) * svgWidth;
  return { x, width };
});

const isCellPlaying = (rowIdx, colIdx) => currentStep.value === colIdx && sequencer.value[rowIdx][colIdx];
const isRowPlaying = (rowIdx) => currentStep.value >= 0 && sequencer.value[rowIdx][currentStep.value];
const patternDensity = ref(100); // percent chance for a column to get 1 square

function randomizeSequencer() {
  const nRows = sequencer.value.length;
  for (let col = 0; col < patternLength.value; col++) {
    if (columnLocks.value[col]) continue; // skip locked columns
    // Use patternDensity to decide if this column gets an active cell
    const hasActive = Math.random() < (patternDensity.value / 100);
    const activeRow = hasActive ? Math.floor(Math.random() * nRows) : -1;
    for (let row = 0; row < nRows; row++) {
      sequencer.value[row][col] = (row === activeRow);
    }
  }
}
function clearCell(row, col) {
  if (row >= 0 && row < sequencer.value.length && col >= 0 && col < sequencer.value[row].length) {
    sequencer.value[row][col] = false;
  }
}


function initSequencer() {
  // Only include enabled segments
  const nRows = segmentEnabled.value.filter(Boolean).length;
  sequencer.value = Array.from({ length: nRows }, () => Array(patternLength.value).fill(false));
}

// Restart sequencer with new BPM if changed while playing
watch(bpm, (newBpm, oldBpm) => {
  if (isPlaying.value) {
    stopSequencer();
    playSequencer();
  }
});
// Also restart sequencer if bpmDouble changes
watch(bpmDouble, (newVal, oldVal) => {
  if (isPlaying.value && newVal !== oldVal) {
    stopSequencer();
    playSequencer();
  }
});
const normalizeSegments = ref(false);

// Watch for changes in transients to re-init sequencer
watch(transients, (newTrans, oldTrans) => {
  const newRows = Math.max(0, newTrans.length - 1);
  const oldRows = oldTrans ? Math.max(0, oldTrans.length - 1) : 0;
  if (newRows !== oldRows) {
    initSequencer();
  }
});

function toggleCell(row, col) {
  if (col >= patternLength.value) return;
  // If already active, turn it off
  if (sequencer.value[row][col]) {
    sequencer.value[row][col] = false;
    return;
  }
  // Turn on only this cell in this column (classic behavior)
  for (let r = 0; r < sequencer.value.length; r++) {
    if (col < sequencer.value[r].length) {
      sequencer.value[r][col] = false;
    }
  }
  sequencer.value[row][col] = true;
}

function toggleSequencerPlay() {
  if (isPlaying.value) {
    stopSequencer();
  } else {
    playSequencer();
  }
}

function stopSequencer() {
  isPlaying.value = false;
  currentStep.value = -1;
  if (sequencerInterval) clearTimeout(sequencerInterval);
  if (activeSources && activeSources.length) {
    for (const src of activeSources) {
      src.stop();
    }
    activeSources = [];
  }
}

onUnmounted(() => {
  stopSequencer();
});

function playSection(rowIdx) {
  if (!audioBuffer || !audioCtx || transients.value.length < 2) return;
  const startIdx = transients.value[rowIdx];
  const endIdx = transients.value[rowIdx + 1];
  const segStart = (startIdx / (waveform.value.length - 1)) * audioBuffer.duration;
  const segEnd = (endIdx / (waveform.value.length - 1)) * audioBuffer.duration;
  const duration = Math.max(0.1, segEnd - segStart);
  // Stop previous source if any
  if (audioCtx._currentSource) {
    try { audioCtx._currentSource.stop(); } catch { }
  }
  let source;
  let gainNode = audioCtx.createGain();
  activeSources = activeSources.filter(src => src && typeof src.stop === 'function');
  const FADE_MS = 0.008; // 8 ms fade-out
  if (normalizeSegments.value) {
    // Create a new buffer for the segment and normalize it
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const segLength = Math.floor(duration * sampleRate);
    const segmentBuffer = audioCtx.createBuffer(numChannels, segLength, sampleRate);
    for (let ch = 0; ch < numChannels; ch++) {
      const src = audioBuffer.getChannelData(ch);
      const dst = segmentBuffer.getChannelData(ch);
      const startSample = Math.floor(segStart * sampleRate);
      const endSample = Math.min(startSample + segLength, src.length);
      let max = 0;
      for (let i = startSample; i < endSample; i++) {
        if (Math.abs(src[i]) > max) max = Math.abs(src[i]);
      }
      const norm = max > 0 ? 1 / max : 1;
      for (let i = 0; i < segLength && (startSample + i) < src.length; i++) {
        dst[i] = src[startSample + i] * norm;
      }
    }
    source = audioCtx.createBufferSource();
    source.buffer = segmentBuffer;
    source.playbackRate.value = playbackSpeed.value;
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    // Fade out at end
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration - FADE_MS + FADE_MS);
    source.start(0);
  } else {
    source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = playbackSpeed.value;
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    // Fade out at end
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration - FADE_MS + FADE_MS);
    source.start(0, segStart, duration);
  }
  audioCtx._currentSource = source;
  if (source) activeSources.push(source);
}

function onFileChange(e) {
  stopAllSound();
  const file = e.target.files[0];
  if (!file) return;
  loading.value = true;
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value);
    audioUrl.value = null;
  }
  const url = URL.createObjectURL(file);
  audioUrl.value = url;
  // Decode audio to AudioBuffer for segment playback
  fetch(url)
    .then(res => res.arrayBuffer())
    .then(arrayBuffer => {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      return audioCtx.decodeAudioData(arrayBuffer);
    })
    .then(buffer => {
      audioBuffer = buffer;
      // Try to detect BPM from buffer
      if (guessBpmOnImport.value) {
        let detectedBpm = detectBpmFromBuffer(buffer);
      }
      // Get waveform and transients
      getWaveformData(url).then(data => {
        waveform.value = data;
        updateTransients();
        loading.value = false;
      });
    });
}

function updateTransients(debug = true) {
  if (!waveform.value.length) return;
  // new multi-feature transient detection
  // transients.value = detectTransientsMultiFeature(waveform.value, {
  //   frameSize: 128,
  //   hopSize: 64,
  //   ampWeight: 1.0,
  //   fluxWeight: 1.0,
  //   zcrWeight: 0.5,
  //   threshold: sensitivity.value, // sensitivity slider controls threshold
  //   minGap: 5
  // });
  transients.value = detectAdjustedTransients(waveform.value, sensitivity.value, 5);
  if (transients.value.length) {
    const xs = transients.value.map(idx => (idx / (waveform.value.length - 1)) * svgWidth);
    if (debug) console.log('Transients detected:', xs);
  } else {
    if (debug) console.warn('No transients detected. Try lowering the threshold or using a more percussive audio file.');
  }
}

function increaseSensitivity() {
  sensitivity.value = Math.min(1, sensitivity.value + 0.02);
  updateTransients();
}
function decreaseSensitivity() {
  sensitivity.value = Math.max(0.01, sensitivity.value - 0.02);
  updateTransients();
}

function playAudio(event) {
  if (!audioBuffer || !audioCtx) return;
  // Only handle clicks when there are no transients (single region)
  if (!(transients.value.length > 1)) {
    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percent = x / svgWidth;
    const startTime = percent * audioBuffer.duration;
    const segStart = startTime;
    const segEnd = Math.min(audioBuffer.duration, segStart + 0.25);
    let highlightX = percent * svgWidth;
    let highlightWidth = ((segEnd - segStart) / audioBuffer.duration) * svgWidth;
    if (audioCtx._currentSource) {
      try { audioCtx._currentSource.stop(); } catch { }
    }
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    source.onended = () => { clickedSectionHighlight.value = null; };
    source.start(0, segStart, segEnd - segStart);
    audioCtx._currentSource = source;
    clickedSectionHighlight.value = { x: highlightX, width: highlightWidth };
  }
}

const waveformPoints = computed(() => {
  if (!waveform.value.length) return '';
  return waveform.value.map((v, i) => {
    const x = (i / (waveform.value.length - 1)) * svgWidth;
    const y = svgHeight - v * svgHeight;
    return `${x},${y}`;
  }).join(' ');
});
</script>