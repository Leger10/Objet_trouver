const env = {
  VITE_ONESIGNAL_APP_ID: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '',
  VITE_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  VITE_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'RetrouveMoi',
  VITE_ADMIN_EMAIL: process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'digihouse10@gmail.com',
  DEV: process.env.NODE_ENV !== 'production',
};

export default env;