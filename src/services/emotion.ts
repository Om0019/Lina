export type Expression =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'talking'
  | 'happy'
  | 'love'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'confused'
  | 'sleepy'
  | 'asleep'
  | 'error';

// Maps whatever word the on-device model picks (it won't always use our exact
// vocabulary) to a face expression we know how to draw.
const EMOTION_ALIASES: Record<string, Expression> = {
  happy: 'happy',
  joy: 'happy',
  joyful: 'happy',
  glad: 'happy',
  excited: 'happy',
  cheerful: 'happy',
  playful: 'happy',
  amused: 'happy',
  love: 'love',
  loving: 'love',
  affectionate: 'love',
  adoring: 'love',
  sweet: 'love',
  fond: 'love',
  sad: 'sad',
  down: 'sad',
  disappointed: 'sad',
  sorry: 'sad',
  lonely: 'sad',
  hurt: 'sad',
  angry: 'angry',
  annoyed: 'angry',
  frustrated: 'angry',
  mad: 'angry',
  grumpy: 'angry',
  irritated: 'angry',
  surprised: 'surprised',
  shocked: 'surprised',
  amazed: 'surprised',
  startled: 'surprised',
  astonished: 'surprised',
  confused: 'confused',
  puzzled: 'confused',
  unsure: 'confused',
  uncertain: 'confused',
  curious: 'listening',
  interested: 'listening',
  intrigued: 'listening',
  sleepy: 'sleepy',
  tired: 'sleepy',
  bored: 'sleepy',
  drowsy: 'sleepy',
  neutral: 'idle',
  calm: 'idle',
  idle: 'idle',
  fine: 'idle',
};

export function normalizeEmotion(raw: string | null | undefined): Expression | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/[^a-z]/g, '');
  return EMOTION_ALIASES[key] ?? null;
}

// Backup for when the model's reply doesn't include a parseable emotion tag —
// a light keyword/punctuation scan of the reply text itself.
const SENTIMENT_RULES: { test: RegExp; expression: Expression }[] = [
  { test: /\?!|!\?/, expression: 'surprised' },
  { test: /\b(wow|whoa|no way|can'?t believe|omg)\b/i, expression: 'surprised' },
  { test: /\b(love|miss you|sweetheart|dear|adorable)\b/i, expression: 'love' },
  { test: /\b(sorry|unfortunately|sad|lonely|rough day)\b/i, expression: 'sad' },
  { test: /\b(ugh|annoy|frustrat|angry|mad at)\b/i, expression: 'angry' },
  { test: /\b(hmm+|not sure|confus|huh\??)\b/i, expression: 'confused' },
  { test: /\b(tired|sleepy|yawn|nap|bedtime)\b/i, expression: 'sleepy' },
  { test: /\b(yay|awesome|amazing|great|exciting|haha|lol)\b/i, expression: 'happy' },
  { test: /!/, expression: 'happy' },
];

export function sentimentFallback(text: string): Expression {
  for (const rule of SENTIMENT_RULES) {
    if (rule.test.test(text)) return rule.expression;
  }
  return 'happy';
}
