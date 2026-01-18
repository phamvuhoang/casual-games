import { describe, expect, it } from 'vitest';
import { getPinchStrength, isPalmFacingCamera, isPalmUp } from '../services/handUtils';

const makeLandmarks = () => Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));

const withPoint = (landmarks: { x: number; y: number; z: number }[], index: number, x: number, y: number, z: number) => {
  landmarks[index] = { x, y, z };
};

describe('handUtils', () => {
  it('detects palm up based on middle tip height', () => {
    const landmarks = makeLandmarks();
    withPoint(landmarks, 0, 0, 0.6, 0); // wrist
    withPoint(landmarks, 12, 0, 0.2, 0); // middle tip above wrist
    expect(isPalmUp(landmarks)).toBe(true);

    withPoint(landmarks, 12, 0, 0.8, 0); // middle tip below wrist
    expect(isPalmUp(landmarks)).toBe(false);
  });

  it('computes pinch strength from thumb-index distance', () => {
    const landmarks = makeLandmarks();
    withPoint(landmarks, 4, 0, 0, 0);
    withPoint(landmarks, 8, 0, 0, 0);
    expect(getPinchStrength(landmarks)).toBeCloseTo(1, 2);

    withPoint(landmarks, 8, 0.2, 0.2, 0.2);
    expect(getPinchStrength(landmarks)).toBeLessThan(0.2);
  });

  it('detects palm facing camera by handedness', () => {
    const landmarks = makeLandmarks();
    withPoint(landmarks, 0, 0, 0, 0); // wrist
    withPoint(landmarks, 5, 1, 0, 0); // index mcp
    withPoint(landmarks, 17, 0, 1, 0); // pinky mcp
    expect(isPalmFacingCamera(landmarks, 'Right')).toBe(true);
    expect(isPalmFacingCamera(landmarks, 'Left')).toBe(false);

    withPoint(landmarks, 5, 0, 1, 0);
    withPoint(landmarks, 17, 1, 0, 0);
    expect(isPalmFacingCamera(landmarks, 'Left')).toBe(true);
  });
});
