# 106 — Avaliações e Depoimentos

Extraído do `_HANDOFF` em 2026-09-04 — só ler este doc quando for mexer em
avaliações/depoimentos. Cliente avalia o pedido / os produtos; parte disso vira
**depoimento** no site. Funcionalidade nova (não estava nem em "Evoluções
Futuras" do [00 - Produto](../00-produto-e-dominio/00%20-%20Produto.md)).
🗄️ mexe no banco; toca cliente e admin.

## Estado

**Fase 1 implementada** (2026-09-08, branch `feat/avaliacoes` — em revisão).
Fase 2 depende de volume + login por SMS confiável.

### Como ficou (Fase 1)

- Migration `20260909120000_order_reviews.sql`: `public.review_status`
  (`pending`/`approved`/`hidden`) + `public.order_reviews` (1 por pedido —
  `unique(order_id)`; `rating` 1–5, `comment` opcional ≤1000, `is_featured`,
  `customer_display_name` gravado como snapshot). RLS: leitura pública só de
  `approved && is_featured`; resto é admin-only.
- **Cliente:** ao entrar em `delivered` o pedido ganha um card "Como foi o
  seu pedido?" na tela de acompanhamento (estrelas + comentário opcional).
  O push de `delivered` virou o convite ("Como foi o pedido #N?" → abre
  `/acompanhamento/{id}?avaliar=1`). Depois de enviar, o card vira "Sua
  avaliação" com aviso de que passa por revisão.
  `POST /api/v1/orders/{id}/review` → `submitOrderReview` (confere posse +
  status `delivered` + 1 por pedido).
- **Vitrine:** `listPublicTestimonials()` (RLS filtra) alimenta o bloco
  `<Testimonials>` na home (aba "Todos") e na `/loja`. Sem nenhum aprovado,
  não renderiza a seção.
- **Admin:** aba **Avaliações** na sidebar + bottom nav, com contador de
  pendentes (badge na sidebar, `?count=pending`). Abas Pendentes/Aprovadas/
  Escondidas; ações Aprovar / Destacar / Esconder. Esconder ou despublicar
  tira o destaque automaticamente. Detalhe do pedido no admin agora carrega
  `review` junto (`order_reviews` no `DETAIL_SELECT`).
- **Testado 2026-09-08** (Supabase local, HTTP real): envio → `pending`;
  reenvio → 409 `REVIEW_NOT_ALLOWED`; `GET` do pedido traz `review` +
  `canReview:false`; admin lista/conta/aprova/destaca; home e `/loja`
  mostram o depoimento; esconder → some da vitrine e perde o destaque.
- **Follow-up:** cupom/observações no comprovante térmico e no
  acompanhamento seguem sem a linha de avaliação; nota por produto é Fase 2.

### Decisões travadas (2026-09-08)

1. **Nome no depoimento:** primeiro nome + inicial ("Maria S."), gravado
   como snapshot na avaliação no momento do envio.
2. **Mínimo p/ estrela no card do produto:** 3 (só vale na Fase 2).
3. **Push "como foi seu pedido?":** sim — push ao entrar em `delivered`
   (quando já há permissão) **+** card de convite na tela de acompanhamento.
4. **Vitrine:** bloco de depoimentos na **home** e na **página da loja**
   (`/loja`) — só os aprovados marcados como destaque.
5. **Moderação:** aba própria **"Avaliações"** na sidebar do admin (+ bottom
   nav), com contador de pendentes.

---

## A ideia central: começar por depoimentos, crescer para avaliação por produto

A diferença que importa:

- **Nota por produto** (estrelas + média nos cards e no detalhe) só faz sentido
  com **volume**. Um produto com 1 avaliação mostrando "5,0 ★" ou "2,0 ★" engana.
  Uma confeitaria nova numa cidade pequena não vai ter esse volume no dia 1.
- **Depoimento** (comentário geral sobre o pedido) rende com pouco volume — 5 ou
  6 frases boas na home já passam confiança.

É o **mesmo dado**: uma avaliação com nota + comentário, presa a um pedido
entregue. Você começa mostrando como depoimento e depois passa a **também** somar
por produto. Não é ou-um-ou-outro — é a mesma coisa em duas etapas, e a segunda é
um superconjunto da primeira.

---

## Fase 1 — Avaliação do pedido + depoimentos

### Coletar

Quando o pedido fica **"entregue"**, o cliente vê na tela de acompanhamento (e,
se quiser, por push) **"Como foi seu pedido?"** → **nota de 1 a 5 estrelas +
comentário opcional** sobre o pedido como um todo.

- Só quem teve **pedido entregue** avalia. **Uma avaliação por pedido.**
- Não pergunta "depois de pedir" — só depois de receber (antes disso o cliente
  não experimentou nada).

### Moderar (admin)

Aba **"Avaliações"** no painel: fila com cada avaliação nova · **aprovar /
esconder** · marcar como **destaque**. **Nada aparece no site sem aprovação** —
spam, ofensa, sabotagem de concorrente, e reclamação que deveria ser tratada no
particular.

### Mostrar

Os aprovados marcados como **destaque** viram **depoimentos**: bloco na home e/ou
na página da loja (primeiro nome do cliente, nota, texto, data).

---

## Fase 2 — Avaliação por produto (quando houver volume)

- A mesma avaliação de pedido passa a perguntar também, **opcional**: "o que
  achou de cada item?" — estrelas por produto do pedido.
- **Nota média por produto** aparece:
  - no **detalhe do produto** — média + distribuição + comentários;
  - nos **cards do cardápio** ("★ 4,8 · 23") — **só a partir de um mínimo**
    (ex.: 3 avaliações). Abaixo disso, não mostra estrela nenhuma (melhor nada do
    que "★ 5,0 (1)").
- **Comentário por produto** na página do produto.
- Idealmente **depois do login por SMS**
  ([Fase 14 do roadmap](./100%20-%20Roadmap%20de%20Desenvolvimento.md)) — aí a
  autoria é confiável e dá para impedir avaliação repetida de verdade.

---

## Transversal

- **Tudo passa por moderação** antes de aparecer.
- **Antes do login por SMS**, a avaliação fica presa ao pedido + telefone
  (autoria fraca). Aceitável para depoimento curado; para nota pública por
  produto, melhor esperar o login.
- **Resposta do admin ao comentário** (pública) — incremento posterior. Bom para
  mostrar cuidado e para responder a uma crítica à vista de todos.
- **Foto na avaliação** (o bolo que o cliente recebeu) — incremento posterior.
  Vende muito, mas é armazenamento + moderação de imagem.
- **Curadoria × aberto:** começar curado (pouco volume, você escolhe os
  depoimentos). Quando o volume crescer, passar a "mostrar todos os aprovados +
  média" — parece mais honesto do que uma vitrine escolhida a dedo.

---

## O que muda por baixo

| Camada | Mudança |
| --- | --- |
| Banco | Tabela de avaliações (pedido, nota, comentário, status de moderação, destaque). Na Fase 2, nota por item do pedido. |
| Cliente | Convite na tela de acompanhamento ao ser entregue; bloco de depoimentos na home/loja; (Fase 2) seção de avaliações no produto + estrela nos cards. |
| Admin | Aba "Avaliações" — moderação (liga com o [doc 103](./103%20-%20Painel%20Administrativo.md)). |
| Notificações | (opcional) push "como foi seu pedido?" após a entrega. |

---

## Prioridade

Não é urgente — é ganho que **acumula com o tempo**. Entra depois dos essenciais
de lançamento (105, Promoções do 104, Bloco 1 do 103). A **Fase 1** pode entrar
cedo porque é barata; a **Fase 2** espera o login por SMS.

---

## Decisões em aberto

1. **Nome no depoimento:** primeiro nome + inicial ("Maria S."), nome completo,
   ou o cliente escolhe? → *Recomendação: primeiro nome + inicial.*
2. **Mínimo de avaliações** para mostrar a estrela no card do produto. →
   *Recomendação: 3.*
3. **Push "como foi seu pedido?"** após a entrega — quer, ou só o convite na tela
   de acompanhamento?
