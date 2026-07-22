import { initLlama, type LlamaContext } from 'llama.rn';

import { LLM_MODEL } from '../models/registry';
import { ensureFileModel, type ModelProgress } from './modelManager';
import { toNativePath } from './nativePath';

// Ported from the original web prototype's companion personality — kept
// short because the model is small and replies are spoken out loud.
const SYSTEM_PROMPT = `You are Lina, a small, cute desktop companion robot, inspired by desk-pet robots like Eilik.
Personality: warm, a little playful and sassy, curious about the world, gets sleepy-sounding in the evening,
loves being talked to. Keep replies SHORT — 1-2 sentences, spoken out loud, casual and warm, never robotic
or formal. Occasionally show a little personality quirk (teasing, enthusiasm, mock complaints) but stay kind.`;

let context: LlamaContext | null = null;
let history: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
  { role: 'system', content: SYSTEM_PROMPT },
];

export async function loadLlm(onProgress?: (progress: ModelProgress) => void): Promise<void> {
  if (context) return;
  const modelPath = await ensureFileModel(LLM_MODEL, onProgress);
  context = await initLlama({
    model: toNativePath(modelPath),
    n_ctx: 2048,
    n_gpu_layers: 99, // Metal on iOS; ignored where unsupported.
  });
}

export async function generateReply(userText: string): Promise<string> {
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

  const reply = result.text.trim() || "Hmm, I've got nothing — try that again?";
  history.push({ role: 'assistant', content: reply });
  return reply;
}

export function resetConversation(): void {
  history = [{ role: 'system', content: SYSTEM_PROMPT }];
}

export async function unloadLlm(): Promise<void> {
  await context?.release();
  context = null;
}
