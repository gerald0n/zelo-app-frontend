# Auditoria de segurança — 03/09/2026

Revisão do checklist enviado contra o estado atual do `zelo-app-frontend`
(branch `develop`, commit `1595f32`).

**Resumo:** a base já estava fortemente endurecida. Dos 20 itens, 15 estavam
✅ completos; os 5 restantes (⚠️/❌) foram corrigidos em 03/09/2026 — ver
**"Status final"** no fim do documento. Nenhuma vulnerabilidade crítica ou
exploração direta encontrada.

| # | Item | Estado |
|---|------|--------|
| 1 | Esconder API keys | ✅ |
| 2 | Limpar secrets do git | ✅ |
| 3 | Public key do DB | ✅ |
| 4 | Ativar RLS | ✅ |
| 5 | Criptografia de dados | ⚠️ hash do OTP fraco |
| 6 | Auth server-side | ✅ |
| 7 | Restringir acessos | ✅ |
| 8 | Bloquear mass assignment | ✅ |
| 9 | Proteger cookies | ✅ |
| 10 | Hash nas senhas | ✅ (ver #5 p/ OTP) |
| 11 | Rate limit | ⚠️ cobertura parcial + IP spoofável |
| 12 | Bot protection | ✅ |
| 13 | Queries parametrizadas | ✅ |
| 14 | Validação de inputs | ✅ |
| 15 | Vazar conteúdo | ✅ |
| 16 | Restringir uploads | ⚠️ MIME não verificado por conteúdo |
| 17 | Trim de respostas de API | ✅ |
| 18 | Security headers | ⚠️ `unsafe-inline`, `X-Powered-By` |
| 19 | Forçar HTTPS | ✅ |
| 20 | Supply chain de dependências | ❌ 4 highs (`fast-uri`), sem gate em CI |

---

## Itens ✅ (verificados, sem ação)

### 1. Esconder API keys
- `.env`, `.env.local`, `.env.*.local` no `.gitignore`; só `.env.example` versionado, com valores vazios.
- Chaves de servidor sempre atrás de getters em `src/config/env.ts`; `src/lib/supabase/admin.ts` e os módulos usam `import 'server-only'`.
- `NEXT_PUBLIC_*` só para o que é público de fato: chave anon/publishable do Supabase, VAPID public, site key do Turnstile.
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` é opcional e o `.env.example` já orienta a restringir por IP/referrer no console do Google.

### 2. Limpar secrets do git
- `git log --all --diff-filter=A` não mostra nenhum `.env` jamais adicionado.
- Varredura de segredos (`eyJ…`, `sk_live`, `AKIA`, `xox…`, `SERVICE_ROLE`) nos arquivos versionados: limpa.
- `seed-operacional.prod.sql` (dados reais de tenant) está no `.gitignore`; só o modelo com placeholders é versionado.

### 3. Public key do DB
- A chave anon/publishable do Supabase é feita para ser pública; a proteção real é RLS (item 4). Service role key nunca sai do servidor.

### 4. Ativar RLS
- Todas as tabelas de `public` têm `enable row level security` + políticas (`20260809144928_initial_schema.sql:1132+`).
- Cliente: `carts`, `cart_items`, `orders`, `customer_addresses`, `push_subscriptions` escopados por `private.current_customer_id()`.
- Admin: gestão via `private.is_admin()`.
- Catálogo: leitura pública só quando `is_active and archived_at is null`.
- `http_rate_limits`, `customer_otp_challenges`, `payment_events`, `idempotency_keys`: RLS on + `revoke all from anon, authenticated`.
- Storage `product-images`: leitura pública, escrita só admin.
- `supabase/config.toml`: `max_rows = 1000` limita payload; `schemas = ["public"]` (schema `private` não exposto na API).

### 6. Auth server-side
- `requireAdmin()` (`src/modules/admin/auth.ts`, `server-only`) revalida `auth.getUser()` + `admin_profiles.is_active` em **toda** função de módulo admin (60+ call sites em `catalog.ts`, `orders.ts`, `audit.ts`).
- `src/proxy.ts` é explicitamente "otimista" — só redireciona; a autorização real é no servidor.
- Cookies de sessão `httpOnly` (cliente não lê token).

### 7. Restringir acessos
- `revoke all on schema private from public`.
- RPCs: `revoke all … from public` + grant restrito a `service_role` (ou `authenticated` quando é o caso).
- `consume_rate_limit`, `refund_order_pix_payment`, `confirm/fail_order_pix_payment` etc. só `service_role`.

### 8. Bloquear mass assignment
- Rotas transformam input em campos explícitos ou schema Zod; inserts/updates montam mapa de colunas nomeadas (nunca spread do body).
- `20260827210000_security_hardening.sql`: `revoke update on customers from authenticated` + `grant update (name, updated_at)` — trava de mass-assignment no nível do banco.

### 9. Proteger cookies
- `src/lib/supabase/cookie-options.ts`: `httpOnly`, `sameSite=lax`, `secure` em produção, `path=/`.

### 10. Hash nas senhas
- Admin: Supabase Auth (bcrypt). Migration antiga que setava `admin123` foi neutralizada (`20260819140000`), credencial de dev só no `seed.sql` (não roda em produção).
- Cliente: sem senha (fluxo OTP). Ver #5 para reforçar o hash do OTP.

### 12. Bot protection
- Cloudflare Turnstile obrigatório em produção no envio de OTP e login admin (`assertProductionEnv()` derruba o boot sem as chaves).
- Honeypot (`website`) + rate limit por IP em ambos.
- `verifyTurnstileToken` valida server-side no siteverify com timeout de 8s.

### 13. Queries parametrizadas
- Tudo via query builder do supabase-js ou `.rpc()` com parâmetros nomeados. Zero SQL interpolado.
- Funções SQL: `security definer` + `set search_path = public`, corpo fixo.

### 14. Validação de inputs
- Zod na borda (rota ou módulo): `createOrderBodySchema`, `cartSyncBodySchema`, `bodySchema` do OTP, etc.
- Parâmetros de query em allowlist de enum (`scope`, `type`).

### 15. Vazar conteúdo
- `src/lib/logger.ts`: `scrubObject` recursivo redige chaves `password|token|secret|authorization|cookie|otp|api_key|service_role`.
- Erros ao cliente via `publicErrorBody()` — sem stack/internals. Logs `info` suprimidos em produção. Payloads do Sentry passam pelo scrub.

### 17. Trim de respostas de API
- Respostas montam DTOs explícitos (mappers) e `.select('col, col')` na maioria dos casos.
- `max_rows = 1000` global. `select('*')` restante é em tabelas de catálogo público / leituras admin — aceitável.

### 19. Forçar HTTPS
- `src/proxy.ts`: redirect 308 `x-forwarded-proto: http` → `https` em produção.
- HSTS `max-age=63072000; includeSubDomains; preload`.
- `upgrade-insecure-requests` na CSP de produção.

---

## Itens ⚠️ — ajustes recomendados

### 5. Criptografia de dados — hash do OTP
**`src/modules/auth/otp.ts:41`** — `hashOtp = sha256(phoneE164 + code)`, sem sal
nem segredo. Código de 6 dígitos = 10⁶ possibilidades: se a tabela
`customer_otp_challenges` vazar, um atacante com o telefone recupera o código
por força bruta em milissegundos.

Mitigado por: TTL curto, `MAX_ATTEMPTS = 5`, tabela sob RLS (sem acesso
anon/authenticated). Severidade baixa, correção barata.

**Fix:** trocar por `HMAC-SHA256(code, OTP_HASH_SECRET)` com um segredo dedicado
(nova env var), mantendo `timingSafeEqual` na comparação (já usado em
`mercadopago.ts:380`).

Dados em repouso no Supabase já têm criptografia de disco + TLS em trânsito.
PII (telefone, endereço, lat/long) em claro é aceitável para o caso de uso
(cifra de coluna quebraria buscas).

### 11. Rate limit — cobertura e origem do IP
- **Cobertura:** `enforceIpRateLimit` cobre OTP (send/verify) e login admin. **Não** cobre `POST /api/v1/orders`, CRUD de endereços, nem `PUT /api/v1/cart`. Um cliente autenticado pode gerar volume. Recomendo um limite grosso (ex.: 30 pedidos / 10 min / IP).
- **Origem do IP:** `src/lib/request-ip.ts` usa o primeiro token de `x-forwarded-for`, que é controlado pelo cliente. Em Vercel, usar `request.headers.get('x-vercel-forwarded-for')` ou `x-real-ip` (preenchidos pela plataforma). Impacto: só enfraquece o rate limit (dá pra furar trocando o header), não é bypass de auth.

### 16. Restringir uploads — validar conteúdo, não só o header
**`src/modules/admin/catalog.ts:571`** — a validação de tipo confia em
`file.type` (Content-Type do cliente). Um arquivo com header forjado
(ex.: SVG/HTML rotulado `image/png`) entra no bucket, que é de leitura pública.

Mitigado por: upload é admin-only; a CSP de produção (`img-src` restrito a
`*.supabase.co` / tiles) impede execução inline no nosso domínio. Ainda assim,
o objeto fica servível direto no domínio do Supabase.

**Fix:** re-encodar a imagem no servidor com `sharp` (já é dependência) —
garante que é uma imagem real e remove metadata. Alternativa mais leve:
checar magic bytes (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF…WEBP`).

