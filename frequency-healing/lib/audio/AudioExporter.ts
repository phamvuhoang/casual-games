import * as Tone from 'tone/build/esm';
import { MP3_MAX_BYTES } from '@/lib/utils/constants';

type RecordingType = {
  mimeType?: string;
  extension: string;
};

const AUDIO_RECORDING_TYPES: RecordingType[] = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/webm', extension: 'webm' },
  { mimeType: 'audio/mp4', extension: 'm4a' },
  { mimeType: 'audio/mpeg', extension: 'mp3' },
  { mimeType: 'audio/wav', extension: 'wav' }
];

function selectRecordingType(): RecordingType {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return { extension: 'webm' };
  }

  for (const candidate of AUDIO_RECORDING_TYPES) {
    if (candidate.mimeType && MediaRecorder.isTypeSupported(candidate.mimeType)) {
      return candidate;
    }
  }

  return { extension: 'webm' };
}

function extensionForMimeType(mimeType?: string, fallback = 'webm') {
  if (!mimeType) {
    return fallback;
  }
  if (mimeType.includes('webm')) {
    return 'webm';
  }
  if (mimeType.includes('mp4')) {
    return 'm4a';
  }
  if (mimeType.includes('mpeg')) {
    return 'mp3';
  }
  if (mimeType.includes('wav')) {
    return 'wav';
  }
  return fallback;
}

export type AudioExportFormat = 'webm' | 'wav' | 'mp3';

export type DestinationAudioCapture = {
  stream: MediaStream;
  disconnect: () => void;
};

export function createDestinationAudioCapture(): DestinationAudioCapture {
  const rawContext = Tone.getContext().rawContext;
  const realtimeContext = rawContext as AudioContext;
  if (typeof realtimeContext.createMediaStreamDestination !== 'function') {
    throw new Error('Audio capture stream is not supported in this browser.');
  }

  const destination = realtimeContext.createMediaStreamDestination();
  Tone.Destination.connect(destination);

  return {
    stream: destination.stream,
    disconnect: () => {
      try {
        Tone.Destination.disconnect(destination);
      } catch (_error) {
        // Ignore if the node was already disconnected.
      }

      destination.stream.getTracks().forEach((track) => track.stop());
    }
  };
}

export async function exportAudio(durationSeconds: number, format: AudioExportFormat = 'webm') {
  if (!Tone.Recorder.supported) {
    throw new Error('Audio recording is not supported in this browser.');
  }

  const recordingType = selectRecordingType();
  const recorder = new Tone.Recorder(recordingType.mimeType ? { mimeType: recordingType.mimeType } : undefined);
  Tone.Destination.connect(recorder);

  recorder.start();
  await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));

  const recording = await recorder.stop();
  Tone.Destination.disconnect(recorder);
  recorder.dispose();

  if (format === 'webm') {
    const resolvedMimeType = recording.type || recordingType.mimeType || 'audio/webm';
    return {
      blob: recording,
      mimeType: resolvedMimeType,
      extension: extensionForMimeType(resolvedMimeType, recordingType.extension)
    };
  }

  if (format === 'mp3') {
    const mp3Blob = await convertToMp3(recording);
    return {
      blob: mp3Blob,
      mimeType: 'audio/mpeg',
      extension: 'mp3'
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

async function convertToMp3(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(buffer.slice(0));
  await audioContext.close();

  const { Mp3Encoder } = await import('lamejs');
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const encoder = new Mp3Encoder(numChannels, sampleRate, 128);

  const left = floatTo16BitPCM(audioBuffer.getChannelData(0));
  const right = numChannels > 1 ? floatTo16BitPCM(audioBuffer.getChannelData(1)) : null;
  const blockSize = 1152;
  const mp3Data: Uint8Array[] = [];
  const bytesPerSample = 2;
  const estimatedBytes = left.length * bytesPerSample;

  if (estimatedBytes > MP3_MAX_BYTES) {
    throw new Error('MP3 export is limited to shorter sessions. Please choose WAV or reduce duration.');
  }

  for (let i = 0; i < left.length; i += blockSize) {
    const leftChunk = left.subarray(i, i + blockSize);
    const rightChunk = right ? right.subarray(i, i + blockSize) : undefined;
    const mp3buf = rightChunk ? encoder.encodeBuffer(leftChunk, rightChunk) : encoder.encodeBuffer(leftChunk);
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }
  }

  const end = encoder.flush();
  if (end.length > 0) {
    mp3Data.push(new Uint8Array(end));
  }

  const totalLength = mp3Data.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;

  mp3Data.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  });

  return new Blob([merged.buffer], { type: 'audio/mpeg' });
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

function floatTo16BitPCM(input: Float32Array) {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}
