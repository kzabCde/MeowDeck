import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import '../web/design-system/tokens.css';
import '../web/design-system/base.css';
import '../web/design-system/controls.css';
import '../web/scenes/title.css';
import '../web/scenes/crazy-eights.css';
import '../web/scenes/blackjack.css';
import '../web/scenes/selection.css';
import '../web/responsive.css';

export const metadata: Metadata = {
  title: 'MeowDeck',
  applicationName: 'MeowDeck',
  description: 'A Little Cat. A Clever Deck.',
  category: 'games',
  manifest: '/manifest.webmanifest',
  appleWebApp: {capable:true,title:'MeowDeck',statusBarStyle:'black-translucent'},
  icons: {icon:'/icons/favicon.png',apple:'/icons/apple-touch-icon.png'}
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#061C1B'
};

/** Server Component: stable HTML and metadata, with no browser-only game logic. */
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
