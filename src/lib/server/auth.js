import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { admin } from 'better-auth/plugins';
import { prisma } from './db';

export const auth = betterAuth({
  appName: process.env.VITE_APP_NAME || 'RetrouveMoi',
  database: prismaAdapter(prisma, { provider: 'mysql' }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    maxPasswordLength: 128,
  },
  user: {
    additionalFields: {
      phone: { type: 'string', input: true, required: false },
      city: { type: 'string', input: true, required: false },
      quarter: { type: 'string', input: true, required: false },
      referredBy: { type: 'string', input: true, required: false },
      referralCode: { type: 'string', input: false, required: false },
      points: { type: 'number', input: false, required: false, defaultValue: 0 },
      pointsEarned: { type: 'number', input: false, required: false, defaultValue: 0 },
      plan: { type: 'string', input: false, required: false, defaultValue: 'free' },
      role: { type: 'string', input: false, required: false, defaultValue: 'user' },
      blocked: { type: 'boolean', input: false, required: false, defaultValue: false },
    },
  },
  plugins: [
    admin({
      adminUserIds: [],
      defaultRole: 'user',
      adminRoles: ['admin'],
    }),
    nextCookies(),
  ],
  trustedOrigins: [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    'https://retrouvemoi.netlify.app',
    'https://objettrouver.netlify.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ].filter(Boolean),
});

export default auth;