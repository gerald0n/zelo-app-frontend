# 24 - Banco de Dados

# Objetivo

Este documento define a modelagem principal do banco de dados PostgreSQL da aplicação.

Seu objetivo é orientar migrations, tipos gerados, políticas de acesso, constraints, índices e implementação dos casos de uso.

---

# Convenções

- tabelas no plural;
- colunas em `snake_case`;
- chaves primárias em UUID;
- `created_at` e `updated_at` em entidades mutáveis;
- timestamps em `timestamptz`;
- datas persistidas em UTC;
- apresentação no fuso `America/Fortaleza`;
- valores monetários em centavos;
- exclusão lógica por `archived_at`;
- enum PostgreSQL somente para estados estáveis.

---

# Extensões Recomendadas

- `pgcrypto` para UUID;
- `citext` quando necessário para comparação case-insensitive;
- `postgis` para evolução da área geográfica, caso adotado futuramente.

---

# Enums

## `order_status`

```text
received
confirmed
in_production
ready_for_delivery
ready_for_pickup
out_for_delivery
delivered
cancelled
```

## `delivery_method`

```text
delivery
pickup
```

## `payment_method`

```text
pix
cash
card
```

## `payment_status`

```text
pending
confirmed
failed
cancelled
```

## `order_timing`

```text
immediate
scheduled
```

## `status_change_actor_type`

```text
customer
admin
system
```

---

# Tabela `stores`

Representa a configuração única da Loja.

Deve existir exatamente um registro ativo.

Campos principais:

- `id uuid primary key`;
- `name text not null`;
- `phone_e164 text not null`;
- `whatsapp_e164 text not null`;
- `pix_copy_paste text`;
- `address_line text not null`;
- `city text not null`;
- `state text not null`;
- `postal_code text`;
- `latitude numeric(9,6) not null`;
- `longitude numeric(9,6) not null`;
- `free_delivery_radius_meters integer not null default 2000`;
- `fixed_delivery_fee_cents integer not null default 500`;
- `timezone text not null default 'America/Fortaleza'`;
- `is_open_override boolean`;
- `created_at timestamptz not null`;
- `updated_at timestamptz not null`.

Constraints:

- taxa não negativa;
- raio não negativo;
- timezone não vazio.

---

# Tabela `store_business_hours`

Armazena horários de funcionamento.

Campos:

- `id uuid primary key`;
- `store_id uuid not null references stores(id)`;
- `weekday smallint not null`;
- `opens_at time`;
- `closes_at time`;
- `is_closed boolean not null default false`;
- `delivery_enabled boolean not null default true`;
- `pickup_enabled boolean not null default true`;
- `created_at timestamptz not null`;
- `updated_at timestamptz not null`.

Constraints:

- `weekday` entre 0 e 6;
- abertura anterior ao fechamento quando aberto;
- uma configuração por dia e Loja.

---

# Tabela `store_blackout_periods`

Representa períodos excepcionais de indisponibilidade.

Campos:

- `id uuid primary key`;
- `store_id uuid not null references stores(id)`;
- `starts_at timestamptz not null`;
- `ends_at timestamptz not null`;
- `reason text`;
- `created_at timestamptz not null`.

Constraint:

- `ends_at > starts_at`.

---

# Tabela `admin_profiles`

Representa o único Administrador autorizado.

Campos:

- `id uuid primary key references auth.users(id)`;
- `display_name text not null`;
- `is_active boolean not null default true`;
- `created_at timestamptz not null`;
- `updated_at timestamptz not null`.

Não deve existir fluxo público de criação.

---

# Tabela `customers`

Representa o Cliente autenticado.

Campos:

- `id uuid primary key references auth.users(id)`;
- `name text not null`;
- `phone_e164 text not null unique`;
- `email citext`;
- `internal_note text`;
- `created_at timestamptz not null`;
- `updated_at timestamptz not null`.

Regras:

- telefone normalizado;
- telefone único;
- nome obrigatório para criar Pedido;
- nome pode ficar vazio até o Cliente informar após o OTP;
- e-mail opcional.

---

# Tabela `customer_addresses`

Endereços reutilizáveis do Cliente.

Campos:

- `id uuid primary key`;
- `customer_id uuid not null references customers(id)`;
- `label text`;
- `street text not null`;
- `number text not null`;
- `neighborhood text not null`;
- `city text not null`;
- `state text not null`;
- `postal_code text`;
- `complement text`;
- `reference_point text`;
- `latitude numeric(9,6) not null`;
- `longitude numeric(9,6) not null`;
- `is_default boolean not null default false`;
- `last_used_at timestamptz`;
- `archived_at timestamptz`;
- `created_at timestamptz not null`;
- `updated_at timestamptz not null`.

Regras:

- apenas um endereço padrão ativo por Cliente;
- endereços arquivados não aparecem no checkout.

---

# Tabela `categories`

Campos:

- `id uuid primary key`;
- `name text not null`;
- `description text`;
- `sort_order integer not null default 0`;
- `is_active boolean not null default true`;
- `archived_at timestamptz`;
- `created_at timestamptz not null`;
- `updated_at timestamptz not null`.

