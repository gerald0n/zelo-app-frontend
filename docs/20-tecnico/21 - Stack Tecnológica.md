# 21 - Stack Tecnológica — Revisado

> ⚠️ **Parcialmente desatualizado (ago/2026).** "Meta WhatsApp Cloud API"
> **não é usada**. As integrações reais são Twilio Verify (SMS), Mercado
> Pago (Pix), Cloudflare Turnstile, Google Maps, Web Push e Sentry. Ver
> `31 - Estado da Implementação vs. Documentação de Referência.md`.

# Aplicação

- Next.js;
- App Router;
- TypeScript;
- Node.js;
- Vercel;
- PWA instalável.

# Interface

- Tailwind CSS;
- shadcn/ui;
- React Hook Form;
- Zod;
- TanStack Query;
- Zustand.

# Dados e Backend

- PostgreSQL via Supabase;
- Supabase Auth;
- Supabase Realtime;
- Supabase Storage;
- Supabase Client;
- Supabase CLI e SQL migrations.

# Integrações

- Meta WhatsApp Cloud API;
- Google Maps Platform;
- Web Push;
- Sentry.

# Qualidade

O projeto não utilizará bibliotecas de testes automatizados na primeira versão.

Não instalar:

- Vitest;
- Testing Library;
- Playwright;
- MSW.

A verificação obrigatória será composta por:

- Prettier;
- ESLint;
- TypeScript;
- build;
- verificação manual dos fluxos afetados.

# Internacionalização

O projeto não utilizará internacionalização.

Toda interface será escrita em português.
