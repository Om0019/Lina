import { useAudioPlayer, useAudioPlayerStatus, useAudioRecorder } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

import { generateReply, loadLlm } from '../services/llm';
import type { ModelProgress } from '../services/modelManager';
import { ensureMicPermission, WHISPER_RECORDING_OPTIONS } from '../services/recording';
import { loadStt, transcribeFile } from '../services/stt';
import { loadTts, switchVoice, synthesizeToFile } from '../services/tts';
import { getVoiceIndex, setVoiceIndex } from '../services/voiceSettings';
import { TTS_VOICES } from '../models/registry';
import type { Expression } from '../services/emotion';

export type { Expression } from '../services/emotion';
export type SetupStage = 'not-started' | 'llm' | 'stt' | 'tts' | 'ready';
export type BurstType = 'heart' | 'sparkle' | 'question';
export type Burst = { type: BurstType; id: number };
export type NudgeSource = 'touch' | 'shake';

export type CompanionState = {
  setupStage: SetupStage;
  setupFraction: number;
  expression: Expression;
  burst: Burst | null;
  transcript: string;
  reply: string;
  statusText: string;
  isRecording: boolean;
  voiceIndex: number;
  voiceLabel: string;
  isVoiceLoading: boolean;
};

const STAGE_LABEL: Record<Exclude<SetupStage, 'not-started' | 'ready'>, string> = {
  llm: 'Downloading Lina’s brain…',
  stt: 'Downloading her ears…',
  tts: 'Downloading her voice…',
};

const REACTING_EXPRESSIONS: Expression[] = ['listening', 'thinking', 'talking'];
const RESTING_EXPRESSIONS: Expression[] = ['idle', 'sleepy', 'asleep'];
const EMOTION_HOLD_MS = 1500;
const IDLE_TO_SLEEPY_MS = 45_000;
const SLEEPY_TO_ASLEEP_MS = 30_000;
const SLEEP_CHECK_INTERVAL_MS = 4000;

