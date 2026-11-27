// Shared pre-show data (no engine import — safe for phones)
export const SETUP_STEPS = [
  { id: 'join', label: 'Join', icon: '📱' },
  { id: 'warmup', label: 'Warm-Up', icon: '📋' },
  { id: 'games', label: 'Pick Games', icon: '🗳️' },
  { id: 'beef', label: 'Settle a Beef', icon: '🥊' },
  { id: 'teams', label: 'Teams', icon: '👥' },
];
export const BEEF_TOPICS = [
  'Who knows more music', "Who's the real Spades champ", 'Who knows the family history', 'Who knows more Black history',
  "Who's the better cook", 'Who knows more old-school TV', 'Who knows more about sports', 'Just because 😤',
];
// one-line pitches for the game-vote cards
export const GAME_PITCH = {
  majority_rules: 'Vote with the room', hot_take: 'Agree or disagree — then debate', hashtag: 'Decode the hashtag', most_likely: "Who's most likely to…",
  saying: 'Finish what Mama always said', top_that: 'Funniest answer wins', emoji: 'Name it from emojis', family_survey: 'Guess what the family said',
  two_truths: 'Spot the lie', charades: 'Act it out, no talking', sing_it: 'Sing a song with the word', hum_it: 'Hum it — no words',
  one_gotta_go: 'Kick one out, defend it', name_that_era: 'Which decade is it?', blitz: '60 seconds, answer fast',
};
// phone-friendly names + emoji for the game-vote cards
export const GAME_CARDS = {
  majority_rules: ['Majority Rules', '🗳️'], hot_take: ['Settle It!', '🔥'], hashtag: ['Hashtag Decode', '#️⃣'], most_likely: ['Who in the Family…?', '👑'],
  saying: ['Mama Said', '👟'], top_that: ['Top That!', '😂'], emoji: ['Emoji Decode', '😎'], family_survey: ['The Family Survey', '📋'],
  two_truths: ['Two Truths & a Lie', '🎭'], charades: ['Culture Charades', '🙊'], sing_it: ['Sing It!', '🎤'], hum_it: ['Hum That Tune', '🎶'],
  one_gotta_go: ["One's Gotta Go", '🥧'], name_that_era: ['Name That Era', '📻'], blitz: ['60-Second Blitz', '⚡'],
};

// which pre-show steps apply to a given state (pure, so the watch screen can use it)
export function stepsFor(s) {
  const fmt = (s.settings && s.settings.format) || 'classic';
  return SETUP_STEPS.filter((st) => {
    if (st.id === 'warmup') return !!s.survey && fmt !== 'trivia' && fmt !== 'practice';
    if (st.id === 'games' || st.id === 'beef') return fmt !== 'practice';
    return true;
  });
}
