# 22 - Acesso a Dados e Integrações

> Reconciliado com o código em **2026-09-09** (ver `20-tecnico/31` §2.1,
> §2.2, §2.8). Inclui Mercado Pago (Pix dinâmico + webhook + reconciliação
> por Supabase Cron) e Cloudflare Turnstile. Distância de entrega é **linha
> reta**, não rota viária.

# Objetivo

Este documento define como a aplicação acessa o banco de dados e serviços externos.

---

# Fonte de Verdade

O PostgreSQL gerenciado pelo Supabase é a fonte de verdade para dados persistentes.

Estado do navegador, cache e Realtime nunca substituem os dados persistidos.

---

# Acesso ao Banco

Utilizar:

- Supabase Client;
- SQL migrations;
- tipos gerados pelo Supabase;
- funções PostgreSQL quando necessárias;
- Row Level Security.

Não utilizar ORM na primeira versão.

---

# Repositórios

O acesso ao banco é encapsulado em módulos de `packages/shared/src/modules/`
(ex.: `catalog/catalog-repository.ts`, `orders/`, `customers/`) e, no painel,
em `apps/admin/src/modules/admin/`.

Componentes React não contêm consultas complexas diretamente.

## Cache do catálogo público

O cardápio público é servido do **Data Cache do Next**
(`catalog/cached-catalog.ts`) com **invalidação on-demand**: quando o admin
muda produto/categoria/promoção, dispara `POST /api/v1/internal/revalidate`
(protegido por segredo) no app do cliente, que refaz as tags. Ver
`catalog/revalidate.ts` e o plano de performance no `_HANDOFF`.

---

# Clientes Supabase

## Cliente do servidor

Utilizado em Server Components, Server Actions, Route Handlers e casos de uso autenticados.

Deve respeitar a sessão atual.

## Cliente administrativo

Utiliza chave privilegiada somente no servidor e apenas em operações controladas.

A service role key nunca pode ser exposta ao navegador.

## Cliente do navegador

Utilizado para sessão, Realtime autorizado e operações protegidas por RLS.

---

# Row Level Security

Todas as tabelas expostas pela API devem possuir RLS habilitada.

Princípios:

- Cliente acessa apenas os próprios dados;
- Cliente acessa apenas os próprios Pedidos;
- catálogo público possui leitura limitada;
- operações administrativas exigem papel administrativo;
- políticas não confiam em IDs enviados pelo navegador sem comparação com a sessão.

---

# Transações

Operações indivisíveis devem usar transação.

Exemplos:

- criar Pedido;
- criar Itens;
- criar snapshots;
- registrar endereço;
- registrar histórico inicial;
- atualizar valores.

Criação parcial de Pedido não é permitida.

---

# Realtime

Utilizar Supabase Realtime para:

- novos Pedidos no painel;
- alterações de status;
- cancelamentos;
- atualização do acompanhamento.

Realtime é mecanismo de sinalização. Após um evento, a aplicação deve confirmar o estado atual persistido.

---

# Storage

Supabase Storage armazenará imagens dos Produtos e ativos da Loja.

Regras:

- validar tipo e tamanho;
- gerar nomes não previsíveis;
- restringir upload ao Administrador;
- o bucket `product-images` é **público** para leitura
  (`20260831130000_product_images_public_bucket`);
- não armazenar comprovantes Pix (confirmação é automática via webhook).

---

# Twilio Verify

O Twilio Verify é o canal de entrega e validação do OTP.

A integração deve ser isolada por adaptador HTTP. O Next.js chama a Verify API no servidor; as credenciais não saem do processo.

Responsabilidades:

- iniciar a verificação por SMS (`Channel=sms`) com o telefone em E.164;
- deixar a Twilio gerar e entregar o código;
- confirmar o código informado pelo cliente no Verification Check;
- tratar falhas como indisponibilidade de integração ou código inválido;
- não registrar o OTP em logs.

O domínio não deve conhecer detalhes da Twilio.

O canal SMS exige Geo Permissions da Twilio com o Brasil ativo. Não é necessário WhatsApp Sender nem WABA para o OTP.

---

# Mercado Pago (Pix)

Adaptador HTTP em `packages/shared/src/modules/payments/`. Credenciais só no
servidor (`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`).

Responsabilidades:

- criar a **cobrança Pix dinâmica** por pedido (Orders API), com
  `X-Idempotency-Key = order-<id>-<attempt>` e expiração ~30 min;
- receber a confirmação por **webhook** (`POST /api/v1/webhooks/mercadopago`),
  validando a assinatura e deduplicando via `payment_events`;
- consultar status na **reconciliação** (`GET /api/v1/cron/reconcile-pix`),
  agendada pelo **Supabase Cron** (`supabase/cron/`), protegida por
  `CRON_SECRET`;
- disparar **estorno** quando o admin cancela um Pix pago;
- na confirmação, buscar taxa/valor líquido reais para o financeiro.

O domínio não conhece detalhes da API do MP.

---

# Cloudflare Turnstile

Captcha no fluxo de OTP. `modules/security/turnstile.ts` valida o token no
servidor (`TURNSTILE_SECRET_KEY`); o widget usa
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Complementado por honeypot
(`rejectHoneypot`) e rate limit atômico por IP (`consume_rate_limit` RPC).

---

# Google Maps Platform

Utilizar para:

- busca de endereço (Places API New, autocomplete);
- geocodificação e reverse geocoding (Geocoding API);
- mapa em modo satélite (Maps JS API).

**Não** se usa cálculo de rota nem distância viária: a distância loja→cliente
é **linha reta** (Haversine), ver `10-funcional/08`. Leaflet/OSM ficaram só
como fallback de geocodificação.

O Pedido armazena: endereço confirmado, latitude, longitude, distância
calculada e taxa aplicada.

A resposta do mapa não substitui a checagem do raio de atendimento.

---

# Web Push

O navegador gera uma PushSubscription.

A assinatura é enviada ao backend e vinculada ao Cliente.

Regras:

- um Cliente pode ter várias assinaturas;
- assinaturas expiradas devem ser removidas;
- push é opcional;
- falha no push não desfaz alteração de status.

Há **duas frentes de push** com tabelas separadas: a do cliente
(`push_subscriptions`) e a do painel (`admin_push_subscriptions`). "Pedido
novo" é enviado pelo app do cliente mirando as assinaturas do admin;
"status mudou" é enviado pelo admin mirando as do cliente. Por isso o **par
VAPID tem que ser o mesmo** nos dois apps (par distinto = 401/403
silencioso). Ver `20-tecnico/31` §2.10.

---

# Sentry

Utilizar para:

- erros de frontend;
- erros de servidor;
- falhas inesperadas;
- rastreamento de operações críticas.

Dados sensíveis devem ser removidos antes do envio.

---

# Resiliência

Integrações externas devem possuir:

- timeout;
- tratamento de erro;
- resultado tipado;
- logs seguros;
- repetição apenas quando segura;
- idempotência quando aplicável.

Não repetir automaticamente criação de Pedido ou envio de OTP sem controle.
