# 29 - Deploy e Ambientes

> ⚠️ **Variáveis desatualizadas (ago/2026).** As variáveis da Meta Cloud
> API **não existem**. As obrigatórias em produção hoje (ver
> `packages/shared/src/config/env.ts`) incluem Twilio Verify, Cloudflare
> Turnstile, Mercado Pago, `CRON_SECRET` e `OTP_HASH_SECRET`. O deploy são
> **dois projetos Vercel** (`apps/client`, `apps/admin`) + **Supabase Cron**
> para reconciliação de Pix. Delta em `31 - Estado da Implementação vs.
> Documentação de Referência.md` §5.

# Objetivo

Este documento define ambientes, variáveis, migrations e processo de deploy.

---

# Ambientes

## Local

Utilizado para desenvolvimento.

Deve possuir:

- Node.js 22+ (`.nvmrc`; `nvm use`). O `@supabase/supabase-js` e a CLI
  avisam em versões abaixo de 22;
- Next.js local;
- Supabase local quando aplicável;
- variáveis de ambiente próprias;
- dados fictícios;
- integrações externas em modo controlado.

Vercel e CI usam Node 22 (`engines.node` no `package.json` / `.nvmrc`).

## Preview

Criado pela Vercel para branches e Pull Requests.

Deve usar:

- banco de preview ou desenvolvimento controlado;
- chaves separadas de produção;
- Sentry identificado como preview;
- Meta e Google Maps com credenciais restritas.

## Produção

Ambiente utilizado pela Loja e Clientes.

Deve possuir:

- domínio oficial;
- HTTPS;
- Supabase de produção;
- credenciais exclusivas;
- monitoramento;
- backups;
- políticas RLS ativas.

---

# Variáveis de Ambiente

Devem ser validadas no startup.

Categorias:

## Públicas

Somente valores seguros para o navegador.

Exemplos:

- URL pública do Supabase;
- chave pública anon;
- chave pública VAPID;
- identificadores públicos do Google Maps quando restritos.

## Privadas

Somente no servidor.

Exemplos:

- Supabase service role key;
- token da Meta Cloud API;
- app secret da Meta;
- segredo do hook;
- chave privada VAPID;
- segredos do Sentry;
- chaves privadas de integrações.

---

# Arquivo `.env.example`

Deve:

- listar todas as variáveis;
- não conter valores reais;
- explicar finalidade;
- indicar se é pública ou privada;
- indicar ambiente aplicável.

---

# Vercel

A Vercel será responsável por:

- build;
- preview deployments;
- produção;
- variáveis de ambiente;
- domínio;
- logs de runtime;
- integração com Sentry.

## Região das Functions

O Supabase de produção roda em `sa-east-1` (São Paulo). As Serverless
Functions (SSR, RSC e rotas `/api`) **devem** rodar na mesma região, senão
cada ida ao banco/Auth cruza o continente (~110 ms por round-trip, em série).

Cada app fixa a região em `vercel.json` (`apps/client/vercel.json` e
`apps/admin/vercel.json`):

```json
{ "regions": ["gru1"] }
```

`gru1` = São Paulo, co-locada com o `sa-east-1` do Supabase. O
`vercel.json` tem precedência sobre a região default do projeto no
dashboard. Edge Middleware (`proxy.ts`) continua rodando no PoP mais
próximo do usuário — não é afetado por `regions`.

## Cache do catálogo público

O cardápio (`/`, `/loja`, `/produto/[id]`, `/busca` e `/api/v1/catalog/*`)
é servido do Data Cache do Next (`unstable_cache`), com TTL de 60 s
(catálogo/loja) e 300 s (depoimentos). O `apps/admin` **não** usa a camada
cacheada — lê direto do banco para não mostrar dado velho após gravar.

Como os dois apps são deploys separados (Data Cache independente), o painel
invalida o cache do cliente por HTTP após cada edição de catálogo/loja:
`writeAuditLog` dispara `POST {CLIENT_APP_ORIGIN}/api/v1/internal/revalidate`
com `Authorization: Bearer {CATALOG_REVALIDATE_SECRET}` (via `after()`, sem
somar latência à mutação). Sem essas duas envs a propagação cai só no TTL.

