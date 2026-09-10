# 23 - Autenticação e Segurança

> Reconciliado com o código em **2026-09-09** (`modules/auth/otp.ts`,
> `modules/security/`). Inclui o fallback de OTP gerado pelo app, o Cloudflare
> Turnstile, o honeypot e o rate limit atômico por IP. Ver `20-tecnico/31`
> §2.2.

# Objetivo

Este documento define os fluxos de autenticação, autorização e os controles mínimos de segurança.

---

# Identidades

Existem dois tipos de identidade:

- Cliente;
- Administrador.

Os fluxos são separados, embora utilizem Supabase Auth.

---

# Cliente

## Método

O Cliente utiliza autenticação passwordless por telefone.

O OTP tem **dois modos** (`modules/auth/otp.ts`):

- **Com Twilio Verify configurado** (`TWILIO_VERIFY_*`): a Twilio gera,
  entrega e valida o código; `customer_otp_challenges.code_hash` guarda um
  marcador do `serviceSid`, não o código.
- **Sem Twilio** (local/preview, ou se cair): o app gera um código de 6
  dígitos, guarda o **HMAC-SHA256** (`hashOtp`, segredo `OTP_HASH_SECRET`,
  mín. 16 chars) em `customer_otp_challenges.code_hash` e entrega por
  SMS/debug.

Em ambos os modos, o código válido cria uma sessão **Supabase Auth**. A
aplicação não implementa tokens ou sessões próprias.

A validação de sessão do cliente usa `supabase.auth.getClaims()` (verifica o
JWT localmente com as signing keys assimétricas), não `getUser()`.

---

# Fluxo do OTP por SMS

```text
Cliente informa telefone
→ aplicação aplica rate limit e grava o desafio
→ adaptador chama Twilio Verify (SMS)
→ Twilio gera e entrega o código
→ Cliente informa o código
→ aplicação confirma o código no Twilio Verify
→ sessão Supabase Auth é criada
→ perfil do Cliente é localizado ou criado
```

Em local/preview, sem Twilio Verify configurado, o código pode aparecer na tela de verificação (modo debug). Em production o Twilio Verify é obrigatório.

---

# Mensagem de OTP

O envio usa o template de OTP do Twilio Verify.

A mensagem deve:

- conter o código de uso único;
- informar a validade;
- não incluir conteúdo promocional;
- não ser registrada em logs.

---

# Telefone

O telefone deve ser normalizado em formato internacional consistente.

A aplicação deve:

- remover caracteres de apresentação;
- validar código do país;
- impedir formatos inválidos;
- evitar duplicidade por formatação.

---

# Proteção do OTP

Controles implementados:

- **Rate limit atômico por IP** — RPC `public.consume_rate_limit` (tabela
  `http_rate_limits`), `modules/security/rate-limit.ts`;
- **Cloudflare Turnstile** no envio — `modules/security/turnstile.ts`
  (`TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY`);
- **honeypot** — campo isca no formulário (`rejectHoneypot`);
- TTL do código **10 min**, cooldown de reenvio **45 s**, **5 envios/hora**,
  **5 tentativas** de verificação;
- respostas que não revelam se o telefone existe.

Nunca registrar:

- OTP;
- token de sessão;
- senha;
- cabeçalhos de autorização.

---

# Administrador

## Método

- e-mail;
- senha;
- Supabase Auth;
- cadastro público desabilitado.

A conta é criada manualmente. Não há página pública de cadastro
administrativo.

`admin_profiles.must_set_password` força a troca de senha no primeiro acesso
(`/configuracoes` → senha). O login tem timeout + fallback para não travar
no spinner (`fix/admin-login-timeout`).

---

# Papel Administrativo

O papel deve ser verificável no servidor.

Pode ser representado por:

- claim confiável no JWT;
- tabela administrativa protegida;
- combinação de ambas.

A interface nunca deve determinar autorização apenas escondendo elementos.

Toda operação administrativa deve verificar autorização no servidor e no banco.

---

# Sessões

- utilizar cookies seguros;
- utilizar HttpOnly quando aplicável;
- renovar conforme a integração oficial;
- encerrar sessão ao sair;
- proteger rotas administrativas;
- não armazenar tokens manualmente em localStorage.

---

# Row Level Security

RLS é obrigatória.

Exemplos:

- Cliente lê o próprio perfil;
- Cliente lê os próprios endereços;
- Cliente lê os próprios Pedidos;
- Cliente não altera status;
- Administrador gerencia catálogo e Pedidos;
- catálogo público possui leitura limitada.

---

# Segredos

Devem existir somente no servidor:

- Supabase service role key (`SUPABASE_SERVICE_ROLE_KEY`);
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `TWILIO_VERIFY_SERVICE_SID`;
- Mercado Pago: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`;
- Cloudflare Turnstile: `TURNSTILE_SECRET_KEY`;
- `OTP_HASH_SECRET` (mín. 16 chars — HMAC do código no modo fallback);
- `CRON_SECRET` (cron de reconciliação Pix);
- `CATALOG_REVALIDATE_SECRET` (invalidação de cache admin → client);
- chave privada VAPID (`VAPID_PRIVATE_KEY`) — **mesmo par nos dois apps**;
- `GOOGLE_MAPS_API_KEY` (server) — a `NEXT_PUBLIC_` é a de browser, restrita
  por referrer;
- DSN/tokens privados do Sentry.

`packages/shared/src/config/env.ts` (`assertProductionEnv`) valida as
obrigatórias no boot de produção.

---

# Webhooks

Todo webhook deve:

- validar assinatura quando disponível;
- validar método e conteúdo;
- ser idempotente;
- rejeitar payload inválido;
- não confiar em campos sem validação.

---

# Validação

Toda entrada externa deve ser validada no servidor com Zod ou validação equivalente.

Inclui:

- formulários;
- parâmetros;
- query strings;
- cookies;
- webhooks;
- respostas externas relevantes.

---

# Autorização

| Operação                    | Cliente |  Administrador |
| --------------------------- | ------: | -------------: |
| Ver catálogo                |     Sim |            Sim |
| Criar Pedido                |     Sim | Não necessário |
| Ver Pedido próprio          |     Sim |            Sim |
| Ver Pedido de outro Cliente |     Não |            Sim |
| Alterar status              |     Não |            Sim |
| Cancelar dentro da regra    |     Sim |            Sim |
| Editar Produto              |     Não |            Sim |

---

# Proteção de Dados

Dados pessoais:

- devem ser coletados apenas quando necessários;
- não devem aparecer em logs;
- não devem ser enviados ao Sentry sem filtragem;
- não devem ser incluídos integralmente em push;
- não devem aparecer em URLs públicas.

---

# Segurança do Navegador

Adotar, conforme compatibilidade:

- HTTPS obrigatório;
- Content Security Policy;
- proteção contra clickjacking;
- política de referrer;
- cookies `Secure`;
- cookies `HttpOnly`;
- `SameSite`;
- restrição de origens.

A CSP deve considerar Supabase, Google Maps, Sentry e recursos da PWA.

---

# Web Push

A permissão deve ser solicitada após a criação do Pedido.

As assinaturas devem ser vinculadas ao Cliente autenticado.

A notificação não deve expor endereço, telefone ou dados de pagamento.

---

# Decisões Proibidas

- implementar JWT próprio;
- validar OTP apenas no frontend;
- enviar OTP diretamente do navegador para a Twilio;
- expor o Auth Token da Twilio;
- desabilitar RLS por conveniência;
- usar service role no navegador;
- confiar em papel administrativo enviado pelo cliente;
- armazenar senha administrativa fora do Supabase Auth.
