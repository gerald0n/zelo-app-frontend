# 106 — Avaliações e Depoimentos

Extraído do `_HANDOFF` em 2026-09-04 — só ler este doc quando for mexer em
avaliações/depoimentos. Cliente avalia o pedido / os produtos; parte disso vira
**depoimento** no site. Funcionalidade nova (não estava nem em "Evoluções
Futuras" do [00 - Produto](../00-produto-e-dominio/00%20-%20Produto.md)).
🗄️ mexe no banco; toca cliente e admin.

## Estado

Não iniciado. Fase 1 pode entrar a qualquer momento (barata); Fase 2
depende do login por SMS (Fase 14 do roadmap — hoje a identidade do cliente
é temporária, sem login).

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
