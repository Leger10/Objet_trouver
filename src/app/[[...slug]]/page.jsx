'use client';

import dynamic from 'next/dynamic';
import { HelmetProvider } from 'react-helmet-async';

const App = dynamic(() => import('@/App'), { ssr: false });

export default function CatchAllPage() {
  return (
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );
}