<template>
  <div class="waveform-loader">
  <input type="file" accept="audio/mp3,audio/wav" @change="onFileChange" />
  <div v-if="waveform.length" style="margin: 1rem 0; display: flex; align-items: center; gap: 1rem;">
    <span>Sensitivity</span>
    <button @click="decreaseSensitivity">-</button>
    <span>{{ sensitivity.toFixed(2) }}</span>
    <button @click="increaseSensitivity">+</button>
  </div>
    <div v-if="loading">Loading...</div>
  <svg v-if="waveform.length" :width="svgWidth" :height="svgHeight" class="waveform-svg" @click="playAudio">
      <polyline
        :points="waveformPoints"
        fill="none"
        stroke="#42b983"
        stroke-width="2"
      />
      <g v-for="idx in transients" :key="idx">
        <line
          :x1="(idx / (waveform.length - 1)) * svgWidth"
          y1="0"
          :x2="(idx / (waveform.length - 1)) * svgWidth"
          :y2="svgHeight"
          stroke="#ff5252"
          stroke-width="2"
          stroke-dasharray="4,2"
        />
      </g>
      <!-- Highlight currently playing waveform section -->
      <rect
        v-if="isPlaying && currentStep.value >= 0 && playingSectionBounds"
        :x="playingSectionBounds.x"
        y="0"
        :width="playingSectionBounds.width"
        :height="svgHeight"
        fill="#42b983"
        fill-opacity="0.18"
        stroke="#42b983"
        stroke-width="2"
        pointer-events="none"
      />
    </svg>
    <div v-if="transients.length > 1" class="sequencer">
      <div
        v-for="(row, rowIdx) in sequencer.length"
        :key="'row-' + rowIdx"
        class="sequencer-row"
        :class="{ 'playing-row': isPlaying && isRowPlaying(rowIdx) }"
      >
        <div
          v-for="(cell, colIdx) in sequencer[rowIdx]"
          :key="'cell-' + rowIdx + '-' + colIdx"
          class="sequencer-cell"
          :class="{ active: cell, playing: isPlaying && isCellPlaying(rowIdx, colIdx) }"
          @click="toggleCell(rowIdx, colIdx)"
        ></div>
      </div>
      <div class="sequencer-rotate-row" style="display: flex; justify-content: center; align-items: center; margin: 0.5rem 0 0.5rem 0; gap: 4px;">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
          <button class="rotate-btn" @click="rotateSequencerLeft" title="Rotate Left" style="width:32px;">&lt;</button>
          <button class="rotate-btn" @click="halvePatternLength" title="Halve pattern length" style="width:32px; font-size:1.2em;">-</button>
        </div>
        <button class="sequencer-play-btn" @click="toggleSequencerPlay" style="font-size:2.2em; padding:0.1em 0.3em; margin: 0 8px; background: none; color: #42b983; border: none; box-shadow: none; cursor: pointer;">
          <span v-if="!isPlaying">▶️</span>
          <span v-else>⏸️</span>
        </button>
        <button @click="randomizeSequencer" title="Randomize pattern" style="font-size:2em; background: none; color: #42b983; border: none; cursor: pointer;">
          🎲
        </button>
        <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
          <button class="rotate-btn" @click="rotateSequencerRight" title="Rotate Right" style="width:32px;">&gt;</button>
          <button class="rotate-btn" @click="doublePatternLength" title="Double pattern length" style="width:32px; font-size:1.2em;">+</button>
        </div>
      </div>
      <div class="controls" style="margin-top:1rem;  align-items: center; justify-content: center; gap: 1.5rem;">
        <div class="controls-row">
          <!-- Random button moved to sequencer-rotate-row above -->
          <label style="display: flex; align-items: center; gap: 0.3em; font-size: 1em;">
            <input type="checkbox" v-model="normalizeSegments" />
            Normalize segments
          </label>
          <!-- Play/Stop button moved to sequencer-rotate-row above -->
        </div>
        <div class="controls-row">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <label for="bpm-input" style="font-size:1em;">BPM</label>
            <input id="bpm-input" type="number" v-model.number="bpmInput" min="40" max="300" step="1" style="width: 60px; font-size:1em; padding:0.2em 0.5em;" />
            <label style="display: flex; align-items: center; gap: 0.2em; font-size: 0.95em; margin-left: 0.5em;">
              <input type="checkbox" v-model="bpmDouble" style="margin-left: 0.5em;" />
              x2
            </label>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <label for="density-slider" style="font-size:1em;">Pattern density</label>
            <input id="density-slider" type="range" min="0" max="100" v-model.number="patternDensity" style="width: 80px;" />
            <span>{{ patternDensity }}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
const patternLength = ref(8);

