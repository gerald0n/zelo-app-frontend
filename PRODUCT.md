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

Não é um marketplace nem um app genérico de delivery. É o sistema **próprio** de uma confeitaria específica, modelado em cima das regras reais dela: entrega só na área urbana de Pereiro-CE, taxa por rota viária (R$ 0 até 2 km, R$ 5 fixos acima disso — nunca progressiva), regra das 17:00 para agendamento, Pix conferido manualmente, catálogo sem variações configuráveis (cada sabor/composição é um produto próprio). O diferencial é a fidelidade a essas regras de negócio e a transparência total de valores e prazos antes da confirmação — não escala para "qualquer loja".

## Operating Context

- **Fuso e localidade:** `America/Fortaleza`. Cidade atendida: Pereiro-CE, apenas área urbana da sede. Distritos, sítios e zona rural não recebem delivery (podem usar retirada).
- **Modalidades:** retirada e delivery. Delivery exige endereço com coordenadas confirmadas; distância calculada por rota viária (nunca linha reta).
- **Pagamento:** Pix (copia e cola exibido pela loja, conferência manual — comprovante vai por WhatsApp e **não** confirma automaticamente), dinheiro (com opção de troco) e cartão, ambos pagos no recebimento.
- **Horário e agendamento:** catálogo visível com a loja fechada; pedidos imediatos só durante o funcionamento; loja fechada → só agendamento. Pedido feito até 17:00 agenda a partir do dia seguinte; após 17:00, a partir do segundo dia seguinte (17:00 em ponto conta como "dia seguinte").
- **Ciclo do pedido:** Recebido → Confirmado → Em produção → Pronto (entrega/retirada) → Saiu para entrega → Entregue. Entregue e Cancelado são terminais e não retornam ao fluxo. Todo cancelamento exige motivo e registra autor, data e hora. Cliente só cancela em Recebido/Confirmado/Em produção; administrador cancela qualquer pedido não terminal.
- **Fluxo que substitui:** hoje o atendimento acontece por conversa no WhatsApp; o WhatsApp permanece apenas como canal de envio de comprovante de Pix.
- **Tempo real:** mudanças de status refletem automaticamente na tela do cliente (WebSocket + Web Push como mecanismos complementares). Push é opcional e é solicitado só **após** um pedido criado com sucesso; recusar não bloqueia nada.

## Capabilities and Constraints

**Capacidades confirmadas:** cardápio por categorias, busca, página de produto, adicionais (opção simples, sem grupos de escolha), carrinho (anônimo ou do cliente, expira em 7 dias, revalidado antes de virar pedido, carrinho local é unido ao da conta no login e sincroniza entre dispositivos), checkout multi-etapa, OTP por SMS, cálculo transparente de taxa/prazo, pedidos imediatos e agendados, acompanhamento em tempo real, histórico e recompra (sempre gera carrinho novo, validado contra o catálogo atual), painel admin (fila e detalhe de pedidos, status, cancelamento com motivo, CRUD de categorias/produtos/adicionais, upload de imagens, disponibilidade rápida, configurações da loja, horários semanais, blackouts, auditoria).

**Invariantes de negócio:** produto pertence a exatamente uma categoria; produto indisponível continua visível mas desabilitado, e não entra no carrinho; categoria sem produto disponível não aparece; todo pedido tem ≥ 1 item e pertence a exatamente um cliente; itens do pedido são snapshots (nome, descrição, peso, quantidade, preço, adicionais, observação) e mudança de catálogo nunca altera pedido anterior; endereço do pedido é snapshot imutável; valores monetários em centavos (inteiros), nunca ponto flutuante como fonte de verdade; regras de negócio aplicadas no servidor, não só na interface.

**Restrições técnicas:** Next.js 16 (App Router) + TypeScript strict, Tailwind CSS 4 + shadcn/ui, TanStack Query (estado remoto), React Hook Form + Zod, Zustand (carrinho), Supabase (Postgres/Auth/Storage/Realtime), Web Push + PWA instalável, Sentry, Twilio Verify (SMS OTP — obrigatório em produção; em local o código aparece na tela). **Mobile first** e **mínimo de etapas** são premissas de produto, não só de design. Interface em português (pt-BR); internacionalização está fora de escopo.

**Fora de escopo (primeira versão):** sistema financeiro, controle de estoque, emissão fiscal, ERP, marketplace, pagamento online automatizado / gateway, confirmação automática de Pix, notificações por WhatsApp, múltiplas lojas, perfis administrativos, variações/tamanhos de produto, suíte automatizada de testes, i18n.

