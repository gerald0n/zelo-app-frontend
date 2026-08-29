# 20 - Arquitetura

# Objetivo

Este documento define a arquitetura de alto nível da aplicação e orienta a separação de responsabilidades.

---

# Estilo Arquitetural

A aplicação será um monólito modular full-stack em um único repositório.

Frontend e backend pertencem à mesma aplicação Next.js, porém regras de negócio, apresentação e infraestrutura devem permanecer separadas.

---

# Visão Geral

```text
Navegador / PWA
├── Cardápio
├── Carrinho
├── Checkout
├── Histórico
├── Acompanhamento
└── Painel administrativo
        │
        ▼
Next.js
├── App Router
├── Server Components
├── Client Components
├── Server Actions
├── Route Handlers
├── Casos de uso
├── Domínio
├── Repositórios
└── Adaptadores
        ├── Supabase Auth
        ├── PostgreSQL
        ├── Supabase Realtime
        ├── Supabase Storage
        ├── Meta WhatsApp Cloud API
        ├── Google Maps Platform
        ├── Web Push
        └── Sentry
```

---

# Princípios

- simplicidade;
- separação de responsabilidades;
- segurança por padrão;
- regras de negócio independentes da interface;
- validação no servidor;
- facilidade de teste;
- baixo acoplamento com serviços externos;
- evolução incremental.

---

# Camadas

## Apresentação

Responsável por páginas, componentes, formulários, feedback visual, acessibilidade e experiência responsiva.

Não deve implementar regras de negócio críticas.

## Aplicação

Responsável pelos casos de uso.

Exemplos:

- criar Pedido;
- confirmar Pedido;
- cancelar Pedido;
- calcular checkout;
- iniciar recompra;
- validar agendamento.

Cada caso de uso deve validar entrada, carregar dados, aplicar regras, persistir alterações e retornar resultado tipado.

## Domínio

Responsável por entidades, objetos de valor, invariantes, transições de estado, cálculos e políticas.

O domínio não deve importar Next.js, Supabase, React ou APIs externas.

## Infraestrutura

Responsável por Supabase, PostgreSQL, Meta Cloud API, Google Maps, Web Push e Sentry.

Toda integração externa deve possuir adaptador próprio.

---

# Fluxo de Operação

```text
Interface
→ Server Action ou Route Handler
→ validação Zod
→ caso de uso
→ domínio
→ repositório ou adaptador
→ banco ou serviço externo
→ resultado tipado
→ interface
```

---

# Server Components

Utilizar para renderização inicial e carregamento de dados no servidor.

Não utilizar para armazenar estado interativo.

# Client Components

Utilizar somente quando necessário para interação, formulários, carrinho, mapa, notificações e Realtime.

A diretiva `use client` deve permanecer próxima das folhas da árvore.

# Server Actions

Utilizar em mutações internas da aplicação.

Toda Server Action deve autenticar, autorizar, validar com Zod e executar um caso de uso.

# Route Handlers

Utilizar para webhooks, endpoints de service worker, PushSubscription, callbacks e integrações externas.

---

# Estado

## Estado remoto

TanStack Query para dados dinâmicos no navegador.

## Carrinho

Zustand para o Carrinho.

O estado local nunca substitui a validação final no servidor.

## Tempo real

Supabase Realtime sinaliza mudanças.

Após um evento, a aplicação deve atualizar ou invalidar o estado correspondente.

---

# Banco de Dados

PostgreSQL é a fonte de verdade.

Utilizar:

- constraints;
- transações;
- Row Level Security;
- validação de aplicação;
- funções SQL quando justificadas.

---

# Eventos

```text
Status alterado
├── persistir histórico
├── publicar atualização em tempo real
└── enviar Web Push
```

Falha no push não deve desfazer a alteração principal.

---

# PWA

A aplicação será instalável e terá:

- Web App Manifest;
- service worker;
- ícones;
- experiência mobile first;
- página offline limitada;
- Web Push.

Compras e mutações não funcionarão offline.

---

# Restrições

Não implementar:

- microsserviços;
- backend separado;
- filas externas sem necessidade;
- regras críticas apenas no cliente;
- acesso administrativo pelo fluxo do Cliente.
