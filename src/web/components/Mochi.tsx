import { MOCHI_BASE, MOCHI_POSES, type MochiPose } from '../game/assets.js';
import type { T } from '../i18n.js';

/** P2 uses only the first production sprite-sheet frame; P3 will supply playback timing. */
export function Mochi({ pose = 'idle', size = 'large', t }: { pose?: MochiPose; size?: 'large' | 'small'; t: T }) {
  const clip = MOCHI_POSES[pose];
  return <div className={`mochi-character mochi-${size}`} role="img" aria-label={`${t('mochi')} — ${pose}`} data-testid="mochi">
    <span className="mochi-frame pixel-art" style={{ backgroundImage: `url(${MOCHI_BASE}${clip.file})`, backgroundSize: `${clip.frames * 100}% 100%` }} />
  </div>;
}
