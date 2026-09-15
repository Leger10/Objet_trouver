import '@/index.css';

export const metadata = {
  title: 'RetrouveMoi — Retrouver un objet perdu et le rendre',
  description:
    'RetrouveMoi facilite la restitution citoyenne des objets trouvés : déclarez, cherchez, et retrouvez vos effets personnels.',
  manifest: '/manifest.json',
  applicationName: 'RetrouveMoi',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'RetrouveMoi',
  },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#2D6A4F',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <meta name="theme-color" content="#2D6A4F" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}