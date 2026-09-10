# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Cliente** — pessoa em Pereiro-CE (ou arredores) que quer consultar o cardápio da Zelo Confeitaria e fazer um pedido sozinha, sem esperar atendimento manual pelo WhatsApp. Pode ser nova ou recorrente. É identificada apenas por telefone validado via OTP por SMS — não há conta, senha ou cadastro tradicional. Usa quase sempre no celular, muitas vezes com rede instável. Situações típicas: decidir o lanche da tarde, encomendar pudim/salgados para um evento com antecedência, repetir um pedido que já deu certo.

**Administrador** — responsável pela operação da confeitaria. Na primeira versão existe **um único administrador e um único login administrativo**, sem perfis ou níveis de permissão. Autenticação administrativa é separada da identificação do cliente. Trabalha a fila de pedidos em tempo real (muitas vezes durante o preparo), atualiza status, mantém o catálogo e configura o funcionamento da loja.

## Product Purpose

Plataforma web de cardápio online e gestão de pedidos para **uma** confeitaria. Existe para tirar o fluxo de pedidos do WhatsApp e colocá-lo em um sistema único: o cliente navega, personaliza com adicionais, faz o pedido e acompanha o andamento sem depender de um atendente; a confeitaria ganha uma fila organizada, histórico imutável e controle sobre catálogo, disponibilidade e horários.

Sucesso significa: menos tempo de atendimento manual, menos erros operacionais, cliente sempre sabendo o status do pedido, e o administrador conseguindo tocar a operação diária com poucas ações e baixa carga cognitiva.

## Positioning

Não é um marketplace nem um app genérico de delivery. É o sistema **próprio** de uma confeitaria específica, modelado em cima das regras reais dela: entrega definida por **raio em linha reta** a partir da loja (faixa grátis, faixa de taxa fixa, fora do raio só retirada — nunca progressiva), **agendamento derivado por categoria** (cada categoria tem sua antecedência e seus horários — ex.: cookies no mesmo dia, pudins só a partir de 17h com um dia de antecedência), **Pix com confirmação automática via Mercado Pago**, catálogo sem variações configuráveis (cada sabor/composição é um produto próprio). O diferencial é a fidelidade a essas regras de negócio e a transparência total de valores e prazos antes da confirmação — não escala para "qualquer loja".

## Operating Context

- **Fuso e localidade:** `America/Fortaleza`. Cidade atendida: Pereiro-CE, apenas área urbana da sede. Distritos, sítios e zona rural não recebem delivery (podem usar retirada).
- **Modalidades:** retirada e delivery. Delivery exige endereço com coordenadas confirmadas no mapa; a distância loja→cliente é **linha reta** (Haversine) e define a faixa de taxa e o raio de atendimento.
- **Pagamento:** Pix com **cobrança dinâmica no Mercado Pago** (QR + copia-e-cola por pedido, expira em ~30 min, confirmação automática por webhook, reconciliação por cron, estorno quando o admin cancela um Pix pago), dinheiro (com opção de troco) e cartão, ambos pagos no recebimento.
- **Horário e agendamento:** catálogo visível com a loja fechada; pedidos imediatos só durante o funcionamento; loja fechada → só agendamento. Os dias e horários oferecidos são **derivados por categoria** (regras em `categories`: mesmo dia sim/não, antecedência mínima, piso de horário semana/fim de semana, intervalo dos slots), calculados no **fuso da loja**. Carrinho que mistura categorias com regras diferentes é bloqueado no checkout.
- **Ciclo do pedido:** Recebido → Confirmado → Em produção → Pronto (entrega/retirada) → Saiu para entrega → Entregue. Entregue e Cancelado são terminais e não retornam ao fluxo; Pix estornado (`refunded`) também é terminal. Todo cancelamento exige motivo e registra autor, data e hora. Cliente só cancela em Recebido/Confirmado/Em produção; administrador cancela qualquer pedido não terminal.
- **Fluxo que substitui:** o atendimento migrou da conversa no WhatsApp para o sistema; não há mais etapa de comprovante por WhatsApp (o Pix confirma sozinho).
- **Tempo real:** mudanças de status refletem automaticamente na tela do cliente (WebSocket + Web Push como mecanismos complementares). Push é opcional e é solicitado só **após** um pedido criado com sucesso; recusar não bloqueia nada.

