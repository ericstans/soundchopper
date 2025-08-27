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
    </svg>
    <div v-if="transients.length > 1" class="sequencer">
      <div
        v-for="(row, rowIdx) in sequencer.length"
        :key="'row-' + rowIdx"
        class="sequencer-row"
      >
        <div
          v-for="(cell, colIdx) in sequencer[rowIdx]"
          :key="'cell-' + rowIdx + '-' + colIdx"
          class="sequencer-cell"
          :class="{ active: cell }"
          @click="toggleCell(rowIdx, colIdx)"
        ></div>
      </div>
      <div style="margin-top:1rem; display: flex; align-items: center; justify-content: center; gap: 1.5rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <label for="bpm-input" style="font-size:1em;">BPM</label>
          <input id="bpm-input" type="number" v-model.number="bpm" min="40" max="300" step="1" style="width: 60px; font-size:1em; padding:0.2em 0.5em;" />
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <label for="density-slider" style="font-size:1em;">Pattern density</label>
          <input id="density-slider" type="range" min="0" max="100" v-model.number="patternDensity" style="width: 80px;" />
          <span>{{ patternDensity }}%</span>
        </div>
        <button @click="randomizeSequencer" style="font-size:1.1em; padding:0.5em 1em; margin-right:1em;">
          Random
        </button>
        <button @click="toggleSequencerPlay" style="font-size:1.1em; padding:0.5em 1.5em;">
          {{ isPlaying ? 'Stop' : 'Play' }}
        </button>
      </div>
    </div>
  </div>
</template>
<script setup>
const patternDensity = ref(100); // percent chance for a column to get 1 square

function randomizeSequencer() {
  const nRows = sequencer.value.length;
  for (let col = 0; col < 8; col++) {
    // Use patternDensity to decide if this column gets an active cell
    const hasActive = Math.random() < (patternDensity.value / 100);
    const activeRow = hasActive ? Math.floor(Math.random() * nRows) : -1;
    for (let row = 0; row < nRows; row++) {
      sequencer.value[row][col] = (row === activeRow);
    }
  }
}
const bpm = ref(120);
import { ref, computed, onUnmounted, watch } from 'vue';
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
  sequencer.value = Array.from({ length: nRows }, () => Array(8).fill(false));
}

// Watch for changes in transients to re-init sequencer
watch(transients, (newTrans, oldTrans) => {
  const newRows = Math.max(0, newTrans.length - 1);
  const oldRows = oldTrans ? Math.max(0, oldTrans.length - 1) : 0;
  if (newRows !== oldRows) {
    initSequencer();
  }
});

function toggleCell(row, col) {
  sequencer.value[row][col] = !sequencer.value[row][col];
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
  const nSteps = 8;
  const nRows = sequencer.value.length;
  // Each step is now an 8th note: 1 beat = 2 steps
  const stepDuration = 60 / bpm.value / 2; // seconds per 8th note
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
  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination);
  source.start(0, segStart, duration);
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
</style>