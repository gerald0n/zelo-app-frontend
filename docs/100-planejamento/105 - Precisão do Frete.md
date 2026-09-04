# 105 — Precisão do Frete

Extraído do `_HANDOFF` em 2026-09-04 — só ler este doc quando for mexer em
frete, mapas ou endereço de entrega.

## Estado

(a)-(d) **implementados**. (e) adiado a pedido do dono. (f) desbloqueado
(comanda manual já existe) mas não iniciado.

---

## Google Maps Platform — 100% migrado

- `src/modules/delivery/{quote,maps,osm,pereiro,fee,geo,places,
  google-maps-loader}.ts`.
- **Autocomplete** (`places.ts`, client-safe, chave
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`): Places API (New), enviesado pra
  Pereiro, session token cobrindo autocomplete + Place Details.
- **Geocodificação por texto** (`maps.ts:geocodeAddress`, chave de servidor
  `GOOGLE_MAPS_API_KEY`): travada na cidade via `components=locality:
  Pereiro|...` + endereço sem cidade no texto (senão o Google casa "Centro,
  CE" com Sobral, ~250 km). Expõe `locationType` (ROOFTOP/RANGE_INTERPOLATED/
  GEOMETRIC_CENTER/APPROXIMATE) pra sinalizar confiança baixa.
- **Reverse geocode** (`maps.ts:reverseGeocodeCoords`): quando a coordenada
  já vem pronta (autocomplete ou pin arrastado), resolve o endereço real do
  ponto em vez de ecoar o texto digitado.
- **Mapa de confirmação**: `DeliveryGoogleMap.tsx` (Google Maps JS API,
  modo híbrido/satélite) + `google-maps-loader.ts` (injeta o script uma vez
  por página). Leaflet foi **removido do projeto**. Pin fixo no centro,
  arrasto do mapa (`dragstart`/`dragend`) dispara reverse geocode +
  recotação. `[data-map-container]` é o atributo que libera pinch-zoom no
  mobile (`LockMobileZoom.tsx`) — não depende mais de classe de nenhuma lib.
- **Área de entrega**: raio em linha reta a partir da loja (não mais "está
  num dos 7 bairros"). Grátis até `store.freeDeliveryRadiusMeters`, fixo até
  `store.maxDeliveryRadiusMeters`, acima disso só retirada. Ambos os raios
  editáveis em **Ajustes → loja** no admin (`max ≥ grátis` validado).
  Bairro é `<Input>` opcional, só rótulo pro entregador, não entra na
  cotação. **Entrega de comanda manual** (admin, ver doc 103) não passa por
  essa cotação — endereço digitado livre + taxa digitada pelo admin.
- **Confiança do geocode**: `LocationPrecision = 'high'|'low'` em
  `DeliveryQuote` — `'low'` quando o Google geocodifica por texto com baixa
  precisão, ou quando cai em OSM/âncora local; sempre `'high'` quando a
  coordenada já veio de um pin que o cliente apontou. Quando `'low'`, o
  checkout mostra "Localização aproximada — confira com atenção se o pin
  está no lugar certo." O checkout **já** exige clicar "Confirmar
  localização no mapa" pra qualquer pedido de entrega, independente da
  precisão.
- Origem da loja: `stores.latitude/longitude` = `-6.048527, -38.461176`
  (R. Cap. Bandeira ~115, Pereiro-CE) — já corrigida em produção.
- CSP (`security-headers.ts`) libera `maps.googleapis.com`,
  `places.googleapis.com`, `maps.gstatic.com`, `khms0/khms1.googleapis.com`.

**Decisões travadas:**
- Google Maps Platform (não OSM/Leaflet).
- Satélite no mapa de confirmação.
- Geocodificação travada na cidade da loja.
- Fallback de rota = linha reta × 1,3 (não mais usado no caminho principal
  do quote, que agora é raio puro).

## Pendências

- **(e) Suavizar a taxa de entrega** em faixas — `calcDeliveryFeeCents`
  ainda é **binário** (sem/com taxa fixa). **Adiado a pedido do dono**, sem
  fórmula definida ainda.
- **(f) Extrair componente único de endereço** — estava bloqueado até
  existir comanda manual (doc 103, já implementada). **Agora desbloqueado**,
  mas não iniciado.

## Notas técnicas

- **`components:locality` da Geocoding API** só funciona se o endereço-texto
  não trouxer cidade/estado — com "Centro, CE, Brasil" no texto o Google
  ignora o filtro e vai pra Sobral.
- **`@types/google.maps`** não é incluído automaticamente neste projeto (TS
  "^6", `moduleResolution: "bundler"`) — precisa de `/// <reference
  types="google.maps" />` explícito no topo de qualquer arquivo novo que use
  `google.maps.*` sem importar o pacote.
- **Place Details (GET `places/{id}`) exige `X-Goog-FieldMask`** — sem ele é
  400. No autocomplete (POST) o field mask é opcional.
- **Em Pereiro o Google não devolve bairro** (`sublocality*`) pros
  endereços — foi o que motivou trocar a área de entrega de "lista de
  bairros" pra "raio a partir da loja".

### Limitação de teste conhecida — arrastar o pin do mapa

Em pelo menos duas sessões, a ferramenta de automação do navegador não
conseguiu completar um **gesto de arrastar** (drag) de ponta a ponta sobre
o canvas do Google Maps (trava por 30s, nenhum efeito). Não parece bug do
app (a mesma lógica de destino funciona via clique). Só foi verificado por
revisão de código + endpoint funcionando, nunca pelo gesto real — **testar
manualmente num aparelho de verdade antes de confiar cegamente em
produção.**
