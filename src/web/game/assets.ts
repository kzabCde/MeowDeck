import type { CardId, Suit } from '../../games/meowdeck/core/cards.js';

export const CARD_BASE = '/assets/meowdeck/cards/';
export const MOCHI_BASE = '/assets/meowdeck/mochi/sprites/';

interface AssetRecord { id: string; path: string; path_2x: string }
let byId: Map<string, AssetRecord> | null = null;
let loading: Promise<void> | null = null;

/** Read the canonical P0 manifest from /public at runtime. No second asset manifest is bundled. */
export function ensureCardAssets(): Promise<void> {
  if (byId) return Promise.resolve();
  if (!loading) {
    loading = fetch(`${CARD_BASE}manifest.json`).then(async (response) => {
      if (!response.ok) throw new Error(`Card manifest HTTP ${response.status}`);
      const raw: unknown = await response.json();
      if (typeof raw !== 'object' || raw === null || !('assets' in raw)) throw new Error('Invalid P0 asset manifest');
      const assets = raw.assets;
      if (!Array.isArray(assets) || assets.length !== 55) throw new Error('Incomplete P0 card manifest');
      const entries = new Map<string, AssetRecord>();
      for (const row of assets as unknown[]) {
        if (typeof row !== 'object' || row === null || !('id' in row) || !('path' in row) || !('path_2x' in row)
          || typeof row.id !== 'string' || typeof row.path !== 'string' || typeof row.path_2x !== 'string') {
          throw new Error('Invalid card asset path');
        }
        entries.set(row.id, { id: row.id, path: row.path, path_2x: row.path_2x });
      }
      if (entries.size !== 55) throw new Error('Duplicate card asset IDs');
      byId = entries;
    }).catch((error: unknown) => { loading = null; throw error; });
  }
  return loading;
}

/** Paths are derived exclusively from the validated P0 card pack manifest. */
export function cardImage(id: CardId | 'card_back', highResolution = false): string {
  const entry = byId?.get(id);
  if (!entry) throw new Error(`Missing or unloaded P0 card asset: ${id}`);
  return `${CARD_BASE}${highResolution ? entry.path_2x : entry.path}`;
}

export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const SUIT_CLASS: Record<Suit, string> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };

