# 105 - Precisão do Cálculo de Frete

**Prioridade: alta — vem antes dos docs 103 e 104.** É bug de dinheiro (frete
sai errado) e de confiança, e é pré-requisito da comanda manual (103, Bloco 6) e
dos números do financeiro (104, Parte C).

Legenda: 🖥️ só na tela · 🗄️ mexe no banco/servidor · 🔌 configuração externa.

---

## O problema

Mesmo digitando o endereço certo, o pin no mapa interativo marca longe da cidade.
Como a taxa de entrega é **tudo ou nada** na régua dos 2 km (grátis até 2 km,
taxa fixa acima), um erro de poucos metros no ponto **vira frete errado** — ou
você perde dinheiro, ou cobra de quem não devia.

---

## Como está hoje

**Endereço → coordenadas** (em cascata, no servidor):

1. pin ajustado pelo cliente, se houver;
2. Google Geocoding — **só se a chave estiver configurada**;
3. Nominatim (OpenStreetMap), preso a uma caixa desenhada à mão em volta de
   Pereiro;
4. fallback: centro do bairro, de uma **lista fixa no código** com coordenadas
   aproximadas ("de desenvolvimento", diz o próprio comentário).

**Mapa interativo:** Leaflet com **tiles do OpenStreetMap** (não é Google), com
cerca de 180 px de altura. Pin fixo no centro; arrastar o mapa move o ponto.

**Distância:** Google Distance Matrix (se chave) → senão OSRM (servidor **público
de demonstração**) → senão distância fixa do bairro.

---

## Diagnóstico

1. **A chave do Google provavelmente não está configurada.** Aí cai tudo no
   Nominatim, que em cidade pequena do interior **não tem número de casa nem
   muitas ruas mapeadas**. Ele devolve o meio da rua, o centro da cidade, ou —
   por causa da caixa fixa — o ponto mais próximo dentro da caixa, que pode estar
   longe.
2. **Geocodificação por texto livre** ("Rua X, 123, Centro, Pereiro, CE") é
   frágil: abreviação, bairro faltando, e ninguém checa quando a resposta é de
   baixa confiança.
3. **O mapa é OSM, não Google.** Em Pereiro o OSM tem pouco detalhe e, sem visão
   de satélite, o cliente não reconhece a própria casa para corrigir o pin. E o
   mapa é pequeno demais para mira precisa.
4. **Sem autocomplete** — o cliente digita livre, com erro.
5. **Origem da loja** vem de coordenadas digitadas na configuração; se foram
   postas "no olho", todo cálculo herda o erro.
6. **OSRM de demonstração** não é para produção e mal conhece as ruas de Pereiro.

---

## A correção

### A. Digitação com Google Places Autocomplete 🖥️🗄️
- Conforme o cliente digita, sugere endereços reais (Brasil, enviesado para a
  região da loja).
- Ao escolher a sugestão, usa o identificador exato do lugar → coordenada precisa
  (ou o melhor ponto que o Google conhece).
- "Session token" para pagar autocomplete + 1 geocodificação como uma coisa só.

### B. Mapa de confirmação = Google Maps com satélite 🖥️
- Trocar Leaflet/OSM por Google Maps JS.
- **Visão de satélite/híbrida** — o cliente vê o telhado e acerta o pin.
- Mapa **maior** (quase tela cheia no celular), pin central + botão confirmar.
- Ao soltar o pin, **geocodificação reversa**: "você está em: Rua X, ~nº Y" para
  o cliente conferir.

### C. Distância por rua = Google Routes API 🗄️
- Já está quase pronto no código; falta a chave e ser o caminho principal.
- Fallback: linha reta × 1,3 em vez do OSRM de demonstração.

### D. Tratar confiança 🗄️
- Usar o nível de precisão que o Google devolve (rooftop / interpolado /
  aproximado).
- Se não for preciso, **obrigar** o cliente a confirmar o pin — nunca aceitar
  automático.
- Guardar o pin confirmado no endereço salvo (`customer_addresses` já tem os
  campos) — cliente que volta não refaz.

### E. Origem da loja pelo mapa 🖥️ (admin)
- Na configuração, definir a localização da loja **arrastando um pin**, não
  digitando latitude/longitude.

### F. Um componente só, nos dois lados
- O mesmo "campo de endereço + mapa" serve o checkout do cliente **e** a comanda
  manual do admin (103, Bloco 6). Fazer uma vez.

---

## Custo e configuração 🔌

- Google Maps Platform (Geocoding, Places, Maps JS, Routes) é pago, com crédito
  mensal. Para o volume de uma confeitaria deve ficar dentro do gratuito, mas
  precisa de:
  - conta de faturamento no Google Cloud;
  - chave de navegador com restrição por domínio;
  - chave de servidor com restrição por API.
- As duas variáveis de ambiente já existem (`GOOGLE_MAPS_API_KEY` servidor,
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` navegador — hoje a segunda nem é usada).
- Liberar os domínios do Google Maps na política de segurança (CSP).

---

## Alternativas

- **Mapbox:** mapa bom e mais barato, mas geocodificação em cidade pequena do
  interior também é fraca.
- **Só melhorar o pin manual** (mapa grande + satélite + autocomplete para chegar
  perto + geocodificação reversa): resolve a maior parte, porque em Pereiro
  nenhum serviço acerta número de casa — a fonte da verdade é o cliente
  confirmando o pin. É a parte que mais rende.

---

## Decidido

- **Conta de faturamento no Google Cloud:** vai ser criada. Caminho é Google
  Maps Platform.
- **Visão de satélite** no mapa de confirmação: sim.
- **Mapa inteiro em Google** (não manter Leaflet) — metade do código já existe.

---

## Ordem sugerida de execução

1. **Ligar a chave do Google** + geocodificação e rota por Google como caminho
   principal (rápido — o código já existe). Já melhora muito.
2. **Autocomplete** de endereço no checkout.
3. **Mapa de confirmação em Google** + satélite + geocodificação reversa + mapa
   grande.
4. **Tratar confiança** + obrigar confirmação quando impreciso.
5. **Origem da loja pelo pin** (admin).
6. **Extrair o componente único** e usar na comanda manual (liga com o doc 103).
