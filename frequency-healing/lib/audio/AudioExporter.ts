import * as Tone from 'tone/build/esm';

export type AudioExportFormat = 'webm' | 'wav';

export async function exportAudio(durationSeconds: number, format: AudioExportFormat = 'webm') {
  const recorder = new Tone.Recorder();
  Tone.Destination.connect(recorder);

  recorder.start();
  await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));

  const recording = await recorder.stop();
  Tone.Destination.disconnect(recorder);
  recorder.dispose();

  if (format === 'webm') {
    return {
      blob: recording,
      mimeType: recording.type || 'audio/webm',
      extension: 'webm'
    };
  }

  const wavBlob = await convertToWav(recording);
  return {
    blob: wavBlob,
    mimeType: 'audio/wav',
    extension: 'wav'
  };
}

async function convertToWav(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(buffer.slice(0));
  const wavBuffer = audioBufferToWav(audioBuffer);
  await audioContext.close();
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

function audioBufferToWav(audioBuffer: AudioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = audioBuffer.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i += 1) {
    for (let channel = 0; channel < numChannels; channel += 1) {
      const channelData = audioBuffer.getChannelData(channel);
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return buffer;
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}
