import { z } from 'zod';

const appEnvSchema = z.enum(['local', 'preview', 'production']);

const envSchema = z.object({
  APP_ENV: appEnvSchema.default('local'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional().or(z.literal('')),
  SENTRY_DSN: z.string().url().optional().or(z.literal('')),
  TWILIO_ACCOUNT_SID: z.string().min(1).optional().or(z.literal('')),
  TWILIO_AUTH_TOKEN: z.string().min(1).optional().or(z.literal('')),
  TWILIO_VERIFY_SERVICE_SID: z.string().min(1).optional().or(z.literal('')),
  TWILIO_VERIFY_SMS_SERVICE_SID: z.string().min(1).optional().or(z.literal('')),
  GOOGLE_MAPS_API_KEY: z.string().min(1).optional().or(z.literal('')),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z
    .string()
    .min(1)
    .optional()
    .or(z.literal('')),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional().or(z.literal('')),
  VAPID_PRIVATE_KEY: z.string().min(1).optional().or(z.literal('')),
  VAPID_SUBJECT: z.string().min(1).optional().or(z.literal('')),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional().or(z.literal('')),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional().or(z.literal('')),
});

export type AppEnv = z.infer<typeof appEnvSchema>;

const parsed = envSchema.safeParse({
  APP_ENV: process.env.APP_ENV,
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_URL: process.env.SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  SENTRY_DSN: process.env.SENTRY_DSN,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_VERIFY_SERVICE_SID: process.env.TWILIO_VERIFY_SERVICE_SID,
  TWILIO_VERIFY_SMS_SERVICE_SID: process.env.TWILIO_VERIFY_SMS_SERVICE_SID,
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  VAPID_SUBJECT: process.env.VAPID_SUBJECT,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
});

if (!parsed.success) {
  throw new Error(
    `Variáveis de ambiente inválidas: ${parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')}`,
  );
}

const env = parsed.data;

export function getAppEnv(): AppEnv {
  return env.APP_ENV;
}

export function isProductionLike(): boolean {
  return env.APP_ENV === 'production' || env.NODE_ENV === 'production';
}

/** Chave pública do cliente (anon ou publishable). */
export function getSupabasePublishableKey(): string {
  const key =
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error(
      'Defina NEXT_PUBLIC_SUPABASE_ANON_KEY ou NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    );
  }
  return key;
}

/** URL pública (browser / Realtime no celular). */
export function getSupabaseUrl(): string {
  if (!env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Defina NEXT_PUBLIC_SUPABASE_URL.');
  }
  return env.NEXT_PUBLIC_SUPABASE_URL;
}

/**
 * URL usada pelo Next no servidor (admin, SSR, RPCs).
 * Em LAN/WSL, prefira SUPABASE_URL=http://127.0.0.1:54321 para evitar
 * hairpin pelo IP Wi‑Fi; o browser continua com NEXT_PUBLIC_*.
 */
export function getSupabaseServerUrl(): string {
  return env.SUPABASE_URL || getSupabaseUrl();
}

export function getSupabaseServiceRoleKey(): string {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Defina SUPABASE_SERVICE_ROLE_KEY (somente servidor).');
  }
  return env.SUPABASE_SERVICE_ROLE_KEY;
}

export function hasSupabasePublicConfig(): boolean {
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL &&
    (env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  );
}

export function getTwilioAccountSid(): string | undefined {
  return env.TWILIO_ACCOUNT_SID || undefined;
}

export function getTwilioAuthToken(): string | undefined {
  return env.TWILIO_AUTH_TOKEN || undefined;
}

export function getTwilioVerifyServiceSid(): string | undefined {
  return env.TWILIO_VERIFY_SERVICE_SID || undefined;
}

export function getTwilioVerifySmsServiceSid(): string | undefined {
  return env.TWILIO_VERIFY_SMS_SERVICE_SID || undefined;
}

/** Serviço Verify usado no OTP por SMS. */
export function getTwilioOtpServiceSid(): string | undefined {
  return getTwilioVerifySmsServiceSid() || getTwilioVerifyServiceSid();
}

export function hasTwilioVerifyConfig(): boolean {
  return Boolean(
    getTwilioAccountSid() && getTwilioAuthToken() && getTwilioOtpServiceSid(),
  );
}

export function getSentryDsn(): string | undefined {
  const dsn = env.SENTRY_DSN || env.NEXT_PUBLIC_SENTRY_DSN;
  return dsn || undefined;
}

/** Chave de servidor para Geocoding + Distance Matrix (opcional). */
export function getGoogleMapsApiKey(): string | undefined {
  const key = env.GOOGLE_MAPS_API_KEY || env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  return key || undefined;
}

export function hasGoogleMapsConfig(): boolean {
  return Boolean(getGoogleMapsApiKey());
}

export function getVapidPublicKey(): string | undefined {
  return env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined;
}

export function getVapidPrivateKey(): string | undefined {
  return env.VAPID_PRIVATE_KEY || undefined;
}

export function getVapidSubject(): string {
  return env.VAPID_SUBJECT || 'mailto:ops@zelo.local';
}

export function hasWebPushConfig(): boolean {
  return Boolean(getVapidPublicKey() && getVapidPrivateKey());
}

export function getTurnstileSiteKey(): string | undefined {
  return env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined;
}

export function getTurnstileSecretKey(): string | undefined {
  return env.TURNSTILE_SECRET_KEY || undefined;
}

export function hasTurnstileConfig(): boolean {
  return Boolean(getTurnstileSiteKey() && getTurnstileSecretKey());
}

export { env };
