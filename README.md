# Zelo Confeitaria

Cardápio online da Zelo Confeitaria (Next.js App Router + Supabase).

Estado atual: **fases A–K implementadas** (catálogo, carrinho, checkout, pedidos, admin, realtime, push/PWA). Próximo passo: **Fase L — Deploy / produção**.

## Commits

Seguir Conventional Commits, com **uma única linha em português (pt-BR)** e sem `Co-authored-by: Cursor`.

Exemplo: `feat: adiciona CRUD de categorias no painel admin`

Detalhes: `docs/90-agentes/90 - Instruções para Agentes de IA.md` e Constituição do Projeto.

## Branches (GitHub)

| Branch | Uso |
| --- | --- |
| `develop` | Desenvolvimento contínuo (branch padrão de trabalho) |
| `main` | Produção — só recebe releases estáveis |

Fluxo:

1. Trabalhe em `develop` (ou em `feature/...` a partir de `develop`).
2. Abra PR `feature/...` → `develop`.
3. Quando for publicar: PR `develop` → `main` (release).

```bash
git checkout develop
git pull origin develop
```

## Rodar

```bash
pnpm install
pnpm db:start
pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Outro dispositivo (mesmo Wi‑Fi, WSL2)

1. **Windows PowerShell (Admin)**, uma vez (ou após reiniciar o PC/WSL):

```powershell
cd \\wsl$\Ubuntu\home\geraldogomesss\dev\projects\zelo
# ou a pasta do projeto montada no Windows
powershell -ExecutionPolicy Bypass -File .\scripts\windows-lan-proxy.ps1
```

2. **No WSL**:

```bash
pnpm db:start
pnpm dev:lan
```

3. No celular: o script imprime a URL (hoje algo como `http://192.168.0.5:3000`).

`dev:lan` sobe o Next em `0.0.0.0` e aponta `NEXT_PUBLIC_SUPABASE_URL` para o IP do Windows, para Auth/Realtime funcionarem no celular. Confira com `pnpm lan:info`.

Se o IP Wi‑Fi mudar, rode o proxy de novo e reinicie `pnpm dev:lan`. Opcional: `DEV_LAN_HOST=192.168.x.x`.

## Scripts

| Script              | Uso                         |
| ------------------- | --------------------------- |
| `pnpm dev`          | Servidor de desenvolvimento |
| `pnpm dev:lan`      | Dev acessível no Wi‑Fi (WSL) |
| `pnpm lan:info`     | Mostra IP/URL da LAN        |
| `pnpm dev:https`    | Dev com HTTPS (testar push) |
| `pnpm build`        | Build de produção           |
| `pnpm start`        | Servir build                |
| `pnpm lint`         | ESLint                      |
| `pnpm typecheck`    | TypeScript (`tsc --noEmit`) |
| `pnpm format`       | Prettier (escrever)         |
| `pnpm format:check` | Prettier (verificar)        |

## Stack

- Next.js 16 (App Router)
- TypeScript strict
- Tailwind CSS 4 + shadcn/ui
- TanStack Query (estado remoto)
- React Hook Form + Zod (formulários)
- Zustand (carrinho)
- Supabase local (Postgres, Auth, Storage, Realtime)
- Web Push + PWA
- Sentry (ativo com DSN)
- Twilio Verify (SMS) para OTP

## Banco local (Fase B)

```bash
pnpm db:start    # sobe o stack Docker
pnpm db:reset    # reaplica migrations + seed
pnpm gen:types   # regenera src/types/database.ts
pnpm db:stop     # encerra containers
```

Studio: http://127.0.0.1:54323

Copie `.env.example` → `.env.local` e preencha as chaves de `pnpm db:status`.

### OTP por SMS (Twilio Verify)

Em local, sem `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_VERIFY_SERVICE_SID`, o código aparece na tela de verificação.

O envio usa o canal **SMS** do Twilio Verify. Ative o Brasil em **Messaging → Geo Permissions**.

Para envio real:

1. Crie um Verify Service na Twilio.
2. Deixe o canal SMS ligado no serviço.
3. Libere o Brasil em Geo Permissions.
4. Preencha no `.env.local`:

```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Reinicie o Next. Em production o Twilio Verify é obrigatório.

## O que já existe

### Catálogo e loja (Fases D–F)

- Home, busca, PDP e `/loja` leem do Supabase
- Carrinho Zustand (`@zelo/cart:v1`, expiração 7 dias)
- Entrega em Pereiro, taxa por rota, agendamento (regra das 17h)

### Checkout e pedidos (Fases G–H)

- Login do cliente por OTP (SMS via Twilio Verify em production; código visível em local sem a API)
- Identificação só com celular; o nome é pedido uma vez se a conta ainda não tiver
- Carrinho local unido ao da conta no login e sincronizado entre dispositivos
- `POST /api/v1/checkout/preview` e `POST /api/v1/orders`
- Acompanhamento, cancelamento e recompra

### Painel administrativo (Fase I)

Login: `admin@zeloconfeitaria.com.br` / `admin123`

- Pedidos: fila, detalhe, status e cancelamento
- Catálogo: CRUD de categorias, produtos e adicionais
- Upload de imagens (`product-images`)
- Disponibilidade rápida de produtos
- Configurações da loja, horários semanais, blackouts e auditoria

### Realtime / Push / PWA (Fases J–K)

- Canais admin e cliente com refetch via TanStack Query
- Manifest, service worker, assinatura push após pedido
- VAPID: gere com `pnpm exec web-push generate-vapid-keys`

## Próximos passos

1. **Fase L — Deploy** (Vercel ou VPS, Supabase prod, domínio, variáveis, validação)
2. **Fase M — Twilio Verify SMS em produção** (Geo Permissions no Brasil, OTP real)
3. **Fase N — Encerramento** (limpeza, docs, segurança)

Detalhes: `docs/100-planejamento/`.
