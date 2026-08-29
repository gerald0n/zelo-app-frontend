# 101 - Plano Mestre de Desenvolvimento

# Como usar

Cada tarefa deve ser executada em ordem, salvo quando estiver explicitamente marcada como independente.

O agente deve concluir uma tarefa por vez, registrar arquivos alterados e aplicar a Definition of Done.

---

# Bloco A — Fundação

## A001 — Criar aplicação

Dependências: nenhuma.

Entregáveis:

- Next.js com App Router;
- TypeScript strict;
- scripts de desenvolvimento, lint, typecheck e build.

Aceite:

- aplicação inicia;
- build passa.

## A002 — Configurar estilo

Dependências: A001.

Entregáveis:

- Tailwind;
- shadcn/ui;
- tema inicial;
- tipografia;
- utilitário de classes.

## A003 — Configurar qualidade

Dependências: A001.

Entregáveis:

- ESLint;
- Prettier;
- import sorting;
- limite de 100 caracteres;
- aspas simples;
- scripts.

## A004 — Criar estrutura modular

Dependências: A001.

Entregáveis:

- `app`;
- `src/modules`;
- `src/components`;
- `src/lib`;
- `src/providers`;
- `src/config`;
- `supabase`;
- `docs`.

## A005 — Validar ambiente

Entregáveis:

- `.env.example`;
- schema Zod de ambiente;
- separação de variáveis públicas e privadas.

---

# Bloco B — Banco

## B001 — Inicializar Supabase

- configurar CLI;
- criar config local;
- documentar comandos.

## B002 — Criar tipos e extensões

- enums de Pedido;
- enums de pagamento;
- extensões;
- função padrão de `updated_at`.

## B003 — Criar Loja e horários

- `stores`;
- `store_business_hours`;
- `store_blackout_periods`.

## B004 — Criar identidades

- `admin_profiles`;
- `customers`;
- constraints.

## B005 — Criar endereços

- `customer_addresses`;
- índice de padrão único;
- arquivamento.

## B006 — Criar catálogo

- `categories`;
- `products`;
- pesos;
- disponibilidade;
- arquivamento.

## B007 — Criar imagens e Adicionais

- `product_images`;
- `add_ons`;
- `product_add_ons`;
- imagem principal única.

## B008 — Criar Carrinho

- `carts`;
- `cart_items`;
- `cart_item_add_ons`;
- expiração.

## B009 — Criar Pedidos

- sequência;
- `orders`;
- `order_addresses`;
- `order_items`;
- `order_item_add_ons`.

## B010 — Criar histórico e auditoria

- `order_status_history`;
- `audit_logs`;
- imutabilidade.

## B011 — Criar PushSubscriptions

- tabela;
- índices;
- revogação.

## B012 — Criar função `create_order`

- validação;
- snapshots;
- transação;
- idempotência.

## B013 — Criar função `transition_order_status`

- máquina de estados;
- cancelamento;
- histórico.

## B014 — Criar RLS

- público;
- Cliente;
- Administrador;
- Storage.

## B015 — Criar seed

Categorias e Produtos iniciais:

- Cookies;
- Pudins;
- Salgados;
- cookies cadastrados individualmente;
- mini pudim;
- pudim 500 g;
- pudim 1 kg;
- empadas;
- coxinhas;
- pesos informativos;
- Loja e horários de exemplo.

## B016 — Gerar tipos

- tipos Supabase;
- integração com o projeto.

---

# Bloco C — Infraestrutura

## C001 — Clientes Supabase

- navegador;
- servidor;
- admin;
- middleware oficial de sessão.

## C002 — Resultados e erros

- `Result`;
- códigos;
- mapeamento HTTP;
- mensagens em português.

## C003 — Sentry

- navegador;
- servidor;
- sanitização;
- ambientes.

## C004 — Identidade temporária

- interface `CustomerIdentityProvider`;
- implementação local/preview;
- bloqueio de produção;
- Cliente de desenvolvimento configurável.

## C005 — Adaptadores externos

- Meta;
- Maps;
- Push;
- contratos e erros.

---

# Bloco D — Catálogo

## D001 — Ler Loja e funcionamento

## D002 — Consultar Categorias públicas

## D003 — Consultar Produtos e imagens

## D004 — Exibir cardápio mobile first

## D005 — Criar busca

## D006 — Criar página de Produto

## D007 — Exibir Adicionais

## D008 — Tratar indisponibilidade

## D009 — Criar estados vazio, loading e erro

---

# Bloco E — Carrinho

## E001 — Criar store Zustand

## E002 — Versionar persistência

