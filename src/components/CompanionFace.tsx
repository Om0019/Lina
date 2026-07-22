import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path } from 'react-native-svg';

import { useTilt } from '../hooks/useTilt';
import type { Burst, BurstType, Expression, NudgeSource } from '../hooks/useCompanion';

const SIZE = 260;
const CENTER = SIZE / 2;
const EYE_GAP = 46;
const EYE_Y = CENTER - 6;
const BASE_EYE_R = 30;
const GLOW = '#5fd0ff';
const BEZEL = '#1c1f26';
const SCREEN_BG = '#05070c';

const BURST_GLYPH: Record<BurstType, string> = {
  heart: '💗',
  sparkle: '✨',
  question: '❓',
};

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

function squigglePath(width: number): string {
  const y = CENTER + 62;
  const w = width;
  return [
    `M ${CENTER - w / 2} ${y}`,
    `Q ${CENTER - w / 4} ${y - 7} ${CENTER} ${y}`,
    `Q ${CENTER + w / 4} ${y + 7} ${CENTER + w / 2} ${y}`,
  ].join(' ');
}

function closedEyePath(cx: number, cy: number, r: number): string {
  const rx = r * 0.62;
  return `M ${cx - rx} ${cy} Q ${cx} ${cy + rx * 0.85} ${cx + rx} ${cy}`;
}

function heartPath(cx: number, cy: number, r: number): string {
  const s = r * 0.85;
  return [
    `M ${cx} ${cy + s * 0.6}`,
    `C ${cx - s * 1.1} ${cy - s * 0.2} ${cx - s * 0.5} ${cy - s * 1.1} ${cx} ${cy - s * 0.35}`,
    `C ${cx + s * 0.5} ${cy - s * 1.1} ${cx + s * 1.1} ${cy - s * 0.2} ${cx} ${cy + s * 0.6}`,
    'Z',
  ].join(' ');
}

type EyeStyle = 'normal' | 'heart' | 'x' | 'closed';
type MouthShape = 'default' | 'o' | 'squiggle';
type BrowConfig = { show: boolean; leftAngle: number; rightAngle: number; translateY: number };

type FaceConfig = {
  eyeR: number;
  eyeStyle: EyeStyle;
  mouthShape: MouthShape;
  mouthCurve: number;
  mouthW: number;
  mouthH: number;
  brows: BrowConfig;
  blush: boolean;
  closeOverride: number | null;
};

const NO_BROWS: BrowConfig = { show: false, leftAngle: 0, rightAngle: 0, translateY: 0 };

function faceConfigFor(expression: Expression): FaceConfig {
  const base: FaceConfig = {
    eyeR: BASE_EYE_R,
    eyeStyle: 'normal',
    mouthShape: 'default',
    mouthCurve: 0.3,
    mouthW: 46,
    mouthH: 14,
    brows: NO_BROWS,
    blush: false,
    closeOverride: null,
  };

  switch (expression) {
    case 'happy':
      return { ...base, mouthCurve: 1, eyeR: BASE_EYE_R * 0.88, blush: true };
    case 'love':
      return { ...base, eyeStyle: 'heart', mouthCurve: 0.9, blush: true };
    case 'sad':
      return {
        ...base,
        mouthCurve: -0.5,
        eyeR: BASE_EYE_R * 0.9,
        brows: { show: true, leftAngle: -14, rightAngle: 14, translateY: -2 },
      };
    case 'angry':
      return {
        ...base,
        mouthCurve: -0.4,
        eyeR: BASE_EYE_R * 0.85,
        brows: { show: true, leftAngle: 18, rightAngle: -18, translateY: 2 },
      };
    case 'surprised':
      return {
        ...base,
        eyeR: BASE_EYE_R * 1.3,
        mouthShape: 'o',
        mouthW: 26,
        mouthH: 26,
        brows: { show: true, leftAngle: 0, rightAngle: 0, translateY: -8 },
      };
    case 'confused':
      return {
        ...base,
        eyeR: BASE_EYE_R * 1.05,
        mouthShape: 'squiggle',
        mouthW: 40,
        brows: { show: true, leftAngle: -10, rightAngle: 10, translateY: -3 },
      };
    case 'listening':
      return { ...base, eyeR: BASE_EYE_R * 1.12 };
    case 'thinking':
      return {
        ...base,
        eyeR: BASE_EYE_R * 1.12,
        brows: { show: true, leftAngle: -6, rightAngle: 4, translateY: -3 },
      };
    case 'talking':
      return { ...base, mouthCurve: 0.4 };
    case 'sleepy':
      return { ...base, mouthCurve: -0.05, closeOverride: 0.72 };
    case 'asleep':
      return { ...base, eyeStyle: 'closed', mouthW: 20, mouthH: 8, mouthCurve: 0.15 };
    case 'error':
      return { ...base, eyeStyle: 'x', mouthShape: 'squiggle', mouthW: 36 };
    case 'idle':
    default:
      return base;
  }
}

