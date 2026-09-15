# Roadmap de teste — develop vs. main (15/09/2026)

Gerado a partir do diff `origin/main..origin/develop` (9 commits, 135 arquivos,
101 deles em `apps/`, +6949/-413 linhas, 5 migrations pendentes).

## Como subir local

```bash
git fetch origin develop
git checkout develop
pnpm install
cp apps/client/.env.example apps/client/.env.local
cp apps/admin/.env.example apps/admin/.env.local
pnpm db:start          # imprime as chaves — cole ANON_KEY e SERVICE_ROLE_KEY nos dois .env.local
pnpm dev:client         # http://localhost:3000
pnpm dev:admin          # http://localhost:3001 (outro terminal)
```

Sem `TWILIO_*`, o código OTP aparece na própria tela (não precisa SMS real).
Sem `GOOGLE_MAPS_API_KEY`, a geocodificação cai no OSM — importante, porque é
exatamente uma das áreas mexidas na develop.

Crie um admin de teste: `supabase status` dá o Studio local (normalmente
`http://127.0.0.1:54323`) — insira uma linha em `admin_users` ou use o seed,
se o projeto tiver um.

## Riscos identificados (ver análise completa na conversa)

- **Alto**: `create_order` (RPC Postgres) foi reescrita por inteiro na
  migration `20260915120000_satellite_location_sao_miguel.sql` — usada por
  todo pedido, não só São Miguel.
- **Médio**: `delivery/quote.ts` e `delivery/osm.ts` trocaram o fallback fixo
  "Pereiro-CE" por origem dinâmica (loja ou satélite); `create-order-validation.ts`
  e `CheckoutContext.tsx`/`checkout-state.ts` foram reescritos.
- **Baixo**: aprovação manual de OTP, banners, Pix manual, cancelamentos
  clicáveis, ícone WhatsApp — aditivos e bem isolados.

---

## 1. Regressão do caminho crítico (Pereiro) — prioridade máxima

A função `create_order` e `resolveDeliveryFee`/`quoteDelivery` foram
reescritas. É o que mais fatura, testa primeiro.

1. Client: monte um carrinho normal (sem local satélite), vá até
   `recebimento`, preencha endereço com rua que o Google/OSM reconheça →
   confirme que a taxa de entrega calcula certo.
2. Repita com um endereço que **não** seja reconhecido (rua inventada) →
   confirme que cai no fallback (pin manual) e ainda finaliza, ancorado nas
   coordenadas da loja.
3. Finalize um pedido pickup e um delivery, pagamento immediate e agendado.
4. Confirme no admin (`/pedidos`) que o pedido aparece certo, com item,
   adicional, cupom (se tiver) e total batendo.
5. Teste um pedido com cupom aplicado — `create-order-validation.ts` mudou
   bastante em volta disso.

## 2. Local satélite São Miguel (feature nova, ponta a ponta)

1. Admin → `Configurações` → seção do local satélite: edite horários
   (`SatelliteLocationHoursForm`) e slots de entrega
   (`SatelliteDeliverySlotsEditor`), salve e recarregue pra confirmar
   persistência.
2. Client: acesse a rota `pronta-entrega` (`ProntaEntregaClient`) — confira
   que só lista os produtos curados daquela unidade (`fulfillment_location_id`
   daquele local).
3. Client: no checkout, alterne `FulfillmentLocationToggle` entre
   Pereiro/São Miguel e confirme que `SatelliteScheduleSection` só mostra os
   dias/horários configurados (qua-sex, retirada 08h-18h, entrega meio-dia e
   noite).
4. Tente agendar um horário fora da janela (ex. domingo, ou 20h) diretamente
   via DevTools/requisição manual — a RPC
   `private.validate_satellite_fulfillment` deve rejeitar mesmo se o front
   deixar passar.
5. Finalize um pedido de "pronta entrega" em São Miguel e um de "encomenda
   via São Miguel" (usa cardápio normal) — confirme que cada um só aceita os
   produtos certos (tentar forçar um produto de pronta-entrega numa
   encomenda deve falhar no banco).
6. Confirme que um pedido normal de Pereiro **continua** funcionando sem
   nenhuma dessas restrições (não deve pedir `fulfillmentLocationId`).

## 3. Acesso sem SMS (aprovação manual)

1. Client: na tela de OTP, clique em "pedir suporte"/solicitar ajuda →
   confirme que aparece em Admin → `/suporte-acesso`.
2. Admin: aprove a solicitação → confirme que o client (que deve estar
   fazendo polling) loga sozinho em até a janela de TTL (15 min) sem digitar
   código.
3. Teste a aprovação expirar: aprove, espere passar do TTL (ou ajuste
   `expires_at` direto no banco) e confirme que o polling não usa mais essa
   aprovação.
4. Teste consumir duas vezes: depois de logar uma vez, a mesma aprovação não
   pode logar de novo (checar `consumed_at`).
5. Confirme que o fluxo normal de OTP por SMS continua funcionando em
   paralelo (não foi quebrado).

## 4. Banners promocionais

1. Admin → `Configurações` → `BannersSection`: crie um banner com imagem,
   ative/desative, reordene.
2. Client: confirme que `MenuHeroCarousel` na home mostra os banners ativos
   na ordem certa e que o carrossel dos produtos "normais" (sem banner)
   ainda funciona como antes.
3. Delete um banner e confirme que some do carrossel sem quebrar o
   restante.

## 5. Admin — funcionalidades específicas

1. `CustomerCombobox` na nova comanda: busque um cliente existente e um
   novo — confirme que autocompleta e vincula certo ao pedido.
2. `/clientes`: confira listagem, busca e paginação.
3. Pix manual: numa comanda, marque pagamento Pix como confirmado
   manualmente → confira que o status do pedido e `payment-method-label`
   refletem isso corretamente, e que não conflita com o Pix automático
   (Mercado Pago) existente.
4. Visão geral (`OperationsView`): clique na lista de cancelamentos →
   confirme que navega/filtra certo pros pedidos cancelados.
5. Botões de aviso: confirme que o ícone oficial do WhatsApp aparece certo
   em todos os lugares que usam `WhatsappNotifyButton`.
6. Upload de imagem de produto/banner: como uma rota admin removeu `sharp`
   do bundle de rotas que não mexem com imagem, confirme que upload de
   imagem de produto **e** de banner ainda processam certo (é fácil um
   refactor de bundle acidentalmente quebrar o import em alguma rota).

## 6. Client — ajustes menores

1. Telas de erro do checkout (`error.tsx` e afins): force um erro (ex.
   desligue a rede momentaneamente durante o checkout) → confirme que o
   botão de suporte WhatsApp aparece e abre a conversa certa.
2. `loading.tsx`: confirme que o indicador de carregamento aparece nas
   transições de rota em vez do nome "Zelo" piscando.
3. Endereço atual do cliente (`DeliveryAddressSection`): teste "usar minha
   localização" e confirme que ainda soma corretamente com a lógica nova de
   origem dinâmica (loja vs. satélite).

## 7. Sanidade geral antes de promover pra `main`

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build:client && pnpm build:admin
```

Roda tudo isso na `develop` antes do PR pra `main` — pega qualquer quebra
estrutural que o teste manual não cobre.