### 18. Security headers — endurecer a CSP
`src/config/security-headers.ts` já é bom (CSP estrita em produção, sem
`unsafe-eval`, HSTS, `frame-ancestors 'none'`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy`). Faltas:

- **`script-src` mantém `'unsafe-inline'` em produção** — sem nonce/hash, a
  principal defesa contra XSS fica desligada. Next 16 suporta nonce via
  `proxy.ts` (gera nonce por request, injeta no header e o Next propaga aos
  scripts). Mudança maior (toca `proxy.ts` + qualquer `<script>` inline).
- **`X-Powered-By: Next.js`** não desativado → `poweredByHeader: false` no
  `next.config.ts`.
- Sem `Cross-Origin-Opener-Policy` / `Cross-Origin-Resource-Policy`.

---

## Item ❌ — supply chain

### 20. Scam de dependências
`pnpm audit --prod`: **4 highs**, todos o mesmo transitivo
**`fast-uri < 3.1.6`** (SSRF + host confusion via IDN), puxado por:
- `@hookform/resolvers@5.7.1 > ajv@8.20.0 > fast-uri`
- `@sentry/nextjs > @sentry/webpack-plugin > … > ajv > fast-uri` (build-time)

**Fix imediato:** `pnpm.overrides` fixando `fast-uri@^3.1.6` no `package.json`
+ `pnpm install`.

**Faltando também:**
- Sem `pnpm audit` no CI (não há `.github/workflows` que rode isso).
- Sem Dependabot / Renovate.
- `pnpm-lock.yaml` versionado ✅; considerar `pnpm config set verify-store-integrity true` e `--frozen-lockfile` no CI.

---

## Plano de ação sugerido

**Aplicar já (seguro, sem decisão):**
- **A.** `pnpm.overrides` → `fast-uri@^3.1.6` (item 20)
- **B.** `poweredByHeader: false` no `next.config.ts` (item 18)
- **C.** `crypto.timingSafeEqual` na checagem do `CRON_SECRET` em `src/app/api/v1/cron/reconcile-pix/route.ts` (item 7/13)

**Decidir antes de aplicar:**
- **D.** Re-encode de imagem com `sharp` no upload (item 16) — pode mudar levemente o output; testar o fluxo admin
- **E.** OTP hash → HMAC + `OTP_HASH_SECRET` (item 5) — precisa de nova env var em todos os ambientes
- **F.** CSP com nonce, remover `unsafe-inline` (item 18) — mudança estrutural no `proxy.ts`
- **G.** Rate limit em pedidos/endereços/carrinho (item 11)
- **H.** Extração de IP confiável atrás do proxy da Vercel (item 11)
- **I.** CI: gate de `pnpm audit` + Dependabot (item 20)

---

## Status final — 03/09/2026

Todos os 20 itens ✅. Build de produção, typecheck, lint e `pnpm audit --prod`
limpos; CSP com nonce verificada no browser (páginas hidratam, sem violação no
console).

| Item | O que foi feito | Arquivos |
|------|-----------------|----------|
| 20 | `pnpm.overrides` → `fast-uri >=3.1.6` (4 highs → 0) | `package.json` |
| 18 | `poweredByHeader: false` | `next.config.ts` |
| 18 | +`Cross-Origin-Opener-Policy` e `-Resource-Policy: same-origin` | `src/config/security-headers.ts` |
| 18 / 7 | `timingSafeEqual` na checagem do `CRON_SECRET` | `src/app/api/v1/cron/reconcile-pix/route.ts` |
| 18 | **CSP com `nonce` por request** (`script-src 'self' 'nonce-…' 'strict-dynamic'`, sem `'unsafe-inline'` em produção). CSP saiu do `next.config` e passou a ser emitida pelo `proxy`. App forçado a render dinâmico (`export const dynamic` no layout raiz) — custo baixo, quase tudo já era dinâmico. `style-src 'unsafe-inline'` mantido (atributos `style=` do React; não executa script). | `src/config/security-headers.ts`, `src/proxy.ts`, `src/app/layout.tsx` |
| 5 / 10 | OTP hash: `sha256(concat)` → **`HMAC-SHA256` com `OTP_HASH_SECRET` dedicado** + `timingSafeEqual` na comparação. Fora de produção cai numa derivação da service role key; em produção o boot exige a env. | `src/config/env.ts`, `src/modules/auth/otp.ts`, `.env.example` |
| 16 | Upload de imagem: **re-encode server-side com `sharp`** (WebP, resize máx. 2000px, metadata removida). Não confia mais no `Content-Type` do cliente; arquivo não-bitmap é rejeitado. `sharp` movido para `dependencies`. | `src/modules/admin/catalog.ts`, `package.json` |
| 11 | Rate limit por IP em `POST /orders` (20/10min), endereços write (40/10min), `PUT /cart` (240/5min). | `src/app/api/v1/orders/route.ts`, `.../addresses/route.ts`, `.../addresses/[addressId]/route.ts`, `.../cart/route.ts` |
| 11 | IP confiável: prefere `x-vercel-forwarded-for` / `x-real-ip` antes de `x-forwarded-for`. | `src/lib/request-ip.ts` |
| 20 | CI: passo `pnpm audit --prod --audit-level high` + `.github/dependabot.yml` (npm semanal + github-actions). | `.github/workflows/ci.yml`, `.github/dependabot.yml` |

### Ação de deploy necessária
- **Definir `OTP_HASH_SECRET`** (`openssl rand -hex 32`) nos ambientes preview e
  production da Vercel **antes** do próximo deploy — o boot em produção falha sem
  ela. Sessões OTP em aberto no momento do deploy passam a falhar a verificação
  (TTL de 10 min); impacto desprezível.

### Risco residual aceito
- `style-src 'unsafe-inline'` (necessário p/ React; injeção de estilo ≠ XSS).
- `script-src` sem `'unsafe-inline'` só vale em navegadores CSP3 (~96%+); os
  demais caem no host-allowlist.