## E003 — Aplicar expiração de 7 dias

## E004 — Adicionar Item

## E005 — Editar Item

## E006 — Remover Item

## E007 — Calcular totais indicativos

## E008 — Criar página de Carrinho

## E009 — Revalidar com servidor

## E010 — Reconciliar Carrinho anônimo

---

# Bloco F — Entrega e Agendamento

## F001 — Configurar Google Maps

## F002 — Criar formulário de endereço

## F003 — Geocodificar e confirmar marcador

## F004 — Validar Pereiro urbano

## F005 — Calcular rota

## F006 — Aplicar taxa

- até 2.000 m: R$ 0;
- acima: R$ 5.

## F007 — Criar retirada

## F008 — Calcular Loja aberta

## F009 — Calcular primeira data

- até 17:00: dia seguinte;
- após 17:00: segundo dia seguinte.

## F010 — Listar horários válidos

---

# Bloco G — Checkout

## G001 — Criar fluxo em etapas

## G002 — Integrar identidade temporária

## G003 — Validar modalidade

## G004 — Validar endereço e taxa

## G005 — Implementar Pix

## G006 — Implementar dinheiro e troco

## G007 — Implementar cartão no recebimento

## G008 — Criar revisão final

## G009 — Criar preview do checkout

## G010 — Criar Pedido transacional

## G011 — Evitar submissão duplicada

## G012 — Limpar Carrinho após sucesso

---

# Bloco H — Pedidos

## H001 — Criar confirmação

## H002 — Criar acompanhamento

## H003 — Criar timeline

## H004 — Criar histórico

## H005 — Cancelamento pelo Cliente

## H006 — Recompra

## H007 — Tratar itens indisponíveis na recompra

## H008 — Proteger notas internas

---

# Bloco I — Administração

## I001 — Login por e-mail e senha

## I002 — Criar Administrador manual

## I003 — Proteger rotas

## I004 — Dashboard

## I005 — Lista e filtros de Pedidos

## I006 — Detalhe do Pedido

## I007 — Transições de status

## I008 — Cancelamento administrativo

## I009 — CRUD de Categorias

## I010 — CRUD de Produtos

## I011 — Upload e ordenação de imagens

## I012 — CRUD de Adicionais

## I013 — Disponibilidade

## I014 — Configuração da Loja

## I015 — Horários e períodos bloqueados

## I016 — Auditoria operacional

---

# Bloco J — Realtime

## J001 — Canal administrativo

## J002 — Canal do Pedido do Cliente

## J003 — Invalidar queries

## J004 — Reconectar e ressincronizar

## J005 — Validar autorização

---

# Bloco K — Push e PWA

## K001 — Gerar VAPID

## K002 — Criar service worker

## K003 — Registrar assinatura

## K004 — Enviar notificações

## K005 — Remover assinatura inválida

## K006 — Abrir acompanhamento no clique

## K007 — Solicitar permissão após Pedido

## K008 — Criar manifest

## K009 — Criar ícones

## K010 — Criar página offline

## K011 — Versionar caches

## K012 — Validar instalação

---

# Bloco L — Deploy

## L001 — Criar projeto Vercel

## L002 — Configurar Supabase de produção

## L003 — Configurar variáveis

## L004 — Restringir chaves Google

## L005 — Configurar Sentry

## L006 — Configurar domínio

## L007 — Aplicar migrations

## L008 — Carregar seed operacional

## L009 — Validar fluxos críticos

## L010 — Monitorar produção

---

# Bloco M — OTP do Cliente, Sessão e Logout

Executar por último.

## M001 — Configurar Twilio Verify

## M002 — Ativar canal SMS

## M003 — Liberar Brasil em Geo Permissions

## M004 — Configurar credenciais da Twilio

## M005 — Criar adaptador Twilio Verify (SMS)

## M008 — Solicitar OTP

## M009 — Verificar OTP

## M010 — Criar ou localizar Cliente

## M011 — Implementar sessão

## M012 — Implementar logout

## M013 — Reconciliar Carrinho anônimo

## M014 — Substituir identidade temporária

## M015 — Bloquear bypass fora do local

## M016 — Configurar rate limit

## M017 — Validar expiração e reenvio

## M018 — Validar ponta a ponta com SMS real

---

# Bloco N — Encerramento

## N001 — Revisar documentação

## N002 — Remover configurações obsoletas

## N003 — Revisar RLS e segredos

## N004 — Executar Prettier, ESLint, typecheck e build

## N005 — Verificar manualmente fluxos críticos

## N006 — Registrar pendências e futuras evoluções
