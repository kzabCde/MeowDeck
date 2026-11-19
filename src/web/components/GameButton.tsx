import type { ButtonHTMLAttributes } from 'react';

/** The same physical action vocabulary on every MeowDeck screen.
 * Specialized playing-card and difficulty tiles remain separate controls.
 * All native button props, data-testid, aria-label and keyboard behavior pass through.
 */
export type GameButtonVariant = 'primary' | 'secondary' | 'cream' | 'text';
export interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GameButtonVariant;
}
export function GameButton({variant = 'secondary', className = '', type = 'button', ...props}:GameButtonProps) {
  const base = variant === 'text' ? 'md4-text-button' : `pixel-button button-${variant}`;
  return <button {...props} type={type} className={`${base} ${className}`.trim()} />;
}
