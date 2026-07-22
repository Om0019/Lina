import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';

import type { Expression } from '../hooks/useCompanion';

const SIZE = 260;
const CENTER = SIZE / 2;
const EYE_GAP = 46;
const EYE_Y = CENTER - 6;
const BASE_EYE_R = 30;
const GLOW = '#5fd0ff';

function mouthPath(width: number, curve: number, height: number): string {
  const w = width;
  const h = height;
  const y = CENTER + 62;
  return [
    `M ${CENTER - w / 2} ${y}`,
    `Q ${CENTER} ${y + h * curve * 2} ${CENTER + w / 2} ${y}`,
    `L ${CENTER + w / 2} ${y + h * 0.3}`,
    `Q ${CENTER} ${y + h * curve * 2 + h * 0.3} ${CENTER - w / 2} ${y + h * 0.3}`,
    'Z',
  ].join(' ');
}

/**
 * Ported from the canvas-based face in the original web prototype
 * (web-prototype/index.html drawFace()) — same per-expression eye/mouth
 * geometry and blink/talk animation, redrawn each frame as SVG instead of
 * canvas 2D since RN has no <canvas>.
 */
export function CompanionFace({ expression }: { expression: Expression }) {
  const [blink, setBlink] = useState(0);
  const [mouthOpen, setMouthOpen] = useState(0);
  const blinkState = useRef({ last: performance.now(), next: 2500 + Math.random() * 2500, animating: false });
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim]);

  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      const b = blinkState.current;
      if (!b.animating && expression !== 'thinking' && t - b.last > b.next) {
        b.last = t;
        b.next = 2500 + Math.random() * 3000;
        b.animating = true;
        const start = t;
        const dur = 220;
        const step = (now: number) => {
          const p = Math.min(1, (now - start) / dur);
          setBlink(p < 0.5 ? p * 2 : (1 - p) * 2);
          if (p < 1) requestAnimationFrame(step);
          else b.animating = false;
        };
        requestAnimationFrame(step);
      }
      if (expression === 'talking') {
        setMouthOpen(0.4 + Math.abs(Math.sin(t / 90)) * 0.6);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [expression]);

  let closeAmt = blink;
  let mouthCurve = 0.3;
  let mouthW = 46;
  let mouthH = 14;
  let eyeR = BASE_EYE_R;

  if (expression === 'happy') {
    mouthCurve = 1;
    eyeR = BASE_EYE_R * 0.9;
  } else if (expression === 'listening' || expression === 'thinking') {
    eyeR = BASE_EYE_R * 1.12;
  } else if (expression === 'talking') {
    mouthH = 10 + mouthOpen * 22;
    mouthCurve = 0.4;
  } else if (expression === 'error') {
    mouthCurve = -0.3;
    eyeR = BASE_EYE_R * 0.85;
  }

  const eyeRy = Math.max(2, eyeR * (1 - closeAmt * 0.9));
  const eyeRx = eyeR * 0.62;

  const translateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 10] });

  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY }] }]}>
      <Svg width={SIZE} height={SIZE}>
        <Ellipse cx={CENTER - EYE_GAP} cy={EYE_Y} rx={eyeRx} ry={eyeRy} fill={GLOW} />
        <Ellipse cx={CENTER + EYE_GAP} cy={EYE_Y} rx={eyeRx} ry={eyeRy} fill={GLOW} />
        <Path d={mouthPath(mouthW, mouthCurve, mouthH)} fill={GLOW} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
  },
});