## Capabilities and Constraints

**Capacidades confirmadas:** cardápio por categorias (servido de cache com invalidação on-demand), busca, página de produto com galeria de fotos e avaliações, adicionais (opção simples, sem grupos de escolha), carrinho (anônimo ou do cliente, expira em 7 dias, revalidado antes de virar pedido, carrinho local é unido ao da conta no login e sincroniza entre dispositivos), checkout multi-etapa com cupom e (para Pix) tela de pagamento com QR, OTP por SMS (Twilio Verify + fallback, protegido por Turnstile/honeypot/rate limit), cálculo transparente de taxa/prazo, pedidos imediatos e agendados, promoções e cupons, acompanhamento em tempo real, convite de avaliação ao ser entregue, histórico e recompra (sempre gera carrinho novo, validado contra o catálogo atual), depoimentos na home. **Painel admin:** kanban de duas raias com drag-and-drop, comanda manual (cliente sem conta), estoque por produto, impressão térmica (WebUSB) com fila resiliente, promoções, cupons, financeiro, moderação de avaliações, pausa da loja com prazo, push do painel, dashboard "Visão geral", CRUD de catálogo (com duplicar/galeria/reordenar), horários semanais, blackouts, auditoria em pt-BR.

**Invariantes de negócio:** produto pertence a exatamente uma categoria; produto indisponível continua visível mas desabilitado, e não entra no carrinho; categoria sem produto disponível não aparece; todo pedido tem ≥ 1 item e pertence a exatamente um cliente; itens do pedido são snapshots (nome, descrição, peso, quantidade, preço, adicionais, observação) e mudança de catálogo nunca altera pedido anterior; endereço do pedido é snapshot imutável; valores monetários em centavos (inteiros), nunca ponto flutuante como fonte de verdade; regras de negócio aplicadas no servidor, não só na interface.

**Restrições técnicas:** monorepo pnpm com dois apps Next.js 16 (App Router, Turbopack) — `apps/client` e `apps/admin` — + `packages/shared`. React 19, TypeScript strict, Tailwind CSS 4 + Radix/primitivos próprios, TanStack Query (estado remoto), React Hook Form + Zod, Zustand (carrinho), Supabase (Postgres/Auth/Storage/Realtime + Cron), Web Push + PWA instalável, Sentry. Integrações: Twilio Verify (SMS OTP), Mercado Pago (Pix), Cloudflare Turnstile (captcha), Google Maps Platform. **Mobile first** e **mínimo de etapas** são premissas de produto, não só de design. Interface em português (pt-BR); internacionalização está fora de escopo.

**Fora de escopo:** emissão fiscal, ERP, marketplace, cartão online / gateway de cartão, notificações por WhatsApp, múltiplas lojas, perfis administrativos, variações/tamanhos de produto, suíte automatizada de testes, i18n. (Sistema financeiro, controle de estoque, confirmação automática de Pix, promoções, cupons e avaliações **já foram implementados** — saíram do "fora de escopo" original.)

**Terminologia (linguagem ubíqua):** Cliente, Produto, Categoria, Adicional, Carrinho, Checkout, Pedido, Item do Pedido, Endereço Salvo, Endereço do Pedido, Loja, Recompra. Manter esses termos na interface.

## Brand Commitments

