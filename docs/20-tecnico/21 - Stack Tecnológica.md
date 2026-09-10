# 21 - Stack Tecnológica

> Reconciliado com o código em **2026-09-09** (`package.json` dos apps e de
> `packages/shared`). O repo é um **monorepo pnpm** com dois apps Next.js
> (`apps/client`, `apps/admin`) e um pacote compartilhado (`packages/shared`).
> A "Meta WhatsApp Cloud API" **não é usada** — SMS é Twilio Verify.

# Aplicação

- **Next.js 16** (App Router, Turbopack) — versão modificada; ler
  `node_modules/next/dist/docs/` antes de codar (ver `AGENTS.md`);
- **React 19**;
- TypeScript strict;
- Node.js ≥ 22;
- **Vercel** — dois projetos (`zelo-app` = client, `zelo-admin` = admin);
- PWA instalável (service worker próprio em cada app).

# Interface

- **Tailwind CSS v4**;
- **Radix UI** (`radix-ui`) + primitivos próprios em `src/components/ui`
  (padrão shadcn), `class-variance-authority`, `clsx`, `tailwind-merge`;
- `lucide-react` (ícones);
- **React Hook Form** + **Zod v4** (`@hookform/resolvers`);
- **TanStack Query v5**;
- **Zustand v5** (estado de carrinho/checkout no client);
- fontes Fraunces + Nunito, tokens OKLCH, `--radius` 0.5rem — redesign
  editorial minimalista, plano `100-planejamento/102`;
- `react-easy-crop` (só no admin, recorte de imagem de produto).

# Dados e Backend

- **PostgreSQL via Supabase** (remoto compartilhado pelos dois apps);
- Supabase Auth (sessões separadas: cliente e admin);
- Supabase Realtime;
- Supabase Storage (bucket `product-images`, público);
- `@supabase/ssr` + `@supabase/supabase-js`;
- Supabase CLI + SQL migrations em `supabase/migrations/`;
- **Supabase Cron** (`supabase/cron/`) para a reconciliação de Pix.

# Integrações

- **Twilio Verify** — OTP por SMS do cliente (com fallback: o app gera e
  hasheia o código quando não há Twilio configurado);
- **Mercado Pago** — cobrança Pix dinâmica (Orders API) + webhook + estorno;
- **Cloudflare Turnstile** — captcha no fluxo de OTP;
- **Google Maps Platform** — Places API (New), Geocoding, Maps JS API
  (satélite). Leaflet/OSM ficaram só como fallback de geocodificação;
- **Web Push** (VAPID, `web-push`) — push do cliente e do painel;
- **Sentry** (`@sentry/nextjs`);
- `@vercel/analytics` (só no client);
- `sharp` — processamento de imagem.

# Qualidade

Sem bibliotecas de teste automatizado. **Não instalar** Vitest, Testing
Library, Playwright ou MSW.

Verificação obrigatória por fase:

```
pnpm typecheck && pnpm lint && pnpm build
```

mais verificação manual dos fluxos afetados.

# Internacionalização

Sem i18n. Toda a interface em português do Brasil.
