// lib/auth/index.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/lib/db/client';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    // db was created with { schema }, so db._.fullSchema is populated.
    // camelCase: true tells the adapter our schema keys are camelCase
    // (e.g. emailVerified, userId) rather than snake_case.
    camelCase: true,
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Request GCal scope alongside the standard openid/email/profile
      // scopes that Better Auth adds by default.
      scope: ['https://www.googleapis.com/auth/calendar'],
      // Offline access ensures we receive a refresh token so the GCal
      // layer can call the API on the user's behalf between sessions.
      accessType: 'offline',
    },
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'],
  secret: process.env.BETTER_AUTH_SECRET!,
});

export type Auth = typeof auth;