export function useCompanion() {
  const [setupStage, setSetupStage] = useState<SetupStage>('not-started');
  const [setupFraction, setSetupFraction] = useState(0);
  const [expression, setExpression] = useState<Expression>('idle');
  const [burst, setBurst] = useState<Burst | null>(null);
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [statusText, setStatusText] = useState('Tap the mic, or just tap Lina, to say hi.');
  const [isRecording, setIsRecording] = useState(false);
  const [voiceIndex, setVoiceIndexState] = useState(() => getVoiceIndex());
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);

  const recorder = useAudioRecorder(WHISPER_RECORDING_OPTIONS);
  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);
  const emotionHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEmotion = useRef<Expression>('happy');
  const expressionRef = useRef<Expression>('idle');
  const setupStageRef = useRef<SetupStage>('not-started');
  const lastActiveAt = useRef(Date.now());

  useEffect(() => {
    expressionRef.current = expression;
  }, [expression]);

  useEffect(() => {
    setupStageRef.current = setupStage;
  }, [setupStage]);

  const markActive = useCallback(() => {
    lastActiveAt.current = Date.now();
  }, []);

  const triggerBurst = useCallback((type: BurstType) => {
    setBurst({ type, id: Date.now() + Math.random() });
  }, []);

  // The face's emotion for a given turn: driven by whatever Lina's model
  // decided she feels (see llm.ts's EMOTION tag), held briefly, then settled
  // back to idle. Also the one place particle effects (hearts/sparkles/etc)
  // get spawned so any code path that changes how Lina feels also makes the
  // right thing appear.
  const showEmotion = useCallback(
    (next: Expression) => {
      setExpression(next);
      if (next === 'happy' || next === 'love') triggerBurst(next === 'love' ? 'heart' : 'sparkle');
      else if (next === 'surprised') triggerBurst('sparkle');
      else if (next === 'confused') triggerBurst('question');

      if (emotionHoldTimer.current) clearTimeout(emotionHoldTimer.current);
      emotionHoldTimer.current = setTimeout(() => {
        setExpression('idle');
        markActive();
      }, EMOTION_HOLD_MS);
    },
    [markActive, triggerBurst]
  );

  // Reacts to a physical nudge — a tap on Lina's face, or a shake of the
  // phone. Waking her up takes priority; otherwise she doesn't interrupt an
  // in-progress listen/think/talk turn, she just plays a little reaction.
  const nudge = useCallback(
    (source: NudgeSource) => {
      markActive();
      const current = expressionRef.current;
      if (current === 'asleep' || current === 'sleepy') {
        setExpression('idle');
        return;
      }
      if (REACTING_EXPRESSIONS.includes(current)) return;

      const pool: Expression[] =
        source === 'shake' ? ['surprised', 'confused', 'happy'] : ['happy', 'love', 'surprised'];
      showEmotion(pool[Math.floor(Math.random() * pool.length)]);
    },
    [markActive, showEmotion]
  );

  const cycleVoice = useCallback(
    async (direction: 1 | -1) => {
      markActive();
      const count = TTS_VOICES.length;
      const next = (((voiceIndex + direction) % count) + count) % count;
      setIsVoiceLoading(true);
      setStatusText(`Loading ${TTS_VOICES[next].label}…`);
      try {
        await switchVoice(next);
        setVoiceIndex(next);
        setVoiceIndexState(next);
        setStatusText('Tap the mic, or just tap Lina, to say hi.');
      } catch (err) {
        setStatusText(err instanceof Error ? err.message : 'Could not switch voice.');
      } finally {
        setIsVoiceLoading(false);
      }
    },
    [voiceIndex, markActive]
  );

  const setup = useCallback(async () => {
    try {
      const onStageProgress = (stage: Exclude<SetupStage, 'not-started' | 'ready'>) => (p: ModelProgress) => {
        setSetupStage(stage);
        setSetupFraction(p.fraction);
        setStatusText(`${STAGE_LABEL[stage]} ${Math.round(p.fraction * 100)}%`);
      };

      await loadLlm(onStageProgress('llm'));
      await loadStt(onStageProgress('stt'));
      await loadTts(onStageProgress('tts'));

      const granted = await ensureMicPermission();
      if (!granted) {
        setStatusText('Microphone permission is required for Lina to hear you.');
        setExpression('error');
        return;
      }

      setSetupStage('ready');
      markActive();
      setStatusText('Tap the mic, or just tap Lina, to say hi.');
    } catch (err) {
      setExpression('error');
      setStatusText(err instanceof Error ? err.message : 'Setup failed.');
    }
  }, [markActive]);

  const startRecording = useCallback(async () => {
    markActive();
    if (emotionHoldTimer.current) clearTimeout(emotionHoldTimer.current);
    setTranscript('');
    setReply('');
    setExpression('listening');
    setStatusText('Listening…');
    setIsRecording(true);
    await recorder.prepareToRecordAsync();
    recorder.record();
  }, [recorder, markActive]);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) {
      setExpression('idle');
      setStatusText("Didn't catch that — tap and try again.");
      return;
    }

    try {
      setExpression('thinking');
      setStatusText('Thinking…');

      const text = await transcribeFile(uri);
      if (!text) {
        setExpression('idle');
        setStatusText("Didn't catch that — tap and try again.");
        return;
      }
      setTranscript(text);

      const replyResult = await generateReply(text);
      setReply(replyResult.text);
      pendingEmotion.current = replyResult.expression;

      setExpression('talking');
      setStatusText('Speaking…');
      const audioUri = await synthesizeToFile(replyResult.text);
      player.replace(audioUri);
      player.play();
      // Expression settles to how Lina actually feels about her reply once
      // she's done speaking — see the playerStatus.didJustFinish effect below.
      setStatusText('Tap the mic, or just tap Lina, to say hi.');
    } catch (err) {
      setExpression('error');
      setStatusText(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }, [recorder, player]);

  // Waits for the TTS clip to actually finish before switching off the
  // talking mouth animation, so it stays in sync with real speech length
  // instead of a fixed guess.
  useEffect(() => {
    if (playerStatus.didJustFinish && expressionRef.current === 'talking') {
      showEmotion(pendingEmotion.current);
    }
  }, [playerStatus.didJustFinish, showEmotion]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      void stopRecording();
    } else {
      void startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Drifts to 'sleepy' then 'asleep' after a stretch of inactivity, like a
  // real desk companion — but only while genuinely idle (setup done, not
  // mid-conversation) so she never nods off during a download or a chat.
  useEffect(() => {
    const id = setInterval(() => {
      if (setupStageRef.current !== 'ready') return;
      const current = expressionRef.current;
      if (!RESTING_EXPRESSIONS.includes(current)) return;

      const elapsed = Date.now() - lastActiveAt.current;
      if (elapsed > IDLE_TO_SLEEPY_MS + SLEEPY_TO_ASLEEP_MS) {
        if (current !== 'asleep') setExpression('asleep');
      } else if (elapsed > IDLE_TO_SLEEPY_MS) {
        if (current === 'idle') setExpression('sleepy');
      }
    }, SLEEP_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      if (emotionHoldTimer.current) clearTimeout(emotionHoldTimer.current);
    };
  }, []);

  const state: CompanionState = {
    setupStage,
    setupFraction,
    expression,
    burst,
    transcript,
    reply,
    statusText,
    isRecording,
    voiceIndex,
    voiceLabel: TTS_VOICES[voiceIndex].label,
    isVoiceLoading,
  };

  return { state, setup, toggleRecording, cycleVoice, nudge };
}
