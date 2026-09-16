# Checklist de provisionamento — MVP white label

Complementa a Fase 0 do [ADR-0001](0001-plano-white-label-multitenant.md). Use este
checklist para colocar um cliente piloto novo em produção sob o modelo "fake
multi-tenant" (deploy + banco próprios, branding fixado em build-time).

Pré-requisito: os passos de "preparação do código" (0.x) só precisam ser feitos
**uma vez**, no repositório. Do primeiro cliente em diante, o provisionamento por
cliente (1.x em diante) é repetível.

## 0. Preparação do código (uma vez, antes do primeiro piloto)

- [ ] Extrair cores/tema de [`packages/shared/src/styles/globals.css`](../../packages/shared/src/styles/globals.css)
  para variáveis substituíveis por deploy (ex.: gerar o bloco `:root` a partir de
  env vars no build, ou um arquivo `brand.config.ts` importado por ambos os apps).
- [ ] Trocar o path fixo do logo em `ZeloSeal.tsx` e `opengraph-image.tsx` por
  referência à config do passo anterior (mesmo mecanismo de fallback "Z" genérico
  já existente, sem hardcode do arquivo `zelo-selo.png`).
- [ ] Trocar as ~24 strings "Zelo" em UI (`layout.tsx`, `AdminSidebar.tsx`,
  `Testimonials.tsx`, `not-found.tsx`, etc. — ver levantamento no ADR-0001) por
  leitura do nome da loja a partir da mesma config.
- [ ] Trocar as ~7 constantes de domínio hardcoded (`SITE_URL` em `layout.tsx`,
  `whatsapp-notify.ts`, `config/admin.ts`, `order-pix-charge.ts`, `osm.ts`) por
  env var (`NEXT_PUBLIC_SITE_URL` ou equivalente).
- [ ] **Gap identificado**: hoje, sem `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/
  `TWILIO_VERIFY_SERVICE_SID`, o fluxo de OTP (`packages/shared/src/modules/auth/otp.ts`,
  `hasTwilioVerifyConfig()`) já cai num modo "debug" que gera um código localmente
  — mas ainda **exige digitar um código**. O comportamento que o dono do produto
  quer para o flag `otp_sms_verify` desligado é **pular a confirmação por
  completo** (só telefone, sem código nenhum). Isso precisa de um branch novo no
  fluxo de login do client, não só omitir as env vars — ajustar antes do piloto
  que for usar essa opção.
- [ ] **Gap identificado**: confirmar o comportamento atual quando
  `GOOGLE_MAPS_API_KEY`/`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` estão ausentes (o campo
  de endereço já degrada para input livre, ou lança erro?). Ajustar se necessário
  para que o flag `address_geocoding` desligado vire "input de endereço sem
  autocomplete/confirmação", como especificado no ADR.
- [ ] Confirmar que o carrossel da home (`MenuHeroCarousel`, renderizado em
  `HomeCatalog.tsx`) já pode ser ocultado via config existente do admin
  (`_sections` de carrossel) — se sim, `carousel_home` não precisa de código novo,
  só de uma env var/default por cliente que desative essa config na primeira carga.

## 1. Provisionamento por cliente piloto

### 1.1 Supabase
- [ ] Criar novo projeto Supabase (região `gru1`, mesma da Zelo — decisão tomada
  no plano de performance de produção, para evitar a lentidão já resolvida lá).
- [ ] Aplicar as migrations existentes: `supabase link` ao projeto novo e
  `supabase db push` (ou `pnpm db:reset` localmente contra o projeto novo antes
  de linkar em produção, para validar primeiro).
- [ ] Gerar tipos: `pnpm gen:types` apontando para o projeto novo, se o schema
  divergir do padrão (idealmente não deveria, no MVP).
- [ ] Rodar seed mínimo (`supabase/seed.sql` como base) com os dados reais do
  cliente: `stores` (nome, contato, endereço, horários, delivery), catálogo
  inicial, categorias.
- [ ] Configurar `OTP_HASH_SECRET` novo e único para este projeto (nunca reusar
  o da Zelo — é por-ambiente, ver auditoria de segurança na memória).
- [ ] Rodar `pnpm gen:icons` (mencionado na memória de selo/ícones) se o cliente
  tiver logo próprio, para gerar os ícones PWA a partir da marca dele.

### 1.2 Credenciais externas
- [ ] Decidir por cliente: conta Mercado Pago própria ou copia-e-cola manual
  (`auto_pix` desligado) — se própria, configurar `MERCADOPAGO_ACCESS_TOKEN` e
  `MERCADOPAGO_WEBHOOK_SECRET` do cliente, e apontar o webhook do MP dele para o
  domínio novo.
- [ ] Se `otp_sms_verify` ligado: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `TWILIO_VERIFY_SERVICE_SID` (conta Twilio do cliente ou sub-conta).
- [ ] Se `address_geocoding` ligado: `GOOGLE_MAPS_API_KEY` /
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (key própria ou compartilhada com quota
  monitorada — decisão de produto pendente, ver Riscos no ADR-0001).
- [ ] Gerar par de chaves VAPID novo para push notifications
  (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`) — nunca
  reusar o da Zelo, cada domínio precisa do seu.
