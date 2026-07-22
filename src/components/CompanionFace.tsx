import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path } from 'react-native-svg';

import { useTilt } from '../hooks/useTilt';
import type { Burst, BurstType, Expression, NudgeSource } from '../hooks/useCompanion';

const SIZE = 260;
const CENTER = SIZE / 2;
const EYE_GAP = 34;
const EYE_Y = CENTER - 6;
const MOUTH_Y = CENTER + 56;
// Sampled directly from an Eilik reference photo (mid-expression screen grab):
// the "eyes" render as a turquoise/mint, not a cool blue.
const GLOW = '#7af1f0';
const BEZEL = '#f5f2ea';
const SCREEN_BG = '#0a0a0b';

const BURST_GLYPH: Record<BurstType, string> = {
  heart: '💗',
  sparkle: '✨',
  question: '❓',
};

// A rect with an independently-radiused corner per side — the building block
// for the "dome" eye (fully round top, softer bottom) and the pill mouth.
function roundedRectPath(cx: number, cy: number, w: number, h: number, rTL: number, rTR: number, rBR: number, rBL: number): string {
  const x = cx - w / 2;
  const y = cy - h / 2;
  return [
    `M ${x + rTL} ${y}`,
    `H ${x + w - rTR}`,
    `A ${rTR} ${rTR} 0 0 1 ${x + w} ${y + rTR}`,
    `V ${y + h - rBR}`,
    `A ${rBR} ${rBR} 0 0 1 ${x + w - rBR} ${y + h}`,
    `H ${x + rBL}`,
    `A ${rBL} ${rBL} 0 0 1 ${x} ${y + h - rBL}`,
    `V ${y + rTL}`,
    `A ${rTL} ${rTL} 0 0 1 ${x + rTL} ${y}`,
    'Z',
  ].join(' ');
}

function domeEyePath(cx: number, cy: number, w: number, h: number): string {
  const topR = w / 2;
  const bottomR = h * 0.22;
  return roundedRectPath(cx, cy, w, h, topR, topR, bottomR, bottomR);
}