| Variável | Onde | Valor |
| --- | --- | --- |
| `CATALOG_REVALIDATE_SECRET` | **ambos** os apps | `openssl rand -hex 32` — o mesmo nos dois |
| `CLIENT_APP_ORIGIN` | só `apps/admin` | `https://cardapio.zeloconfeitaria.com.br` |

---

# Supabase

Cada ambiente deve possuir configuração correspondente.

Nunca apontar preview ou desenvolvimento para produção sem decisão explícita.

## Administrador em produção

O `seed.sql` cria o admin de desenvolvimento (`admin@zeloconfeitaria.com.br`
/ `admin123`) e **não roda em produção** (`db push` / `migration up` ignoram
o seed). Em produção, criar o admin manualmente:

1. Supabase Studio → Authentication → Add user → e-mail real + senha forte
   (ou `supabase.auth.admin.createUser` via script com service role).
2. Inserir a linha correspondente:

   ```sql
   insert into public.admin_profiles (id, display_name, is_active)
   values ('<uuid-do-auth-user>', 'Nome do admin', true);
   ```

3. Guardar a senha em cofre; trocar no primeiro acesso pelo painel
   (Configurações → Senha).

Nunca usar `admin123` fora do ambiente local.

---

# Migrations

Regras:

- criar migrations por Supabase CLI;
- migrations aplicadas são imutáveis;
- erros devem ser corrigidos por nova migration;
- revisar constraints, índices e RLS;
- aplicar primeiro em ambiente não produtivo;
- registrar impacto;
- manter seed sem dados reais.

---

# Processo de Deploy

1. verificar alterações;
2. executar formatação;
3. executar ESLint;
4. executar typecheck;
5. executar build;
6. revisar migrations;
7. verificar variáveis;
8. publicar preview;
9. validar manualmente os fluxos afetados;
10. promover para produção;
11. verificar Sentry e logs.

---

# Validação Manual de Preview

Validar conforme o escopo:

- carregamento do cardápio;
- autenticação;
- Carrinho;
- checkout;
- cálculo da entrega;
- criação de Pedido;
- painel administrativo;
- alteração de status;
- Realtime;
- push;
- PWA;
- responsividade.

Não é necessário validar todos os fluxos em toda alteração. O agente deve selecionar os fluxos afetados e informar quais foram verificados.

---

# Rollback

O rollback da aplicação pode utilizar deploy anterior da Vercel.

Migrations destrutivas exigem estratégia própria.

Nunca assumir que rollback de código desfaz alteração de banco.

---

# Backups

A produção deve possuir backups do PostgreSQL conforme o plano do Supabase.

Antes de alterações de banco de alto risco:

- verificar backup;
- evitar operação destrutiva;
- planejar reversão;
- preservar histórico.

---

# Domínio e HTTPS

A produção deve utilizar domínio próprio e HTTPS obrigatório.

Cookies de sessão devem usar configurações seguras.

---

# Restrições de Chaves

Chaves do Google Maps devem possuir:

- restrição por domínio;
- restrição por API;
- separação entre cliente e servidor quando necessário.

Credenciais da Meta devem existir apenas no servidor.

---

# Service Worker

Alterações no service worker devem considerar cache de versões anteriores.

A aplicação deve:

- versionar caches;
- remover caches antigos;
- evitar manter HTML crítico obsoleto;
- atualizar o service worker de forma previsível.

---

# Monitoramento Pós-Deploy

Após produção, verificar:

- disponibilidade;
- erros novos;
- criação de Pedido;
- autenticação;
- Realtime;
- integrações;
- métricas do Sentry.

---

# Proibições

- segredos em código;
- `.env` real no repositório;
- migration antiga editada;
- deploy direto sem build;
- preview usando service role de produção;
- dados reais em seed;
- mudanças destrutivas sem plano.
