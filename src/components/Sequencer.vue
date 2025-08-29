<template>
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
		<div class="sequencer-control-row">
      <div class="sequencer-rotate-col">
        <button class="rotate-btn halve-btn" @click="halvePatternLength" title="Halve pattern length">÷2</button>
      </div>
			<div class="sequencer-rotate-col">
				<button class="rotate-btn" @click="rotateSequencerLeft" title="Rotate Left">&lt;</button>
				<button class="rotate-btn" @click="removeOneColumn" title="Remove one column">-</button>
			</div>
			<button class="circle-play-btn sequencer-play-btn" @click="toggleSequencerPlay"
				:title="isPlaying ? 'Pause' : 'Play'">
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
				<button class="rotate-btn" @click="addOneColumn" title="Add one column">+</button>
			</div>
      <div class="sequencer-rotate-col">
        <button class="rotate-btn double-btn" @click="doublePatternLength" title="Double pattern length">×2</button>
      </div>
		</div>
	</div>
</template>
<script setup>
import './sequencer.css';
import { ref, computed, watch, onUnmounted } from 'vue';
const { transients, patternLength, segmentEnabled, sequencer, columnLocks, isPlaying, currentStep } = defineProps({
	transients: Array,
	patternLength: Number,
	segmentEnabled: Array,
	sequencer: Array,
	columnLocks: Array,
	isPlaying: Boolean,
	currentStep: Number,
});
const emit = defineEmits([
	'cellMouseDown',
	'cellMouseEnter',
	'cellMouseUp',
	'clearCell',
	'toggleColumnLock',
	'rotateSequencerLeft',
	'rotateSequencerRight',
	'doublePatternLength',
	'halvePatternLength',
	'randomizeSequencer',
	'toggleSequencerPlay',
	'addOneColumn',
	'removeOneColumn',
]);
function onCellMouseDown(row, col, e) { emit('cellMouseDown', row, col, e); }
function onCellMouseEnter(row, col, e) { emit('cellMouseEnter', row, col, e); }
function onCellMouseUp(row, col, e) { emit('cellMouseUp', row, col, e); }
function clearCell(row, col) { emit('clearCell', row, col); }
function toggleColumnLock(colIdx) { emit('toggleColumnLock', colIdx); }
function rotateSequencerLeft() { emit('rotateSequencerLeft'); }
function rotateSequencerRight() { emit('rotateSequencerRight'); }
function doublePatternLength() { emit('doublePatternLength'); }
function halvePatternLength() { emit('halvePatternLength'); }
function randomizeSequencer() { emit('randomizeSequencer'); }
function toggleSequencerPlay() { emit('toggleSequencerPlay'); }
function isCellPlaying(rowIdx, colIdx) { return currentStep === colIdx && sequencer[rowIdx][colIdx]; }
function isRowPlaying(rowIdx) { return currentStep >= 0 && sequencer[rowIdx][currentStep]; }

function addOneColumn() { emit('addOneColumn'); }
function removeOneColumn() { emit('removeOneColumn'); }
</script>

