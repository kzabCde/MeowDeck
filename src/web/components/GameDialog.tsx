import { useEffect, useRef, type ReactNode, type SyntheticEvent } from 'react';
import type { T } from '../i18n.js';
import { GameButton } from './GameButton.js';

/** Native modal dialog: focus is trapped, Escape can close, and focus is restored by the browser. */
export function GameDialog({ title, children, onClose, t, wide = false, initialFocusSelector }: {
  title: string; children: ReactNode; onClose: () => void; t: T; wide?: boolean; initialFocusSelector?: string;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!node.open) node.showModal();
    const first = (initialFocusSelector ? node.querySelector<HTMLElement>(initialFocusSelector) : null) ?? node.querySelector<HTMLElement>('button:not([disabled]), select:not([disabled])');
    first?.focus();
    return () => { if (node.open) node.close(); };
  }, []);
  return <dialog ref={ref} className={`game-dialog ${wide ? 'dialog-wide' : ''}`} aria-label={title} onCancel={(event: SyntheticEvent<HTMLDialogElement>) => { event.preventDefault(); onClose(); }}>
    <div className="dialog-header"><h2>{title}</h2><GameButton variant="text" className="icon-button" onClick={onClose} aria-label={t('close')}>×</GameButton></div>
    <div className="dialog-content">{children}</div>
  </dialog>;
}