- **Nome:** Zelo Confeitaria ("Zelo"). Vinculante.
- **Negócio real, em operação** (hoje vendendo via WhatsApp). Existe identidade visual definida pela confeitaria — logotipo, cores oficiais, tom — mas **os arquivos ainda não foram entregues**. Trabalho futuro deve solicitar os ativos oficiais e não fabricar um logotipo ou uma paleta "de marca" como se fossem definitivos.
- **Tom de voz:** caloroso e próximo — como uma confeiteira de bairro falando com um cliente conhecido. Português informal e acolhedor, sem gírias em excesso. Clareza sobre valores e prazos nunca é sacrificada pelo tom.
- **Sistema visual incumbente (a documentar, não presumir como oficial):** design system compartilhado em `packages/shared/src/styles/globals.css`, importado pelos dois apps. Paleta quente de confeitaria em **tokens OKLCH** (primary vinho/framboesa, accents caramelo e pistache), tipografia Fraunces (serif/display) + Nunito (sans), `--radius` 0.5rem. Tem **tema claro e escuro** (classe `.dark` no `<html>`, com script anti-flash no `<head>` do admin). Segue o plano `docs/100-planejamento/102` (editorial minimalista). O redesign "Vidro Quente" foi revertido — ignorar. É a verdade visual atual do código; a identidade oficial da Zelo pode substituí-la quando os arquivos chegarem.

## Evidence on Hand

- **Cardápio e preços reais:** definidos e disponíveis (seed do banco / documentação de produto). Produtos atuais: cookies; mini pudins; pudins de 500 g e 1 kg; empadas de frango e de carne de sol (~100 g); coxinhas de frango e de carne de sol (~150–160 g); coxinhas de frango ou carne de sol com catupiry (~165–175 g). Cada sabor/composição é um produto próprio.
- **Documentação de produto e domínio extensa:** `docs/00-produto-e-dominio/`, `docs/10-funcional/` (personas, jornadas, regras de negócio RN-001…RN-068, ciclo de vida do pedido, catálogo, carrinho/checkout, entrega, agendamento, painel admin), `docs/20-tecnico/`.
- **Regras de entrega/taxa/agendamento:** confirmadas e numeradas (ver Operating Context).
- **Ausências que trabalho futuro NÃO pode inventar:** logotipo e identidade visual oficial da Zelo (existem, mas não entregues); fotografia real dos produtos (não disponível — usar placeholders honestos até serem fornecidas); credenciais reais de Mercado Pago / Twilio / Google Maps; conteúdo real de depoimentos e avaliações (a _feature_ existe e é moderada pelo admin, mas não fabricar textos, notas ou médias); números de vendas, contagem de clientes; endereço físico exato e telefone público da loja.

## Product Principles

1. **Autonomia sem atendente.** Cada etapa do pedido — do cardápio ao pagamento e ao acompanhamento — precisa ser concluível pelo cliente sozinho. Se algo exige "fale com a loja", é falha de produto.
2. **Transparência antes da confirmação.** Preço, taxa de entrega, prazo/agendamento e disponibilidade sempre visíveis e corretos antes de o cliente confirmar. Nunca surpreender depois.
3. **Menos etapas, mobile first.** O caminho feliz é curto e pensado para uma mão, no celular, com rede ruim. Cada campo e cada toque a mais precisa se justificar.
4. **O histórico é sagrado.** Pedidos, itens, endereços e valores são snapshots imutáveis. Mudança no catálogo nunca reescreve o passado; cancelamento sempre tem motivo e autor registrados.
5. **Fila operacional de baixa fricção.** Para o administrador: ver o pedido novo na hora, entender prioridade e modalidade num relance, mudar status com poucas ações, sem risco de corromper dado histórico.
6. **Fidelidade às regras reais da Zelo.** As regras de Pereiro (raio de entrega em linha reta, faixas de taxa, agendamento por categoria, fuso da loja, formas de pagamento) são o produto — não aproximar para "padrão de mercado".

## Accessibility & Inclusion

- **Meta: conformidade WCAG 2.1 AA.** Contraste, foco visível, navegação por teclado, alvos de toque adequados, semântica correta em formulários e no fluxo de checkout, mensagens de erro claras e associadas aos campos.
- **Contexto de uso real:** clientes em Pereiro-CE frequentemente em celulares de entrada e redes móveis instáveis. Leveza, resiliência a conexão ruim e estados de carregamento/erro honestos são parte do requisito de acessibilidade, não um extra.
- Interface em português do Brasil; linguagem simples, evitando jargão.
