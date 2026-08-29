# 23 - Autenticação e Segurança

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

O OTP é:

- gerado e enviado por SMS via Twilio Verify;
- validado pela Twilio e pela aplicação;
- utilizado para criar uma sessão Supabase Auth.

A aplicação não deve criar sistema próprio de tokens ou sessões além do Supabase Auth.

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

O sistema deve possuir:

- limite de solicitações;
- intervalo mínimo para reenvio;
- limite de tentativas;
- expiração curta;
- proteção contra automação;
- respostas que não revelem detalhes desnecessários.

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

A conta será criada manualmente.

Não haverá página pública de cadastro administrativo.

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

- Supabase service role key;
- Account SID, Auth Token e Verify Service SID da Twilio;
- segredo de webhook;
- chave privada VAPID;
- chaves privadas do Google Maps;
- tokens privados do Sentry.

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
