# Validação pós-deploy — 2026-09-10

Roteiro de teste manual para o deploy que levou `develop` → `main`
(`2752de3` … `69da7b9`). Marque cada item; anote falhas com print + passo.

## O que entrou neste deploy

| Mudança                                                 | Risco    | Por quê                                                                                                                                                          |
| ------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Agendamento derivado por categoria** (PR #98)         | 🔴 alto  | migration `20260909140000` **dropou `stores.schedule_slot_times`** e a função `is_hhmm_list`; `create_order` e a montagem de opções do checkout foram reescritas |
| **Fila de impressão da cozinha**                        | 🟠 médio | novo fluxo WebUSB + `orders.kitchen_printed_at` (migration `20260909150000`)                                                                                     |
| Fixes de horário com loja pausada (#95, `c88adbc`)      | 🟢 baixo | header do cliente                                                                                                                                                |
| Avaliação de produto — Fase 2 (PR #90)                  | 🟠 médio | `product_reviews`, já estava em prod desde 09-09 mas vale revalidar                                                                                              |
| Reconciliação da doc (PR #99)                           | —        | só markdown                                                                                                                                                      |
| Bumps Dependabot #44–48 (Sentry, lucide-react, patches) | 🟢 baixo | deps                                                                                                                                                             |

**Ambiente:** `https://cardapio.zeloconfeitaria.com.br` (cliente) e
`https://admin.zeloconfeitaria.com.br` (painel).

> ⚠️ Antes de começar: confirme no dashboard da Vercel que **os dois projetos
> (`zelo-app`, `zelo-admin`) deployaram o commit `69da7b9`** — hoje bateu no
> rate limit de builds. Se o deploy de produção ficou preso, nada abaixo vale.

---

## P0 — Sanidade do deploy (5 min, faça primeiro)

Read-only, não cria nada. Rode no terminal:

```bash
BASE=https://cardapio.zeloconfeitaria.com.br

# 1. Loja pública + isOpen (código de horário TZ-aware)
curl -s $BASE/api/v1/catalog/store | jq '{isOpen, paused: .store.paused_until, tz: .store.timezone}'

# 2. Catálogo (pega IDs reais de produto)
curl -s $BASE/api/v1/catalog/products | jq '.products[] | {id, name, categoryId: .category.id, categoryName: .category.name}' | head -40

# 3. Opções de checkout p/ 1 produto — troque <ID_COOKIE> por um id da etapa 2
curl -s -X POST $BASE/api/v1/checkout/options \
  -H 'content-type: application/json' \
  -d '{"productIds":["<ID_COOKIE>"]}' | jq '.scheduling'

# 4. Carrinho misto — 1 produto de "Cookies" + 1 de "Pudins"
curl -s -X POST $BASE/api/v1/checkout/options \
  -H 'content-type: application/json' \
  -d '{"productIds":["<ID_COOKIE>","<ID_PUDIM>"]}' | jq '.scheduling.mixedCart'
```

- [ ] `/catalog/store` → HTTP 200, `isOpen` booleano coerente com o horário real
- [ ] `/catalog/products` → 200, lista com `category` preenchida
- [ ] `/checkout/options` (1 produto) → 200 com `scheduling.{allowSameDay, mixedCart, hoursLabel, availableDates, timesByDate}` — **sem 500**
- [ ] `/checkout/options` (cookie + pudim) → `mixedCart: true`
- [ ] Sentry (últimos 30 min): sem pico de erro novo em `zelo-app` / `zelo-admin`

Qualquer 500 nos itens 3–4 = a reescrita do agendamento quebrou em produção → **rollback** (deploy anterior na Vercel) e me chama.

---

## P0 — Agendamento por categoria (cliente, ~15 min)

Faça no navegador, em `cardapio.zeloconfeitaria.com.br`, **com a loja aberta**:

- [ ] Adicionar só **cookies** ao carrinho → checkout → etapa de agendamento
      oferece **hoje** (se dentro da janela) e os próximos dias, intervalo 30 min
- [ ] Adicionar só **pudim** → checkout → **não** oferece hoje; primeira data é
      amanhã; horários começam **17:00** (dia de semana) ou **10:00** (fim de
      semana); intervalo de **1 h**
- [ ] Adicionar **cookie + pudim** no mesmo carrinho → checkout mostra aviso de
      carrinho misto, **botão de avançar travado**
- [ ] Conferir que os horários exibidos batem com o **relógio de Fortaleza**
      (não com UTC nem com o fuso do seu aparelho)
- [ ] Com a loja **fechada** (ou fora da janela do dia): botão **"Agora"**
      indisponível, só agendamento
- [ ] Forçar a loja **aberta** no painel (override) **antes do horário de
      abertura** → cliente ainda **não** consegue "Agora" (só dentro da janela
      real)

Painel (`admin.zeloconfeitaria.com.br`):

- [ ] **Ajustes / Configurações**: a seção global "Horários de agendamento"
      **não existe mais**
- [ ] **Catálogo → Categorias**: cada categoria tem os campos de regra de
      agendamento (mesmo dia, antecedência, piso semana/fim de semana,
      intervalo); editar um e salvar reflete no checkout do cliente

---

## P0 — Criação de pedido (`create_order` reescrito, ~20 min)

Precisa de telefone real para o OTP. Crie pedidos de teste e depois cancele.

- [ ] **Imediato + retirada + dinheiro com troco** → pedido criado, status
      "Recebido", troco correto no detalhe
- [ ] **Agendado + delivery** (endereço dentro do raio, confirmar pin no mapa)
      → taxa de entrega correta, data/hora dentro da regra da categoria
- [ ] **Com cupom** válido → desconto aplicado; total = subtotal − cupom + taxa
- [ ] **Com promoção ativa** num produto → preço promocional no item e no total
- [ ] **Estoque**: produto com `stock_quantity` baixo → criar pedido decrementa;
      ao zerar, o produto **some/desabilita** no cardápio; cancelar o pedido
      **devolve** o estoque e reativa
- [ ] **Pix**: escolher Pix → tela de pagamento com **QR + copia-e-cola** e
      contagem regressiva; pagar (app do banco) → em segundos o pedido vira
      **"confirmado"** sozinho e aparece no painel
- [ ] **Pix expirado**: deixar o código expirar → botão "gerar novo código"
      funciona (nova tentativa)
- [ ] **Endereço fora do raio máximo** → checkout oferece **só retirada**

---

## P1 — Fila de impressão da cozinha (painel + impressora, ~15 min)

Precisa da **impressora térmica** (EPSON TM-T20X) e do Chrome/Edge (WebUSB).

- [ ] Parear a impressora em **Ajustes → Impressora**
- [ ] Entrar um **pedido novo** com o painel aberto → a comanda **imprime
      sozinha**, uma vez só
- [ ] **Desconectar** a impressora (tirar o cabo) → entrar outro pedido → nada
      imprime, mas aparece indício de job na fila → **reconectar** → imprime o
      job pendente automaticamente
- [ ] **Fechar o painel**, entrar um pedido por outro caminho (site do
      cliente), **reabrir o painel** com a impressora pronta → o pedido perdido
      é reenfileirado e impresso
- [ ] Forçar erro no meio da impressão (desligar a impressora durante o corte)
      → o pedido **continua** aparecendo como não impresso (não "perde" a
      comanda) e volta pra fila
- [ ] Conferir no banco (ou no comportamento): `kitchen_printed_at` só é
      preenchido **depois** de uma impressão que terminou

---

## P1 — Kanban e tempo real (painel, ~10 min)

- [ ] Arrastar um card → avança **uma** etapa por vez (não pula colunas)
- [ ] Card de "Agendados" aparece na coluna sintética; pedidos das duas raias
      (retirada / entrega) separados
- [ ] Abrir 2 abas do painel → mudar status numa → a outra atualiza **sem
      refresh** e **sem travar** (o debounce do realtime evita tempestade de
      refetch)
- [ ] No **celular**: modal do pedido abre e fecha ok, abas legíveis, densidade
      ok
- [ ] **Pausar a loja** com prazo ("até tal hora") → no cliente, o header
      mostra o próximo horário certo (não promete abertura enquanto pausada)

---

## P1 — Avaliações de produto (Fase 2, ~10 min)

- [ ] Cliente **com** um pedido **entregue** contendo o produto X → na página
      do produto (ou no acompanhamento) consegue enviar nota + comentário
- [ ] Cliente **sem** pedido entregue de X → **não** consegue avaliar X
- [ ] A avaliação enviada entra como **pendente** e **não** aparece no site
- [ ] Painel **/avaliacoes** → badge de pendentes; aprovar a avaliação
- [ ] Após aprovar → a avaliação aparece na página do produto e a **estrela**
      aparece no card (se atingir o mínimo configurado)
- [ ] A moderação fica registrada na **auditoria** (Ajustes → Auditoria), em
      pt-br, com autor

---

## P2 — Regressão geral / bumps de dependência (~10 min)

- [ ] Navegar cardápio → produto → carrinho → checkout sem **erro no console**
- [ ] **Ícones** (lucide-react 1.29 → 1.41): conferir que nenhum ícone sumiu ou
      quebrou nas telas principais (nav, cards, kanban)
- [ ] **Sentry** (Sentry SDK 10.69 → 10.73): forçar um erro controlado (ex.:
      abrir uma rota inexistente logado) e confirmar que **chega no Sentry**
      com ambiente = production
- [ ] Depoimentos na home carregam
- [ ] Busca de produto funciona
- [ ] PWA: instalar / abrir offline mostra a tela de offline

---

## Se algo P0 falhar

1. **Rollback da aplicação**: na Vercel, promover o deployment anterior
   (pré-`69da7b9`) em `zelo-app` e `zelo-admin`.
2. A migration **não** tem rollback trivial (dropou coluna) — se o problema for
   de schema, restaurar do backup feito antes do `db push` ou recriar
   `stores.schedule_slot_times` à mão e me chamar.
3. Registrar o passo exato que quebrou + resposta/print aqui embaixo.

## Resultado

_(preencher ao rodar)_

- Data/hora:
- Deploy Vercel confirmado (`69da7b9`): sim / não
- P0 sanidade:
- P0 agendamento:
- P0 criação de pedido:
- P1 impressão:
- P1 kanban/realtime:
- P1 avaliações:
- P2 regressão:
- Falhas encontradas:
