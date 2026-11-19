import { useEffect, useId, useRef, type ReactNode, type SyntheticEvent } from 'react';
import type { T } from '../i18n.js';
import { GameButton } from './GameButton.js';

/** Native modal dialog: labelled by its visible heading; focus is managed by the browser. */
export function GameDialog({ title, children, onClose, t, wide = false, initialFocusSelector }: {
  title: string; children: ReactNode; onClose: () => void; t: T; wide?: boolean; initialFocusSelector?: string;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const titleId=useId();
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!node.open) node.showModal();
    // Focus the actual first task control rather than the decorative close icon.
    // The caller can override for suit selection and other special dialogs.
    const first=(initialFocusSelector?node.querySelector<HTMLElement>(initialFocusSelector):null)
      ??node.querySelector<HTMLElement>('.dialog-content button:not([disabled]), .dialog-content select:not([disabled]), .dialog-content input:not([disabled])')
      ??node.querySelector<HTMLElement>('.dialog-header button:not([disabled])');
    first?.focus({preventScroll:true});
    return () => { if (node.open) node.close(); };
  }, [initialFocusSelector]);
  return <dialog ref={ref} className={`game-dialog ${wide ? 'dialog-wide' : ''}`} aria-labelledby={titleId}
    onCancel={(event: SyntheticEvent<HTMLDialogElement>) => { event.preventDefault(); onClose(); }}>
    <div className="dialog-header"><h2 id={titleId}>{title}</h2><GameButton variant="text" className="icon-button" onClick={onClose} aria-label={t('close')}>×</GameButton></div>
    <div className="dialog-content">{children}</div>
  </dialog>;
}