function EyeShape({
  cx,
  cy,
  r,
  closeAmt,
  style,
  dx,
  dy,
}: {
  cx: number;
  cy: number;
  r: number;
  closeAmt: number;
  style: EyeStyle;
  dx: number;
  dy: number;
}) {
  const x = cx + dx;
  const y = cy + dy;

  if (style === 'heart') return <Path d={heartPath(x, y, r)} fill={GLOW} />;
  if (style === 'x') {
    const s = r * 0.5;
    return (
      <G stroke={GLOW} strokeWidth={7} strokeLinecap="round">
        <Line x1={x - s} y1={y - s} x2={x + s} y2={y + s} />
        <Line x1={x - s} y1={y + s} x2={x + s} y2={y - s} />
      </G>
    );
  }
  if (style === 'closed') {
    return <Path d={closedEyePath(x, y, r)} stroke={GLOW} strokeWidth={7} strokeLinecap="round" fill="none" />;
  }

  const rx = r * 0.62;
  const ry = Math.max(2, r * (1 - closeAmt * 0.9));
  return (
    <G>
      <Ellipse cx={x} cy={y} rx={rx} ry={ry} fill={GLOW} />
      {ry > r * 0.4 && (
        <Ellipse cx={x - rx * 0.35} cy={y - ry * 0.35} rx={rx * 0.22} ry={ry * 0.22} fill="#eafcff" opacity={0.75} />
      )}
    </G>
  );
}

function Brow({ cx, cy, width, angle }: { cx: number; cy: number; width: number; angle: number }) {
  return (
    <Line
      x1={cx - width / 2}
      y1={cy}
      x2={cx + width / 2}
      y2={cy}
      stroke={GLOW}
      strokeWidth={6}
      strokeLinecap="round"
      opacity={0.85}
      transform={`rotate(${angle} ${cx} ${cy})`}
    />
  );
}

function Mouth({ shape, width, curve, height }: { shape: MouthShape; width: number; curve: number; height: number }) {
  if (shape === 'o') return <Ellipse cx={CENTER} cy={CENTER + 62} rx={width / 2} ry={height / 2} fill={GLOW} />;
  if (shape === 'squiggle') {
    return <Path d={squigglePath(width)} stroke={GLOW} strokeWidth={6} strokeLinecap="round" fill="none" />;
  }
  return <Path d={mouthPath(width, curve, height)} fill={GLOW} />;
}

function Blush() {
  return (
    <G opacity={0.5}>
      <Ellipse cx={CENTER - EYE_GAP - 34} cy={EYE_Y + 34} rx={16} ry={9} fill="#ff8fa8" />
      <Ellipse cx={CENTER + EYE_GAP + 34} cy={EYE_Y + 34} rx={16} ry={9} fill="#ff8fa8" />
    </G>
  );
}

function BurstParticle({ dx, dy, glyph, delay }: { dx: number; dy: number; glyph: string; delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(v, { toValue: 1, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }, delay);
    return () => clearTimeout(t);
  }, [v, delay]);

  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, dy] });
  const translateX = v.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
  const opacity = v.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] });
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] });

  return (
    <Animated.Text style={[styles.particle, { transform: [{ translateX }, { translateY }, { scale }], opacity }]}>
      {glyph}
    </Animated.Text>
  );
}

type ParticleInstance = { id: string; glyph: string; dx: number; dy: number; delay: number };

/**
 * Ported from the canvas-based face in the original web prototype
 * (web-prototype/index.html drawFace()), redrawn as SVG and considerably
 * expanded: an Eilik-style bezeled screen face, more emotions, eyebrows,
 * blush, tilt parallax, a touch "boop" reaction, sleep/zzz, and floating
 * emotion particles (hearts/sparkles/question marks).
 */