const bpmDouble = ref(false);
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
    // Use patternDensity to decide if this column gets an active cell
    const hasActive = Math.random() < (patternDensity.value / 100);
    const activeRow = hasActive ? Math.floor(Math.random() * nRows) : -1;
    for (let row = 0; row < nRows; row++) {
      sequencer.value[row][col] = (row === activeRow);
    }
  }
}
const bpm = ref(120);
import { ref, computed, onUnmounted, watch, nextTick } from 'vue';
import { getWaveformData } from '../utils/waveform.js';
import { detectTransients } from '../utils/transient.js';
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
const sequencer = ref([]);

function initSequencer() {
  const nRows = Math.max(0, transients.value.length - 1);
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
  // Turn off all other cells in this column
  for (let r = 0; r < sequencer.value.length; r++) {
    if (col < sequencer.value[r].length) {
      sequencer.value[r][col] = false;
    }
  }
  // Toggle the clicked cell
  sequencer.value[row][col] = true;
}

function toggleSequencerPlay() {
  if (isPlaying.value) {
    stopSequencer();
  } else {
    playSequencer();
  }
}

function playSequencer() {
  if (!audioBuffer || !audioCtx) return;
  isPlaying.value = true;
  currentStep.value = -1;
  let step = 0;
  const nSteps = patternLength.value;
  const nRows = sequencer.value.length;
  // Each step is now an 8th note: 1 beat = 2 steps
  const stepDuration = 60 / effectiveBpm.value / 2; // seconds per 8th note
  sequencerInterval = setInterval(() => {
    currentStep.value = step;
    for (let row = 0; row < nRows; row++) {
      if (sequencer.value[row][step]) {
        // Play section for this row
        playSection(row);
      }
    }
    step = (step + 1) % nSteps;
  }, stepDuration * 1000);
}

function stopSequencer() {
  isPlaying.value = false;
  currentStep.value = -1;
  if (sequencerInterval) clearInterval(sequencerInterval);
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
    try { audioCtx._currentSource.stop(); } catch {}
  }
  let source;
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
    source.connect(audioCtx.destination);
    source.start(0);
  } else {
    source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    source.start(0, segStart, duration);
  }
  audioCtx._currentSource = source;
}

function onFileChange(e) {
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
      // Get waveform and transients
      getWaveformData(url).then(data => {
        waveform.value = data;
        updateTransients();
        loading.value = false;
      });
    });
}

function updateTransients() {
  if (!waveform.value.length) return;
  transients.value = detectTransients(waveform.value, sensitivity.value, 5);
  console.log('Transients detected:', transients.value);
  if (transients.value.length) {
    const xs = transients.value.map(idx => (idx / (waveform.value.length - 1)) * svgWidth);
    console.log('Transient X positions:', xs);
  } else {
    console.warn('No transients detected. Try lowering the threshold or using a more percussive audio file.');
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
  // Get click X position relative to SVG
  const rect = event.target.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const percent = x / svgWidth;
  const startTime = percent * audioBuffer.duration;
  // Find nearest transient before and after
  let segStart = 0;
  let segEnd = audioBuffer.duration;
  if (transients.value.length > 1) {
    const idx = Math.floor(percent * (waveform.value.length - 1));
    // Find the closest transient before idx
    let prev = 0, next = waveform.value.length - 1;
    for (let i = 0; i < transients.value.length; i++) {
      if (transients.value[i] <= idx) prev = transients.value[i];
      if (transients.value[i] > idx) { next = transients.value[i]; break; }
    }
    segStart = (prev / (waveform.value.length - 1)) * audioBuffer.duration;
    segEnd = (next / (waveform.value.length - 1)) * audioBuffer.duration;
    // Minimum segment length
    if (segEnd - segStart < 0.1) segEnd = segStart + 0.25;
  } else {
    segStart = startTime;
    segEnd = Math.min(audioBuffer.duration, segStart + 0.25);
  }
  // Stop previous source if any
  if (audioCtx._currentSource) {
    try { audioCtx._currentSource.stop(); } catch {}
  }
  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination);
  source.start(0, segStart, segEnd - segStart);
  audioCtx._currentSource = source;
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
<style scoped>
.rotate-btn {
  background: #222;
  color: #42b983;
  border: 1px solid #42b983;
  border-radius: 4px;
  font-size: 1.5em;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.rotate-btn:hover {
  background: #42b983;
  color: #fff;
}
.waveform-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 2rem;
}
.waveform-svg {
  margin-top: 1rem;
  background: #222;
  border-radius: 4px;
}

.sequencer {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}
.sequencer-row {
  display: flex;
  gap: 4px;
}
.sequencer-cell {
  width: 32px;
  height: 32px;
  background: #333;
  border: 1px solid #555;
  border-radius: 4px;
  transition: background 0.2s;
  cursor: pointer;
}
.sequencer-cell.active {
  background: #42b983;
  border-color: #42b983;
}
.sequencer-cell.playing {
  box-shadow: 0 0 0 3px #fff, 0 0 8px #42b983;
  background: #fff;
  border-color: #42b983;
}
.sequencer-row.playing-row {
  background: rgba(66,185,131,0.08);
  border-radius: 6px;
  transition: background 0.2s;
}
</style>