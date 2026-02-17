import { isIOSDevice } from '@/lib/utils/platform';

type VideoRecordingType = {
  mimeType?: string;
  extension: string;
};

const VIDEO_RECORDING_TYPES: VideoRecordingType[] = [
  { mimeType: 'video/mp4;codecs=h264,aac', extension: 'mp4' },
  { mimeType: 'video/mp4', extension: 'mp4' },
  { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
  { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
  { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
  { mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
  { mimeType: 'video/webm', extension: 'webm' }
];

function selectVideoType(): VideoRecordingType {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return { extension: 'webm' };
  }

  for (const candidate of VIDEO_RECORDING_TYPES) {
    if (candidate.mimeType && MediaRecorder.isTypeSupported(candidate.mimeType)) {
      return candidate;
    }
  }

  return { extension: 'webm' };
}

export async function captureVideo(
  canvas: HTMLCanvasElement,
  durationSeconds: number,
  options: {
    fps?: number;
    audioStream?: MediaStream | null;
    videoBitsPerSecond?: number;
    audioBitsPerSecond?: number;
  } = {}
): Promise<Blob | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  if (isIOSDevice()) {
    return null;
  }

  if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) {
    return null;
  }

  const canvasStream = canvas.captureStream(options.fps ?? 30);
  const audioTracks = options.audioStream?.getAudioTracks() ?? [];
  const mergedStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
  if (mergedStream.getVideoTracks().length === 0) {
    return null;
  }

  const videoType = selectVideoType();
  const recorderOptions: MediaRecorderOptions = {
    mimeType: videoType.mimeType
  };
  if (typeof options.videoBitsPerSecond === 'number' && Number.isFinite(options.videoBitsPerSecond)) {
    recorderOptions.videoBitsPerSecond = Math.max(1, Math.floor(options.videoBitsPerSecond));
  }
  if (typeof options.audioBitsPerSecond === 'number' && Number.isFinite(options.audioBitsPerSecond)) {
    recorderOptions.audioBitsPerSecond = Math.max(1, Math.floor(options.audioBitsPerSecond));
  }

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(mergedStream, recorderOptions);
  } catch (_error) {
    try {
      const fallbackOptions: MediaRecorderOptions = {};
      if (typeof recorderOptions.videoBitsPerSecond === 'number') {
        fallbackOptions.videoBitsPerSecond = recorderOptions.videoBitsPerSecond;
      }
      if (typeof recorderOptions.audioBitsPerSecond === 'number') {
        fallbackOptions.audioBitsPerSecond = recorderOptions.audioBitsPerSecond;
      }
      recorder = new MediaRecorder(mergedStream, fallbackOptions);
    } catch (_bitrateFallbackError) {
      try {
        recorder = new MediaRecorder(mergedStream);
      } catch (_finalFallbackError) {
        mergedStream.getTracks().forEach((track) => track.stop());
        return null;
      }
    }
  }

  const chunks: Blob[] = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  try {
    recorder.start();
  } catch (_error) {
    mergedStream.getTracks().forEach((track) => track.stop());
    return null;
  }

  return new Promise((resolve) => {
    const stopTimer = window.setTimeout(() => {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    }, durationSeconds * 1000);

    recorder.onerror = () => {
      window.clearTimeout(stopTimer);
      mergedStream.getTracks().forEach((track) => track.stop());
      resolve(null);
    };

    recorder.onstop = () => {
      window.clearTimeout(stopTimer);
      mergedStream.getTracks().forEach((track) => track.stop());
      resolve(new Blob(chunks, { type: recorder.mimeType || videoType.mimeType || 'video/webm' }));
    };
  });
}
