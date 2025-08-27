// This script should be run on the server to generate a list of mp3 files in /public/mp3s
// and cache waveform arrays for each file in index.json
const fs = require('fs');
const path = require('path');
const audioDecode = require('audio-decode').default;
const fetch = require('node-fetch');
const { Readable } = require('stream');

const SAMPLES = 150;
const mp3Dir = path.join(__dirname, '../public/mp3s');
const outFile = path.join(mp3Dir, 'index.json');

async function getWaveformDataNode(filePath) {
	// Read file as buffer
	const buffer = fs.readFileSync(filePath);
	// Decode audio (returns AudioBuffer)
	const audioBuffer = await audioDecode(buffer);
	const rawData = audioBuffer.getChannelData(0);
	const blockSize = Math.floor(rawData.length / SAMPLES);
	const waveform = [];
	for (let i = 0; i < SAMPLES; i++) {
		let sum = 0;
		for (let j = 0; j < blockSize; j++) {
			sum += Math.abs(rawData[i * blockSize + j]);
		}
		waveform.push(sum / blockSize);
	}
	// Normalize
	const max = Math.max(...waveform);
	return waveform.map(n => n / max);
}

async function main() {
	const files = fs.readdirSync(mp3Dir).filter(f => f.endsWith('.mp3'));
	const out = [];
	for (const file of files) {
		const filePath = path.join(mp3Dir, file);
		try {
			const waveform = await getWaveformDataNode(filePath);
			out.push({ file, waveform });
			console.log('Processed', file);
		} catch (e) {
			console.error('Error processing', file, e);
			out.push({ file, waveform: null });
		}
	}
	fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
	console.log('Wrote', outFile);
}

main();
