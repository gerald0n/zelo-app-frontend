# ADR-0003 — Riscos de segurança no armazenamento de secrets por tenant

- Status: proposta (bloqueante para a Fase E do ADR-0001)
- Data: 2026-09-16
- Contexto: o desenho da Fase E ([ADR-0001](0001-plano-white-label-multitenant.md))
  prevê um wizard onde o próprio cliente digita API keys de terceiros (Twilio,
  Google Maps, Mercado Pago, VAPID, possivelmente Vercel/Supabase) direto no
  `apps/gestor`. Este documento detalha por que isso é uma classe de risco nova —
  diferente de tudo que o app já lida hoje — e o que precisa existir antes de
  liberar esse step do wizard.

## Situação hoje (linha de base, sem risco novo)

Hoje todas as credenciais (`MERCADOPAGO_ACCESS_TOKEN`, `TWILIO_AUTH_TOKEN`,
`GOOGLE_MAPS_API_KEY`, `VAPID_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc. — ver
`packages/shared/src/config/env.ts`) vivem como env var no painel da Vercel. Isso é
seguro por padrão: a Vercel já criptografa em repouso, o acesso é controlado por
quem tem permissão no projeto, e nenhuma dessas chaves passa pela aplicação em
texto puro fora do runtime do servidor. O plano de MVP (Fase 0) e o provisionamento
manual do checklist ([ADR-0002](0002-checklist-provisionamento-mvp.md)) **não
introduzem risco novo**: continuam usando exatamente esse mecanismo, um projeto
Vercel por cliente.

## O risco novo: secrets digitados num formulário e gravados no seu banco

O momento em que isso muda de categoria é quando o wizard da Fase E aceita a chave
digitada pelo cliente e a aplicação passa a **gravar, ler e usar** esse valor a
partir do seu próprio banco (Supabase da Zelo/gestor), para depois injetá-lo no
projeto do tenant. Isso cria uma superfície de ataque que não existe hoje:

- **Cryptographic failure (OWASP A02)**: se a chave for gravada em texto puro numa
  coluna comum, qualquer leitura da tabela (dump de backup, replica, um bug de
  SQL, um funcionário com acesso ao banco) expõe a credencial de todos os
  tenants de uma vez — não só a de um.
- **Broken access control (OWASP A01)**: quem, dentro da sua equipe, pode ler o
  valor de uma chave de um tenant específico? Sem controle explícito, qualquer
  pessoa com acesso ao `apps/gestor` (ou ao banco por trás dele) vê a credencial
  de terceiros de todos os clientes.
- **Security logging insuficiente (OWASP A09)**: sem trilha de auditoria, não há
  como responder "quem acessou/alterou a chave do cliente X e quando" depois de
  um incidente.
- **Blast radius por tipo de chave** (o que cada uma permite, se vazar):
  - `SUPABASE_SERVICE_ROLE_KEY` — ignora RLS por completo; vazamento = acesso
    total ao banco daquele tenant (pedidos, clientes, financeiro).
  - `MERCADOPAGO_ACCESS_TOKEN` — risco financeiro direto: criar cobranças,
    estornos, ver histórico de pagamento do tenant.
  - Token de API da Vercel (se o wizard vier a automatizar domínio/deploy) —
    potencialmente escopo de conta/time inteiro, não só do projeto do tenant;
    é a chave com maior blast radius se mal escopada, porque pode afetar o
    deploy de **outros** tenants, não só do dono da chave.
  - `TWILIO_AUTH_TOKEN` — abuso de billing (envio de SMS em massa) e phishing via
    SMS usando o número do cliente.
  - `GOOGLE_MAPS_API_KEY` — abuso de billing/quota, geralmente o de menor
    impacto direto, mas ainda custa dinheiro do cliente se vazar.
  - `VAPID_PRIVATE_KEY` — permite forjar push notifications em nome do tenant
    para os clientes finais dele (vetor de phishing/engenharia social).

## Decisão

Bloquear a implementação do step 4 do wizard (Fase E) até que existam, no mínimo:

1. **Criptografia em repouso por secret**, não por tabela — cada valor cifrado
   individualmente (envelope encryption com uma KMS, ou Supabase Vault), nunca
   coluna de texto puro. O banco nunca deve conter o valor legível, só o cifrado.
2. **Escopo mínimo por chave, sempre que o provedor permitir**: token de Vercel
   escopado ao projeto do tenant (nunca token de conta/time inteira), chave de
   Mercado Pago já é naturalmente por conta do cliente, Supabase service role já
   isolado por projeto (decisão da Fase 0/A de banco por tenant reduz esse risco
   por construção — outro motivo pra manter banco por tenant mesmo na Fase A/B).
3. **Controle de acesso explícito no `apps/gestor`**: só quem provisiona pode ler/
   escrever secrets de um tenant; leitura do valor pleno nunca aparece na UI
   depois de salvo — no máximo os últimos 4 caracteres, como qualquer painel de
   API key sério faz (Stripe, Vercel, etc.).
4. **Log de auditoria** de toda leitura/escrita/rotação de secret, com quem e
   quando — mesmo que rudimentar (uma tabela de audit log já resolve).
5. **Processo de rotação**: se uma chave for suspeita de vazamento, precisa
   existir um caminho conhecido para revogar e trocar sem downtime do tenant.
6. **Nunca logar o valor da secret** em nenhum lugar da aplicação (Sentry,
   console, logs de erro) — checar isso explicitamente nos pontos onde essas
   chaves são lidas hoje (`config/env.ts` e módulos que as consomem).

## Consequência

Enquanto os itens acima não existirem, o processo de integrações por tenant
continua manual, via env var no painel Vercel (como já é hoje, e como o
ADR-0002 descreve) — mesmo depois das Fases A-D estarem prontas. O wizard pode
ganhar os steps 1-3 (domínio, design, features) antes disso, porque nenhum deles
envolve secret de terceiro; só o step 4 fica bloqueado por este ADR.

## Fora de escopo

Gestão de segredos da própria infraestrutura interna (ex.: `OTP_HASH_SECRET`,
`CRON_SECRET` gerados pelo processo de provisionamento) não é afetada por este
ADR — continuam gerados por você, não digitados por cliente, e seguem o processo
já validado na auditoria de segurança anterior do projeto.