export function CompanionFace({
  expression,
  burst,
  onNudge,
}: {
  expression: Expression;
  burst?: Burst | null;
  onNudge?: (source: NudgeSource) => void;
}) {
  const [blink, setBlink] = useState(0);
  const [mouthOpen, setMouthOpen] = useState(0);
  const [particles, setParticles] = useState<ParticleInstance[]>([]);
  const blinkState = useRef({ last: performance.now(), next: 2500 + Math.random() * 2500, animating: false });
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const zzzAnims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  const tilt = useTilt(() => onNudge?.('shake'));

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
      if (!b.animating && expression !== 'thinking' && expression !== 'asleep' && t - b.last > b.next) {
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

  // Floating "Z"s while asleep — started/stopped as expression changes.
  useEffect(() => {
    if (expression !== 'asleep') {
      zzzAnims.forEach((v) => v.stopAnimation(() => v.setValue(0)));
      return;
    }
    const timeouts = zzzAnims.map((v, i) =>
      setTimeout(() => {
        Animated.loop(
          Animated.timing(v, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true })
        ).start();
      }, i * 700)
    );
    return () => {
      timeouts.forEach(clearTimeout);
      zzzAnims.forEach((v) => v.stopAnimation());
    };
  }, [expression, zzzAnims]);

  // Bursts of floating emotion particles (hearts/sparkles/question marks),
  // spawned whenever the parent hands us a new burst id.
  useEffect(() => {
    if (!burst) return;
    const count = 6;
    const next: ParticleInstance[] = Array.from({ length: count }, (_, i) => ({
      id: `${burst.id}-${i}`,
      glyph: BURST_GLYPH[burst.type],
      dx: (Math.random() - 0.5) * 140,
      dy: -(60 + Math.random() * 60),
      delay: i * 60,
    }));
    setParticles((prev) => [...prev, ...next]);
    const timeout = setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !next.some((n) => n.id === p.id)));
    }, 1400);
    return () => clearTimeout(timeout);
  }, [burst]);

  const cfg = faceConfigFor(expression);
  let { mouthCurve, mouthW, mouthH, eyeR } = cfg;
  const { eyeStyle, mouthShape, brows, blush, closeOverride } = cfg;

  if (expression === 'talking') mouthH = 10 + mouthOpen * 22;

  const closeAmt = closeOverride ?? blink;
  const eyeDX = tilt.x * 10;
  const eyeDY = tilt.y * 8;
  const browGap = eyeR * 1.3;
  const browY = EYE_Y - eyeR - 14 + brows.translateY;

  const translateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 10] });
  const rotate = `${(tilt.x * 6).toFixed(2)}deg`;

  return (
    <Pressable
      onPressIn={() =>
        Animated.spring(pressScale, { toValue: 0.92, useNativeDriver: true, speed: 30, bounciness: 6 }).start()
      }
      onPressOut={() =>
        Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start()
      }
      onPress={() => onNudge?.('touch')}
      hitSlop={8}
    >
      <Animated.View style={[styles.wrap, { transform: [{ translateY }, { scale: pressScale }, { rotate }] }]}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={CENTER} cy={CENTER} r={CENTER} fill={BEZEL} />
          <Circle cx={CENTER} cy={CENTER} r={CENTER - 8} fill={SCREEN_BG} />
          {blush && <Blush />}
          <EyeShape cx={CENTER - EYE_GAP} cy={EYE_Y} r={eyeR} closeAmt={closeAmt} style={eyeStyle} dx={eyeDX} dy={eyeDY} />
          <EyeShape cx={CENTER + EYE_GAP} cy={EYE_Y} r={eyeR} closeAmt={closeAmt} style={eyeStyle} dx={eyeDX} dy={eyeDY} />
          {brows.show && (
            <>
              <Brow cx={CENTER - EYE_GAP} cy={browY} width={browGap} angle={brows.leftAngle} />
              <Brow cx={CENTER + EYE_GAP} cy={browY} width={browGap} angle={brows.rightAngle} />
            </>
          )}
          <Mouth shape={mouthShape} width={mouthW} curve={mouthCurve} height={mouthH} />
        </Svg>

        {expression === 'asleep' &&
          zzzAnims.map((v, i) => {
            const zY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -54 - i * 6] });
            const zX = v.interpolate({ inputRange: [0, 1], outputRange: [0, 14 + i * 8] });
            const zOpacity = v.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] });
            const zScale = v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.15] });
            return (
              <Animated.Text
                key={`z${i}`}
                style={[
                  styles.zzz,
                  { fontSize: 16 + i * 3, transform: [{ translateX: zX }, { translateY: zY }, { scale: zScale }], opacity: zOpacity },
                ]}
              >
                Z
              </Animated.Text>
            );
          })}

        {particles.map((p) => (
          <BurstParticle key={p.id} dx={p.dx} dy={p.dy} glyph={p.glyph} delay={p.delay} />
        ))}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
  },
  zzz: {
    position: 'absolute',
    top: 26,
    right: 34,
    color: GLOW,
    fontWeight: '700',
  },
  particle: {
    position: 'absolute',
    top: CENTER - 10,
    left: CENTER - 10,
    fontSize: 20,
  },
});
