import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import '../web/styles.css';

export const metadata: Metadata = {
  title: 'MeowDeck',
  applicationName: 'MeowDeck',
  description: 'A Little Cat. A Clever Deck.',
  category: 'games'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#181E1B'
};

/** Server Component: stable HTML and metadata, with no browser-only game logic. */
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
