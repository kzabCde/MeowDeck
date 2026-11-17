import manifest from '../../../public/assets/meowdeck/cards/manifest.json';
import type { CardId, Suit } from '../../games/meowdeck/core/cards.js';

export const CARD_BASE = '/assets/meowdeck/cards/';
export const MOCHI_BASE = '/assets/meowdeck/mochi/sprites/';

interface AssetRecord { id: string; path: string; path_2x: string }
const byId = new Map<string, AssetRecord>((manifest.assets as AssetRecord[]).map((entry) => [entry.id, entry]));

/** Paths are derived exclusively from the P0 card pack manifest. */
export function cardImage(id: CardId | 'card_back', highResolution = false): string {
  const entry = byId.get(id);
  if (!entry) throw new Error(`Missing P0 card asset: ${id}`);
  return `${CARD_BASE}${highResolution ? entry.path_2x : entry.path}`;
}

export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const SUIT_CLASS: Record<Suit, string> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };

export const MOCHI_POSES = {
  idle: { file: 'mochi_idle_4f_96x96.png', frames: 4 },
  thinking: { file: 'mochi_thinking_4f_96x96.png', frames: 4 },
  victory: { file: 'mochi_victory_6f_96x96.png', frames: 6 },
  defeat: { file: 'mochi_defeat_4f_96x96.png', frames: 4 }
} as const;
export type MochiPose = keyof typeof MOCHI_POSES;
