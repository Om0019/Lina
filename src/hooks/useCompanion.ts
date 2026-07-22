import { useAudioPlayer, useAudioRecorder } from 'expo-audio';
import { useCallback, useRef, useState } from 'react';

import { generateReply, loadLlm } from '../services/llm';
import type { ModelProgress } from '../services/modelManager';
import { ensureMicPermission, WHISPER_RECORDING_OPTIONS } from '../services/recording';
import { loadStt, transcribeFile } from '../services/stt';
import { loadTts, switchVoice, synthesizeToFile } from '../services/tts';
import { getVoiceIndex, setVoiceIndex } from '../services/voiceSettings';
import { TTS_VOICES } from '../models/registry';

export type Expression = 'idle' | 'listening' | 'thinking' | 'talking' | 'happy' | 'error';
export type SetupStage = 'not-started' | 'llm' | 'stt' | 'tts' | 'ready';

export type CompanionState = {
  setupStage: SetupStage;
  setupFraction: number;
  expression: Expression;
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

export function useCompanion() {
  const [setupStage, setSetupStage] = useState<SetupStage>('not-started');
  const [setupFraction, setSetupFraction] = useState(0);
  const [expression, setExpression] = useState<Expression>('idle');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [statusText, setStatusText] = useState('Tap the mic and talk to Lina.');
  const [isRecording, setIsRecording] = useState(false);
  const [voiceIndex, setVoiceIndexState] = useState(() => getVoiceIndex());
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);

  const recorder = useAudioRecorder(WHISPER_RECORDING_OPTIONS);
  const player = useAudioPlayer();
  const happyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashHappy = useCallback(() => {
    setExpression('happy');
    if (happyTimer.current) clearTimeout(happyTimer.current);
    happyTimer.current = setTimeout(() => setExpression('idle'), 900);
  }, []);

  const cycleVoice = useCallback(
    async (direction: 1 | -1) => {
      const count = TTS_VOICES.length;
      const next = ((voiceIndex + direction) % count + count) % count;
      setIsVoiceLoading(true);
      setStatusText(`Loading ${TTS_VOICES[next].label}…`);
      try {
        await switchVoice(next);
        setVoiceIndex(next);
        setVoiceIndexState(next);
        setStatusText('Tap the mic and talk to Lina.');
      } catch (err) {
        setStatusText(err instanceof Error ? err.message : 'Could not switch voice.');
      } finally {
        setIsVoiceLoading(false);
      }
    },
    [voiceIndex]
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
      setStatusText('Tap the mic and talk to Lina.');
    } catch (err) {
      setExpression('error');
      setStatusText(err instanceof Error ? err.message : 'Setup failed.');
    }
  }, []);

  const startRecording = useCallback(async () => {
    setTranscript('');
    setReply('');
    setExpression('listening');
    setStatusText('Listening…');
    setIsRecording(true);
    await recorder.prepareToRecordAsync();
    recorder.record();
  }, [recorder]);

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

      const replyText = await generateReply(text);
      setReply(replyText);

      setExpression('talking');
      setStatusText('Speaking…');
      const audioUri = await synthesizeToFile(replyText);
      player.replace(audioUri);
      player.play();
      flashHappy();
      setStatusText('Tap the mic and talk to Lina.');
    } catch (err) {
      setExpression('error');
      setStatusText(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }, [recorder, player, flashHappy]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      void stopRecording();
    } else {
      void startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const state: CompanionState = {
    setupStage,
    setupFraction,
    expression,
    transcript,
    reply,
    statusText,
    isRecording,
    voiceIndex,
    voiceLabel: TTS_VOICES[voiceIndex].label,
    isVoiceLoading,
  };

  return { state, setup, toggleRecording, cycleVoice };
}