Uma Categoria vazia ou sem Produtos disponíveis não aparece no cardápio público.

---

# Tabela `products`

Campos:

- `id uuid primary key`;
- `category_id uuid not null references categories(id)`;
- `name text not null`;
- `slug text not null unique`;
- `description text`;
- `price_cents integer not null`;
- `weight_min_grams integer`;
- `weight_max_grams integer`;
- `sort_order integer not null default 0`;
- `is_active boolean not null default true`;
- `is_available boolean not null default true`;
- `archived_at timestamptz`;
- `created_at timestamptz not null`;
- `updated_at timestamptz not null`.

Constraints:

- preço não negativo;
- pesos positivos quando informados;
- peso máximo maior ou igual ao mínimo.

Peso é informativo e não afeta preço ou frete.

---

# Tabela `product_images`

Campos:

- `id uuid primary key`;
- `product_id uuid not null references products(id)`;
- `storage_path text not null`;
- `alt_text text not null`;
- `sort_order integer not null default 0`;
- `is_primary boolean not null default false`;
- `created_at timestamptz not null`.

Regras:

- Produto publicado deve possuir uma imagem principal;
- apenas uma imagem principal por Produto;
- imagens adicionais são opcionais.

---

# Tabela `add_ons`

Campos:

- `id uuid primary key`;
- `name text not null`;
- `description text`;
- `price_cents integer not null`;
- `is_active boolean not null default true`;
- `is_available boolean not null default true`;
- `archived_at timestamptz`;
- `created_at timestamptz not null`;
- `updated_at timestamptz not null`.

---

# Tabela `product_add_ons`

Relaciona Produtos e Adicionais.

Campos:

- `product_id uuid not null references products(id)`;
- `add_on_id uuid not null references add_ons(id)`;
- `sort_order integer not null default 0`;
- `created_at timestamptz not null`.

Chave primária composta:

- `(product_id, add_on_id)`.

---

# Tabela `carts`

Representa o Carrinho persistido.

Campos:

- `id uuid primary key`;
- `customer_id uuid references customers(id)`;
- `anonymous_key uuid`;
- `source_order_id uuid references orders(id)`;
- `expires_at timestamptz not null`;
- `last_activity_at timestamptz not null`;
- `created_at timestamptz not null`;
- `updated_at timestamptz not null`.

Regras:

- expiração após 7 dias sem alteração;
- Carrinho expirado não pode ser convertido em Pedido;
- um Carrinho persistido por Cliente autenticado;
- no login, o Carrinho anônimo do aparelho é unido ao Carrinho do Cliente;
- restauração exige revalidação.

---

# Tabela `cart_items`

Campos:

- `id uuid primary key`;
- `cart_id uuid not null references carts(id)`;
- `product_id uuid not null references products(id)`;
- `quantity integer not null`;
- `customer_note text`;
- `created_at timestamptz not null`;
- `updated_at timestamptz not null`.

Constraint:

- `quantity > 0`.

---

# Tabela `cart_item_add_ons`

Campos:

- `cart_item_id uuid not null references cart_items(id)`;
- `add_on_id uuid not null references add_ons(id)`;
- `quantity integer not null default 1`;
- `created_at timestamptz not null`.

---

# Sequência de Pedidos

Criar sequência global crescente para `order_number`.

A sequência:

- não reinicia diariamente;
- não reinicia anualmente;
- serve para comunicação com Cliente e operação;
- não substitui o UUID.

---

# Tabela `orders`

Campos principais:

- `id uuid primary key`;
- `order_number bigint not null unique`;
- `customer_id uuid not null references customers(id)`;
- `status order_status not null default 'received'`;
- `timing order_timing not null`;
- `scheduled_for timestamptz`;
- `delivery_method delivery_method not null`;
- `payment_method payment_method not null`;
- `payment_status payment_status not null default 'pending'`;
- `subtotal_cents integer not null`;
- `add_ons_total_cents integer not null`;
- `delivery_fee_cents integer not null`;
- `total_cents integer not null`;
- `needs_change boolean`;
- `change_for_amount_cents integer`;
- `customer_note text`;
- `internal_note text`;
- `source_order_id uuid references orders(id)`;
- `cancelled_at timestamptz`;
- `cancelled_by uuid`;
- `cancellation_reason text`;
- `created_at timestamptz not null`;
- `updated_at timestamptz not null`.

Constraints:

- valores não negativos;
- total consistente;
- `scheduled_for` obrigatório quando timing for `scheduled`;
- `change_for_amount_cents >= total_cents` quando necessário;
- motivo obrigatório quando status for `cancelled`.

---

# Tabela `order_addresses`

Snapshot imutável do endereço.

Campos:

- `id uuid primary key`;
- `order_id uuid not null unique references orders(id)`;
- `street text not null`;
- `number text not null`;
- `neighborhood text not null`;
- `city text not null`;
- `state text not null`;
- `postal_code text`;
- `complement text`;
- `reference_point text`;
- `latitude numeric(9,6) not null`;
- `longitude numeric(9,6) not null`;
- `route_distance_meters integer not null`;
- `delivery_fee_cents integer not null`;
- `created_at timestamptz not null`.

