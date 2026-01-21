import * as Tone from 'tone/build/esm';

export async function exportAudio(durationSeconds: number) {
  const recorder = new Tone.Recorder();
  Tone.Destination.connect(recorder);

  recorder.start();
  await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));

  const recording = await recorder.stop();
  Tone.Destination.disconnect(recorder);
  recorder.dispose();

  return recording;
}
