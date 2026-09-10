# 00 - Produto

# Visão Geral

O sistema é uma plataforma web de cardápio online e gerenciamento de pedidos desenvolvida para digitalizar e otimizar o processo de vendas de uma confeitaria.

Seu principal objetivo é permitir que os clientes realizem pedidos de forma autônoma, sem depender do atendimento manual via WhatsApp, oferecendo uma experiência rápida, intuitiva e transparente.

Além da experiência do cliente, o sistema fornece um painel administrativo completo para gerenciamento operacional da confeitaria, permitindo acompanhar pedidos em tempo real, administrar o cardápio e configurar o funcionamento da loja.

O sistema foi concebido para reduzir o tempo gasto com atendimento manual, minimizar erros operacionais e organizar todo o fluxo de pedidos da confeitaria.

---

# Proposta de Valor

A plataforma centraliza todo o fluxo de pedidos em um único sistema.

O cliente consegue navegar pelo cardápio, personalizar produtos, realizar pedidos e acompanhar seu andamento sem depender de um atendente.

Enquanto isso, a administração possui controle completo sobre pedidos, produtos, categorias, disponibilidade e configurações da loja.

---

# Problema que o sistema resolve

## Para o cliente

- necessidade de aguardar atendimento;
- tempo de resposta variável;
- processo pouco padronizado;
- dificuldade para acompanhar o pedido.

## Para a confeitaria

- atendimento repetitivo;
- coleta manual de informações;
- possibilidade de erros;
- dificuldade para gerenciar vários pedidos;
- pouca visibilidade sobre a operação diária.

---

# Objetivos do Produto

- digitalizar o processo de pedidos;
- automatizar o atendimento inicial;
- centralizar a operação;
- melhorar a experiência de compra;
- organizar o fluxo operacional;
- facilitar o gerenciamento;
- fornecer maior controle administrativo.

---

# Público-Alvo

## Cliente

Pessoa que realiza pedidos pelo cardápio online.

A identificação ocorre por telefone validado via OTP, sem conta e senha tradicionais.

## Administrador

Responsável pelo gerenciamento operacional da confeitaria.

Existe um único Administrador na primeira versão.

---

# Funcionalidades Principais

- cardápio por categorias;
- busca e detalhes de produtos;
- adicionais;
- Carrinho;
- checkout;
- OTP por SMS;
- retirada e delivery;
- Pix, dinheiro e cartão;
- pedidos imediatos e agendados;
- acompanhamento em tempo real;
- histórico e recompra;
- painel administrativo;
- Web Push;
- PWA instalável.

---

# Produtos Atuais

- cookies;
- mini pudins;
- pudins de 500 g e 1 kg;
- empadas de frango e carne de sol, com aproximadamente 100 g;
- coxinhas de frango e carne de sol, com aproximadamente 150 g a 160 g;
- coxinhas de frango ou carne de sol com catupiry, com aproximadamente 165 g a 175 g.

Cada sabor ou composição comercial é um Produto próprio. O sistema não terá variações configuráveis na primeira versão.

---

# Premissas

- mobile first;
- menor número possível de etapas;
- telefone como identificador do Cliente;
- catálogo visível mesmo com Loja fechada;
- pedidos imediatos apenas durante o funcionamento;
- pedidos agendados permitidos conforme antecedência;
- snapshots completos em Pedidos;
- Produtos indisponíveis permanecem visíveis e desabilitados;
- Categorias sem Produtos disponíveis não aparecem.

---

# Fora do Escopo

- emissão fiscal;
- ERP / gestão contábil;
- marketplace e integrações com marketplaces;
- controle detalhado de produção;
- cartão online / gateway de cartão;
- notificações por WhatsApp;
- múltiplas lojas;
- perfis administrativos;
- internacionalização;
- suíte automatizada de testes.

---

# Evoluções já implementadas (não são mais "futuro")

Desde a versão inicial entraram em produção: **promoções**, **cupons**,
**confirmação automática de Pix** (Mercado Pago), **relatório financeiro**
(dashboard "Visão geral"), **controle de estoque** básico por produto,
**avaliações e depoimentos** (de pedido e de produto, com moderação) e a
**comanda manual**. Ver `docs/100-planejamento/103`–`107` e
`docs/20-tecnico/31`.

# Evoluções Futuras

- fidelidade;
- favoritos;
- resposta pública do admin a avaliações;
- foto do cliente na avaliação;
- múltiplas lojas.
