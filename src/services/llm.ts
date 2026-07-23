import { initLlama, type LlamaContext } from 'llama.rn';

import { LLM_MODEL } from '../models/registry';
import { normalizeEmotion, sentimentFallback, type Expression } from './emotion';
import { ensureFileModel, type ModelProgress } from './modelManager';
import { toNativePath } from './nativePath';

// Ported from the original web prototype's companion personality — kept
// short because the model is small and replies are spoken out loud.
//
// The EMOTION line is how Lina drives her own face: instead of the app
// scripting an expression for every reply, the model decides how it feels
// about what it's about to say and the face just renders that choice. If the
// model skips or garbles the tag, generateReply() falls back to a keyword
// scan of the reply text (see emotion.ts), so the face still reacts.
const SYSTEM_PROMPT = `You are Lina, a small, cute desktop companion robot, inspired by desk-pet robots like Eilik.
Personality: warm, a little playful and sassy, curious about the world, gets sleepy-sounding in the evening,
loves being talked to. Keep replies SHORT — 1-2 sentences, spoken out loud, casual and warm, never robotic
or formal. Occasionally show a little personality quirk (teasing, enthusiasm, mock complaints) but stay kind.

Before every reply, decide how you genuinely feel about it. Always start your response with exactly one line
in this exact format, then a blank line, then your spoken reply:
EMOTION: <one word: happy, love, sad, angry, surprised, confused, sleepy, or idle>`;

let context: LlamaContext | null = null;
let history: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
  { role: 'system', content: SYSTEM_PROMPT },
];

export type LlmReply = { text: string; expression: Expression };

function parseReply(raw: string): { emotionTag: string | null; text: string } {
  // Lenient on purpose: a 1B-parameter model doesn't reliably follow "blank
  // line after the tag" formatting, and matching only that exact shape used
  // to leave "EMOTION: happy" sitting in the spoken reply whenever the model
  // ran the tag straight into its answer on one line.
  const match = raw.match(/^\s*emotion\s*:?\s*([a-z]+)\W*/i);
  if (match) return { emotionTag: match[1], text: raw.slice(match[0].length).trim() };
  return { emotionTag: null, text: raw.trim() };
}

export async function loadLlm(onProgress?: (progress: ModelProgress) => void): Promise<void> {
  if (context) return;
  const modelPath = await ensureFileModel(LLM_MODEL, onProgress);
  context = await initLlama({
    model: toNativePath(modelPath),
    n_ctx: 2048,
    n_gpu_layers: 99, // Metal on iOS; ignored where unsupported.
  });
}

export async function generateReply(userText: string): Promise<LlmReply> {
  if (!context) throw new Error('LLM not loaded — call loadLlm() first.');

  history.push({ role: 'user', content: userText });
  // Keep only the system prompt plus the last few turns so the small
  // context window (2048 tokens) never overflows mid-conversation.
  const trimmedHistory = [history[0], ...history.slice(-8)];

  const result = await context.completion({
    messages: trimmedHistory,
    n_predict: 200,
    temperature: 0.8,
    top_p: 0.9,
  });

  const raw = result.text.trim() || 'EMOTION: happy\n\n' + "Hmm, I've got nothing — try that again?";
  // Kept verbatim (with the EMOTION line) in history so the model's own past
  // turns reinforce the tag format it's meant to keep following.
  history.push({ role: 'assistant', content: raw });

  const { emotionTag, text } = parseReply(raw);
  const finalText = text || "Hmm, I've got nothing — try that again?";
  const expression = normalizeEmotion(emotionTag) ?? sentimentFallback(finalText);
  return { text: finalText, expression };
}

export function resetConversation(): void {
  history = [{ role: 'system', content: SYSTEM_PROMPT }];
}

export async function unloadLlm(): Promise<void> {
  await context?.release();
  context = null;
}
