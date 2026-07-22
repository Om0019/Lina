import { useEffect, useRef, useState } from 'react';
import { Accelerometer } from 'expo-sensors';

export type Tilt = { x: number; y: number };

const SMOOTHING = 0.15;
const SHAKE_JERK_THRESHOLD = 1.4;
const SHAKE_COOLDOWN_MS = 1200;

/**
 * Smoothed device tilt in -1..1 per axis, plus shake detection via sudden
 * acceleration jerk. Silently does nothing where the sensor is unavailable
 * (web without motion permission, simulators, etc.) rather than throwing.
 */
export function useTilt(onShake?: () => void): Tilt {
  const [tilt, setTilt] = useState<Tilt>({ x: 0, y: 0 });
  const smoothed = useRef({ x: 0, y: 0 });
  const lastMagnitude = useRef(1);
  const lastShakeAt = useRef(0);
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;
    try {
      Accelerometer.setUpdateInterval(80);
      subscription = Accelerometer.addListener(({ x, y, z }) => {
        smoothed.current.x += (x - smoothed.current.x) * SMOOTHING;
        smoothed.current.y += (y - smoothed.current.y) * SMOOTHING;
        setTilt({
          x: Math.max(-1, Math.min(1, smoothed.current.x)),
          y: Math.max(-1, Math.min(1, smoothed.current.y)),
        });

        const magnitude = Math.sqrt(x * x + y * y + z * z);
        const jerk = Math.abs(magnitude - lastMagnitude.current);
        lastMagnitude.current = magnitude;
        const now = Date.now();
        if (jerk > SHAKE_JERK_THRESHOLD && now - lastShakeAt.current > SHAKE_COOLDOWN_MS) {
          lastShakeAt.current = now;
          onShakeRef.current?.();
        }
      });
    } catch {
      // No accelerometer on this platform — face just stays put.
    }
    return () => subscription?.remove();
  }, []);

  return tilt;
}
