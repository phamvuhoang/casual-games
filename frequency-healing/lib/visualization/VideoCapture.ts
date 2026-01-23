import { isIOSDevice } from '@/lib/utils/platform';

type VideoRecordingType = {
  mimeType?: string;
  extension: string;
};

const VIDEO_RECORDING_TYPES: VideoRecordingType[] = [
  { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
  { mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
  { mimeType: 'video/webm', extension: 'webm' },
  { mimeType: 'video/mp4', extension: 'mp4' }
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
  fps = 30
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

  const stream = canvas.captureStream(fps);
  const videoType = selectVideoType();
  const recorder = new MediaRecorder(
    stream,
    videoType.mimeType ? { mimeType: videoType.mimeType } : undefined
  );
  const chunks: Blob[] = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  recorder.start();
  await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));
  recorder.stop();

  return new Promise((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: videoType.mimeType || 'video/webm' }));
    };
  });
}
