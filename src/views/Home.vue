<template>
  <div class="waveform-loader">
  <input type="file" accept="audio/mp3,audio/wav" @change="onFileChange" />
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
  </div>
</template>
<script setup>

import { ref, computed } from 'vue';
import { getWaveformData } from '../utils/waveform.js';
import { detectTransients } from '../utils/transient.js';

const waveform = ref([]);
const loading = ref(false);
const svgWidth = 600;
const svgHeight = 100;
const audioUrl = ref(null);
let audio = null;
const transients = ref([]);

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
  getWaveformData(url).then(data => {
    waveform.value = data;
    transients.value = detectTransients(data);
    console.log('Transients detected:', transients.value);
    // Log computed X positions for debug
    if (transients.value.length) {
      const xs = transients.value.map(idx => (idx / (data.length - 1)) * svgWidth);
      console.log('Transient X positions:', xs);
    } else {
      console.warn('No transients detected. Try lowering the threshold or using a more percussive audio file.');
    }
    loading.value = false;
  });
}

function playAudio() {
  if (!audioUrl.value) return;
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  audio = new Audio(audioUrl.value);
  audio.play();
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
</style>