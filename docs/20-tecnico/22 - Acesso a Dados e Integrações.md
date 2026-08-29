# 22 - Acesso a Dados e Integrações

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

O acesso ao banco deve ser encapsulado em módulos de repositório quando houver lógica ou reutilização relevante.

Exemplos:

- `customer-repository`;
- `order-repository`;
- `catalog-repository`;
- `store-repository`.

Componentes React não devem conter consultas complexas diretamente.

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
- permitir leitura pública apenas quando necessário;
- evitar armazenar comprovantes Pix inicialmente.

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

# Google Maps Platform

Utilizar para:

- busca de endereço;
- geocodificação;
- mapa;
- cálculo de rota;
- distância viária.

O Pedido deve armazenar:

- endereço confirmado;
- latitude;
- longitude;
- distância calculada;
- taxa aplicada.

A resposta do mapa não substitui a validação da área atendida.

---

# Web Push

O navegador gera uma PushSubscription.

A assinatura é enviada ao backend e vinculada ao Cliente.

Regras:

- um Cliente pode ter várias assinaturas;
- assinaturas expiradas devem ser removidas;
- push é opcional;
- falha no push não desfaz alteração de status.

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