Só existe para delivery.

Não pode ser atualizado após criação.

---

# Tabela `order_items`

Snapshot do Produto adquirido.

Campos:

- `id uuid primary key`;
- `order_id uuid not null references orders(id)`;
- `product_id uuid references products(id)`;
- `product_name text not null`;
- `product_description text`;
- `unit_price_cents integer not null`;
- `quantity integer not null`;
- `weight_min_grams integer`;
- `weight_max_grams integer`;
- `customer_note text`;
- `line_total_cents integer not null`;
- `created_at timestamptz not null`.

O relacionamento com Produto pode permanecer nulo no futuro sem afetar o histórico.

---

# Tabela `order_item_add_ons`

Snapshot dos Adicionais comprados.

Campos:

- `id uuid primary key`;
- `order_item_id uuid not null references order_items(id)`;
- `add_on_id uuid references add_ons(id)`;
- `add_on_name text not null`;
- `unit_price_cents integer not null`;
- `quantity integer not null`;
- `line_total_cents integer not null`;
- `created_at timestamptz not null`.

---

# Tabela `order_status_history`

Campos:

- `id uuid primary key`;
- `order_id uuid not null references orders(id)`;
- `previous_status order_status`;
- `new_status order_status not null`;
- `actor_type status_change_actor_type not null`;
- `actor_id uuid`;
- `reason text`;
- `created_at timestamptz not null`.

Regras:

- nunca atualizar ou excluir;
- motivo obrigatório em cancelamento;
- registrar estado inicial como transição para `received`.

---

# Tabela `push_subscriptions`

Campos:

- `id uuid primary key`;
- `customer_id uuid not null references customers(id)`;
- `endpoint text not null unique`;
- `p256dh text not null`;
- `auth text not null`;
- `user_agent text`;
- `last_seen_at timestamptz`;
- `revoked_at timestamptz`;
- `created_at timestamptz not null`;
- `updated_at timestamptz not null`.

---

# Tabela `audit_logs`

Registra ações administrativas e operacionais relevantes.

Campos:

- `id uuid primary key`;
- `actor_type status_change_actor_type not null`;
- `actor_id uuid`;
- `action text not null`;
- `entity_type text not null`;
- `entity_id uuid`;
- `metadata jsonb`;
- `created_at timestamptz not null`.

Nunca armazenar OTP, senha, token ou dados sensíveis completos.

---

# Índices

Índices recomendados:

- `customers(phone_e164)`;
- `customer_addresses(customer_id, archived_at)`;
- `products(category_id, is_active, is_available, archived_at)`;
- `product_images(product_id, sort_order)`;
- `product_add_ons(product_id)`;
- `carts(customer_id, expires_at)`;
- `carts(anonymous_key, expires_at)`;
- `cart_items(cart_id)`;
- `orders(customer_id, created_at desc)`;
- `orders(status, scheduled_for)`;
- `orders(order_number)`;
- `orders(created_at desc)`;
- `order_items(order_id)`;
- `order_status_history(order_id, created_at)`;
- `push_subscriptions(customer_id, revoked_at)`.

---

# Funções Transacionais

Criar funções SQL para operações críticas.

## `create_order`

Responsabilidades:

- validar Carrinho;
- validar disponibilidade;
- validar preços;
- validar horário;
- validar agendamento;
- calcular totais;
- gerar `order_number`;
- criar Pedido;
- criar endereço snapshot;
- criar Itens;
- criar Adicionais snapshot;
- criar histórico inicial;
- invalidar Carrinho.

Tudo em uma única transação.

## `transition_order_status`

Responsabilidades:

- carregar status atual;
- validar transição;
- validar autor;
- exigir motivo quando necessário;
- atualizar Pedido;
- inserir histórico.

---

# RLS

Diretrizes principais:

## Público

Pode ler:

- Loja publicada;
- horários;
- Categorias ativas;
- Produtos ativos;
- imagens;
- Adicionais válidos.

## Cliente

Pode:

- ler e atualizar próprio perfil;
- gerenciar próprios endereços;
- gerenciar próprio Carrinho;
- ler próprios Pedidos;
- ler próprio histórico;
- criar Pedido por função controlada;
- cancelar somente dentro das regras.

Não pode:

- alterar preços;
- alterar status livremente;
- acessar dados de outro Cliente;
- consultar notas internas.

## Administrador

Pode:

- gerenciar catálogo;
- gerenciar configurações;
- consultar todos os Pedidos;
- alterar status;
- consultar notas internas;
- gerenciar disponibilidade.

---

# Retenção

- Pedidos e histórico são permanentes;
- Carrinhos expiram após 7 dias sem atividade;
- PushSubscriptions revogadas podem ser removidas após período operacional definido;
- logs devem seguir política de retenção e privacidade;
- Produtos, Categorias e Adicionais com histórico devem ser arquivados, não excluídos.