// A filled lens/crescent — the shape behind happy (peak up), sad/angry
// (peak down, tilted), sleepy and asleep (nearly flat). Drawn in local
// space around (0,0); callers wrap it in a translate+rotate transform.
function crescentPath(halfW: number, peak: number, thickness: number): string {
  return [
    `M ${-halfW} 0`,
    `Q 0 ${-peak} ${halfW} 0`,
    `Q ${halfW} ${thickness * 0.6} ${halfW - thickness * 0.3} ${thickness}`,
    `Q 0 ${-peak + thickness} ${-halfW + thickness * 0.3} ${thickness}`,
    `Q ${-halfW} ${thickness * 0.6} ${-halfW} 0`,
    'Z',
  ].join(' ');
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

// One wide X spanning both eye positions (not two separate X's) — matches
// how the "glitched/dead" expression reads on the reference.
function bigXPath(span: number): string {
  return [
    `M ${CENTER - span} ${EYE_Y - span * 0.6} L ${CENTER + span} ${EYE_Y + span * 0.6}`,
    `M ${CENTER - span} ${EYE_Y + span * 0.6} L ${CENTER + span} ${EYE_Y - span * 0.6}`,
  ].join(' ');
}

function zigzagMouthPath(w: number): string {
  const q = w / 4;
  return [
    `M ${CENTER - w / 2} ${MOUTH_Y}`,
    `L ${CENTER - q} ${MOUTH_Y + 8}`,
    `L ${CENTER} ${MOUTH_Y}`,
    `L ${CENTER + q} ${MOUTH_Y + 8}`,
    `L ${CENTER + w / 2} ${MOUTH_Y}`,
  ].join(' ');
}

function trianglePath(w: number, h: number): string {
  return `M ${CENTER - w / 2} ${MOUTH_Y} L ${CENTER + w / 2} ${MOUTH_Y} L ${CENTER} ${MOUTH_Y + h} Z`;
}

type EyeDesc =
  | { kind: 'dome'; w: number; h: number; closable: true }
  | { kind: 'circle'; r: number; closable: boolean }
  | { kind: 'crescent'; halfW: number; peak: number; thickness: number; rotate: number; closable: false }
  | { kind: 'heart'; size: number; closable: false };

type MouthDesc =
  | { kind: 'none' }
  | { kind: 'grin'; w: number; h: number }
  | { kind: 'oval'; w: number; h: number }
  | { kind: 'zigzag'; w: number }
  | { kind: 'triangle'; w: number; h: number };

type FaceConfig = {
  special: 'none' | 'x';
  leftEye: EyeDesc;
  rightEye: EyeDesc;
  mouth: MouthDesc;
};

function dome(w: number, h: number): EyeDesc {
  return { kind: 'dome', w, h, closable: true };
}

function faceConfigFor(expression: Expression): FaceConfig {
  switch (expression) {
    case 'happy': {
      const eye: EyeDesc = { kind: 'crescent', halfW: 22, peak: 22, thickness: 13, rotate: 0, closable: false };
      return { special: 'none', leftEye: eye, rightEye: eye, mouth: { kind: 'grin', w: 52, h: 26 } };
    }
    case 'love': {
      const eye: EyeDesc = { kind: 'heart', size: 30, closable: false };
      return { special: 'none', leftEye: eye, rightEye: eye, mouth: { kind: 'none' } };
    }
    case 'sad':
      return {
        special: 'none',
        leftEye: { kind: 'crescent', halfW: 20, peak: -10, thickness: 12, rotate: -12, closable: false },
        rightEye: { kind: 'crescent', halfW: 20, peak: -10, thickness: 12, rotate: 12, closable: false },
        mouth: { kind: 'oval', w: 22, h: 14 },
      };
    case 'angry':
      return {
        special: 'none',
        leftEye: { kind: 'crescent', halfW: 20, peak: -14, thickness: 11, rotate: 14, closable: false },
        rightEye: { kind: 'crescent', halfW: 20, peak: -14, thickness: 11, rotate: -14, closable: false },
        mouth: { kind: 'zigzag', w: 40 },
      };
    case 'surprised': {
      const eye: EyeDesc = { kind: 'circle', r: 32, closable: false };
      return { special: 'none', leftEye: eye, rightEye: eye, mouth: { kind: 'oval', w: 20, h: 20 } };
    }
    case 'confused':
      return {
        special: 'none',
        leftEye: dome(34, 60),
        rightEye: { kind: 'crescent', halfW: 19, peak: 6, thickness: 10, rotate: 10, closable: false },
        mouth: { kind: 'triangle', w: 14, h: 12 },
      };
    case 'listening': {
      const eye = dome(36, 68);
      return { special: 'none', leftEye: eye, rightEye: eye, mouth: { kind: 'none' } };
    }
    case 'thinking':
      return {
        special: 'none',
        leftEye: { kind: 'crescent', halfW: 19, peak: 2, thickness: 11, rotate: -4, closable: false },
        rightEye: { kind: 'crescent', halfW: 19, peak: 2, thickness: 11, rotate: 6, closable: false },
        mouth: { kind: 'none' },
      };
    case 'talking': {
      const eye = dome(34, 60);
      return { special: 'none', leftEye: eye, rightEye: eye, mouth: { kind: 'grin', w: 44, h: 12 } };
    }
    case 'sleepy': {
      const eye: EyeDesc = { kind: 'crescent', halfW: 22, peak: -6, thickness: 9, rotate: 0, closable: false };
      return { special: 'none', leftEye: eye, rightEye: eye, mouth: { kind: 'none' } };
    }
    case 'asleep': {
      const eye: EyeDesc = { kind: 'crescent', halfW: 22, peak: -2, thickness: 7, rotate: 0, closable: false };
      return { special: 'none', leftEye: eye, rightEye: eye, mouth: { kind: 'none' } };
    }
    case 'error':
      return { special: 'x', leftEye: dome(34, 60), rightEye: dome(34, 60), mouth: { kind: 'none' } };
    case 'idle':
    default: {
      const eye = dome(34, 60);
      return { special: 'none', leftEye: eye, rightEye: eye, mouth: { kind: 'none' } };
    }
  }
}

function EyeShape({ eye, cx, cy, closeAmt }: { eye: EyeDesc; cx: number; cy: number; closeAmt: number }) {
  if (eye.kind === 'heart') return <Path d={heartPath(cx, cy, eye.size)} fill={GLOW} />;

  if (eye.kind === 'crescent') {
    return (
      <Path
        d={crescentPath(eye.halfW, eye.peak, eye.thickness)}
        fill={GLOW}
        transform={`translate(${cx} ${cy}) rotate(${eye.rotate})`}
      />
    );
  }

  if (eye.kind === 'circle') {
    const ry = eye.closable ? Math.max(2, eye.r * (1 - closeAmt * 0.85)) : eye.r;
    return <Ellipse cx={cx} cy={cy} rx={eye.r} ry={ry} fill={GLOW} />;
  }

  // dome
  const h = Math.max(6, eye.h * (1 - closeAmt * 0.85));
  return <Path d={domeEyePath(cx, cy, eye.w, h)} fill={GLOW} />;
}

function Mouth({ mouth, mouthOpen }: { mouth: MouthDesc; mouthOpen: number }) {
  if (mouth.kind === 'none') return null;
  if (mouth.kind === 'grin') {
    const h = mouth.h + mouthOpen * 16;
    return <Path d={roundedRectPath(CENTER, MOUTH_Y, mouth.w, h, h / 2, h / 2, h / 2, h / 2)} fill={GLOW} />;
  }
  if (mouth.kind === 'oval') return <Ellipse cx={CENTER} cy={MOUTH_Y} rx={mouth.w / 2} ry={mouth.h / 2} fill={GLOW} />;
  if (mouth.kind === 'zigzag') {
    return <Path d={zigzagMouthPath(mouth.w)} stroke={GLOW} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
  }
  return <Path d={trianglePath(mouth.w, mouth.h)} fill={GLOW} />;
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
 * Matched to an Eilik reference photo: turquoise/mint (#7af1f0) shapes on a
 * near-black round screen with a light plastic bezel, dome-shaped resting
 * eyes, and expression-specific shapes (crescents for happy/sad/angry/sleepy,
 * circles for surprised, a heart, a single wide X for error) — including a
 * real mouth shape where the reference shows one, not eyes-only.
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
  const eyeDX = tilt.x * 8;
  const eyeDY = tilt.y * 6;

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
          <Circle cx={CENTER} cy={CENTER} r={CENTER - 5} fill={SCREEN_BG} />
          {cfg.special === 'x' ? (
            <G stroke={GLOW} strokeWidth={8} strokeLinecap="round">
              <Path d={bigXPath(EYE_GAP + 20)} />
            </G>
          ) : (
            <>
              <EyeShape eye={cfg.leftEye} cx={CENTER - EYE_GAP + eyeDX} cy={EYE_Y + eyeDY} closeAmt={blink} />
              <EyeShape eye={cfg.rightEye} cx={CENTER + EYE_GAP + eyeDX} cy={EYE_Y + eyeDY} closeAmt={blink} />
              <Mouth mouth={cfg.mouth} mouthOpen={mouthOpen} />
            </>
          )}
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
