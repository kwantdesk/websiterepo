/** Self-hosted artwork. Profile values use HTTPS so existing identity sanitizers
 * and desktop clients can render them without widening their URL allow-list. */
const PRESETS = [
  ["robot", "Robot"], ["fox", "Fox"], ["ghost", "Ghost"], ["cat", "Cat"],
  ["frog", "Frog"], ["alien", "Alien"], ["skull", "Skull"], ["panda", "Panda"],
  ["bear", "Bear"], ["raccoon", "Raccoon"], ["owl", "Owl"], ["shark", "Shark"],
  ["dino", "Dino"], ["dragon", "Dragon"], ["bat", "Bat"], ["dog", "Dog"],
  ["duck", "Duck"], ["penguin", "Penguin"], ["slime", "Slime"], ["mushroom", "Mushroom"],
  ["cloud", "Cloud"], ["flame", "Flame"], ["cactus", "Cactus"], ["cyclops", "Cyclops"],
  ["jellyfish", "Jellyfish"], ["crab", "Crab"], ["axolotl", "Axolotl"],
  ["toaster", "Toaster"], ["gamepad", "Gamepad"], ["satellite-bot", "Satellite Bot"],
] as const;
export const SOCIAL_AVATAR_PRESETS = PRESETS.map(([id, name]) => {
  const path = `/images/avatars/console-v1/${id}.webp`;
  return { id, name, path, url: `https://kwantdesk.com${path}` };
});