- [ ] `CRON_SECRET` e `CATALOG_REVALIDATE_SECRET` novos e únicos por deploy.

### 1.3 Vercel
- [ ] Criar dois projetos Vercel novos (client e admin), a partir do mesmo repo/
  branch de deploy.
- [ ] Configurar todas as env vars dos passos 1.1/1.2, mais as de branding do
  passo 0 (`NEXT_PUBLIC_SITE_URL`, cores/tema, nome da loja).
- [ ] Apontar domínio do cliente (subdomínio próprio, ex.:
  `cardapio.clientepiloto.com.br`, ou domínio que o cliente já possua).
- [ ] Confirmar região do deploy (`gru1`) igual à do Supabase, para não reintroduzir
  a lentidão já resolvida no plano de performance.

### 1.4 Feature flags do piloto (env var booleana, MVP)
Marcar explicitamente o que este cliente vai usar, antes de deployar:
- [ ] `carousel_home`
- [ ] `otp_sms_verify`
- [ ] `address_geocoding`
- [ ] `auto_pix`
- [ ] `push_notifications`
- [ ] Confirmar que os flags específicos do Zelo (`pizza_builder`,
  `product_recommendation`, `scheduling`, `multi_city`, `thermal_printer`,
  `stock_control`, `reviews`) estão **desligados por padrão** para o piloto,
  a menos que o cliente peça explicitamente.

## 2. Teste de fumaça antes de liberar ao cliente

- [ ] Home carrega com a marca do cliente (logo, cores, nome) — nenhuma
  referência a "Zelo" visível.
- [ ] Login do client funciona conforme o flag `otp_sms_verify` escolhido.
- [ ] Endereço no checkout funciona conforme o flag `address_geocoding` escolhido.
- [ ] Fluxo completo de pedido: catálogo → carrinho → checkout → pagamento
  (pix automático ou copia-e-cola, conforme `auto_pix`) → confirmação.
- [ ] Painel admin: login, visão do pedido recebido, marcação de status.
- [ ] Push notification (se `push_notifications` ligado): notificação de teste
  chega no painel.
- [ ] Nenhuma chamada de rede aponta para o Supabase/domínio da Zelo (checar
  Network tab) — evidência de que o isolamento por projeto está correto.

## 3. Pós-provisionamento

- [ ] Registrar o cliente numa planilha/nota simples (nome, domínio, projeto
  Supabase, projeto Vercel, flags ativos, credenciais usadas) — substitui o
  `apps/gestor` enquanto o número de pilotos for pequeno.
- [ ] Definir com o cliente o canal de suporte para pedidos de mudança de
  marca/flag (que hoje exigem redeploy manual, não self-service).
