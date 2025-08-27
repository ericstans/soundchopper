<template>
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
        :class="{ active: cell, playing: isPlaying && colIdx === currentStep }"
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
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue';
const props = defineProps({
  transients: Array,
  waveform: Array,
  audioBuffer: Object,
  audioCtx: Object,
});

const emit = defineEmits(['play-section']);

const bpm = ref(120);
const patternDensity = ref(100);
const isPlaying = ref(false);
const currentStep = ref(-1);
let sequencerInterval = null;
const sequencer = ref([]);

function initSequencer() {
  const nRows = Math.max(0, props.transients.length - 1);
  sequencer.value = Array.from({ length: nRows }, () => Array(8).fill(false));
}

watch(() => props.transients, (newTrans, oldTrans) => {
  const newRows = Math.max(0, newTrans.length - 1);
  const oldRows = oldTrans ? Math.max(0, oldTrans.length - 1) : 0;
  if (newRows !== oldRows) {
    initSequencer();
  }
});

function toggleCell(row, col) {
  sequencer.value[row][col] = !sequencer.value[row][col];
}

function randomizeSequencer() {
  const nRows = sequencer.value.length;
  for (let col = 0; col < 8; col++) {
    const hasActive = Math.random() < (patternDensity.value / 100);
    const activeRow = hasActive ? Math.floor(Math.random() * nRows) : -1;
    for (let row = 0; row < nRows; row++) {
      sequencer.value[row][col] = (row === activeRow);
    }
  }
}

function toggleSequencerPlay() {
  if (isPlaying.value) {
    stopSequencer();
  } else {
    playSequencer();
  }
}

function playSequencer() {
  if (!props.audioBuffer || !props.audioCtx) return;
  isPlaying.value = true;
  currentStep.value = -1;
  let step = 0;
  const nSteps = 8;
  const nRows = sequencer.value.length;
  const stepDuration = 60 / bpm.value / 2; // 8th note
  sequencerInterval = setInterval(() => {
    currentStep.value = step;
    for (let row = 0; row < nRows; row++) {
      if (sequencer.value[row][step]) {
        emit('play-section', row);
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
</script>

<style scoped>
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
  box-shadow: 0 0 0 2px #fff, 0 0 8px #42b983;
}
</style>