**Terminologia (linguagem ubíqua):** Cliente, Produto, Categoria, Adicional, Carrinho, Checkout, Pedido, Item do Pedido, Endereço Salvo, Endereço do Pedido, Loja, Recompra. Manter esses termos na interface.

## Brand Commitments

- **Nome:** Zelo Confeitaria ("Zelo"). Vinculante.
- **Negócio real, em operação** (hoje vendendo via WhatsApp). Existe identidade visual definida pela confeitaria — logotipo, cores oficiais, tom — mas **os arquivos ainda não foram entregues**. Trabalho futuro deve solicitar os ativos oficiais e não fabricar um logotipo ou uma paleta "de marca" como se fossem definitivos.
- **Tom de voz:** caloroso e próximo — como uma confeiteira de bairro falando com um cliente conhecido. Português informal e acolhedor, sem gírias em excesso. Clareza sobre valores e prazos nunca é sacrificada pelo tom.
- **Sistema visual incumbente (a documentar, não presumir como oficial):** paleta quente de confeitaria em `src/app/globals.css` (primary vinho/framboesa, accents caramelo e pistache, verde para sucesso, verde WhatsApp), tipografia Fraunces (serif/display) + Nunito (sans), `--radius` 0.625rem, tema apenas claro. É a verdade visual atual do código e ponto de partida — mas a identidade oficial da Zelo pode substituí-la quando os arquivos chegarem.

## Evidence on Hand

- **Cardápio e preços reais:** definidos e disponíveis (seed do banco / documentação de produto). Produtos atuais: cookies; mini pudins; pudins de 500 g e 1 kg; empadas de frango e de carne de sol (~100 g); coxinhas de frango e de carne de sol (~150–160 g); coxinhas de frango ou carne de sol com catupiry (~165–175 g). Cada sabor/composição é um produto próprio.
- **Documentação de produto e domínio extensa:** `docs/00-produto-e-dominio/`, `docs/10-funcional/` (personas, jornadas, regras de negócio RN-001…RN-068, ciclo de vida do pedido, catálogo, carrinho/checkout, entrega, agendamento, painel admin), `docs/20-tecnico/`.
- **Regras de entrega/taxa/agendamento:** confirmadas e numeradas (ver Operating Context).
- **Ausências que trabalho futuro NÃO pode inventar:** logotipo e identidade visual oficial da Zelo (existem, mas não entregues); fotografia real dos produtos (não disponível — usar placeholders honestos até serem fornecidas); chave Pix real / dados bancários; depoimentos, avaliações, números de vendas, contagem de clientes; endereço físico exato e telefone público da loja.

## Product Principles

1. **Autonomia sem atendente.** Cada etapa do pedido — do cardápio ao acompanhamento — precisa ser concluível pelo cliente sozinho. Se algo exige "fale com a loja", é falha de produto (exceto conferência de Pix, que é manual por decisão de negócio).
2. **Transparência antes da confirmação.** Preço, taxa de entrega, prazo/agendamento e disponibilidade sempre visíveis e corretos antes de o cliente confirmar. Nunca surpreender depois.
3. **Menos etapas, mobile first.** O caminho feliz é curto e pensado para uma mão, no celular, com rede ruim. Cada campo e cada toque a mais precisa se justificar.
4. **O histórico é sagrado.** Pedidos, itens, endereços e valores são snapshots imutáveis. Mudança no catálogo nunca reescreve o passado; cancelamento sempre tem motivo e autor registrados.
5. **Fila operacional de baixa fricção.** Para o administrador: ver o pedido novo na hora, entender prioridade e modalidade num relance, mudar status com poucas ações, sem risco de corromper dado histórico.
6. **Fidelidade às regras reais da Zelo.** As regras de Pereiro (área atendida, taxa por rota, regra das 17h, formas de pagamento) são o produto — não aproximar para "padrão de mercado".

## Accessibility & Inclusion

- **Meta: conformidade WCAG 2.1 AA.** Contraste, foco visível, navegação por teclado, alvos de toque adequados, semântica correta em formulários e no fluxo de checkout, mensagens de erro claras e associadas aos campos.
- **Contexto de uso real:** clientes em Pereiro-CE frequentemente em celulares de entrada e redes móveis instáveis. Leveza, resiliência a conexão ruim e estados de carregamento/erro honestos são parte do requisito de acessibilidade, não um extra.
- Interface em português do Brasil; linguagem simples, evitando jargão.
