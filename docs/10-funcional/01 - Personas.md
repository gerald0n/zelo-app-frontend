# 01 - Personas

# Objetivo

Este documento descreve os principais perfis de usuários do sistema.

As personas devem orientar decisões de produto, experiência do usuário, regras de negócio e priorização de funcionalidades.

---

# Persona 1 — Cliente

## Descrição

Pessoa que deseja consultar o cardápio da confeitaria e realizar um pedido sem depender do atendimento manual pelo WhatsApp.

O Cliente pode ser novo ou recorrente.

Sua identificação ocorre por meio de um número de telefone validado via OTP.

Não existe criação manual de conta nem uso de senha.

---

## Objetivos

- visualizar os produtos disponíveis;
- compreender preços, descrições e adicionais;
- montar o pedido com rapidez;
- escolher entre retirada e delivery;
- pagar conforme as formas disponíveis;
- acompanhar o andamento do pedido;
- repetir compras anteriores;
- receber atualizações sem precisar entrar em contato com a loja.

---

## Necessidades

- interface simples e adequada a dispositivos móveis;
- informações claras sobre disponibilidade;
- cálculo transparente dos valores;
- confirmação do endereço e da taxa de entrega;
- indicação clara dos horários disponíveis;
- acompanhamento do pedido em tempo real;
- possibilidade de cancelamento dentro das regras permitidas;
- acesso rápido ao histórico de pedidos.

---

## Dificuldades que o sistema deve evitar

- necessidade de aguardar atendimento;
- informações dispersas;
- preços pouco claros;
- dúvidas sobre o andamento do pedido;
- preenchimento repetitivo de dados;
- necessidade de criar e lembrar uma senha;
- pedidos realizados com produtos indisponíveis;
- incerteza sobre entrega, retirada ou agendamento.

---

# Persona 2 — Administrador

## Descrição

Responsável pela operação da confeitaria.

Existe apenas um Administrador e um único login administrativo na primeira versão do sistema.

O Administrador gerencia pedidos, catálogo, disponibilidade e configurações operacionais da Loja.

---

## Objetivos

- visualizar novos pedidos imediatamente;
- confirmar ou cancelar pedidos;
- acompanhar a fila de produção;
- atualizar os status;
- manter o cardápio atualizado;
- controlar disponibilidade de produtos e adicionais;
- configurar horários de funcionamento;
- configurar dados da Loja;
- reduzir erros e atendimento repetitivo;
- manter o Cliente informado.

---

## Necessidades

- dashboard operacional simples;
- acesso rápido aos pedidos pendentes;
- atualização de status com poucas ações;
- histórico completo de alterações;
- identificação de pedidos imediatos e agendados;
- visualização da forma de entrega;
- visualização da forma de pagamento;
- registro obrigatório de motivos de cancelamento;
- atualizações refletidas automaticamente na interface do Cliente.

---

## Dificuldades que o sistema deve evitar

- pedidos perdidos em conversas;
- informações incompletas;
- alteração indevida de dados históricos;
- venda de produtos indisponíveis;
- falta de clareza sobre prioridade e horário;
- ausência de registro das mudanças realizadas;
- necessidade de atualizar manualmente o Cliente a cada etapa.

---

# Princípios de Experiência por Persona

## Cliente

A experiência deve priorizar:

- autonomia;
- rapidez;
- clareza;
- confiança;
- redução de etapas;
- transparência dos valores.

## Administrador

A experiência deve priorizar:

- velocidade operacional;
- visibilidade da fila;
- prevenção de erros;
- rastreabilidade;
- baixa carga cognitiva;
- facilidade de manutenção do catálogo.
