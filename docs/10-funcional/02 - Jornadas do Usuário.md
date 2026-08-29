# 02 - Jornadas do Usuário

# Objetivo

Este documento descreve as principais jornadas realizadas pelos usuários do sistema.

As jornadas representam fluxos funcionais de ponta a ponta e devem orientar telas, casos de uso, regras de negócio e testes.

---

# Jornada 1 — Consultar o Cardápio

## Ator

Cliente.

## Fluxo

1. O Cliente acessa o sistema.
2. O sistema carrega as informações da Loja.
3. O sistema exibe as Categorias que possuem pelo menos um Produto disponível.
4. O Cliente navega pelas Categorias.
5. O Cliente visualiza Produtos disponíveis e indisponíveis.
6. Produtos indisponíveis aparecem visualmente desabilitados.
7. O Cliente pode visualizar os detalhes de um Produto.
8. O Cliente pode pesquisar Produtos.

## Resultado esperado

O Cliente compreende o que está disponível, quanto custa e quais adicionais podem ser selecionados.

---

# Jornada 2 — Adicionar Produto ao Carrinho

## Ator

Cliente.

## Fluxo

1. O Cliente seleciona um Produto disponível.
2. O sistema exibe os detalhes do Produto.
3. O sistema apresenta os Adicionais permitidos.
4. O Cliente seleciona os Adicionais desejados.
5. O Cliente informa uma observação opcional.
6. O Cliente define a quantidade.
7. O sistema calcula o valor do Item.
8. O Cliente adiciona o Item ao Carrinho.
9. O sistema recalcula os totais do Carrinho.

## Resultado esperado

O Carrinho contém um Item com Produto, quantidade, Adicionais, observação e valores calculados.

---

# Jornada 3 — Realizar Pedido Imediato

## Pré-condições

- a Loja está aberta;
- o Cliente possui pelo menos um Item válido no Carrinho;
- os Produtos e Adicionais continuam disponíveis.

## Fluxo

1. O Cliente inicia o checkout.
2. O sistema solicita o número de telefone.
3. O sistema envia um código OTP.
4. O Cliente valida o código.
5. O sistema identifica ou cria o cadastro do Cliente.
6. O Cliente informa ou confirma seus dados.
7. O Cliente escolhe retirada ou delivery.
8. Para delivery, o Cliente informa e confirma o endereço.
9. O sistema valida a área atendida.
10. O sistema calcula a distância por rota.
11. O sistema calcula a taxa de entrega.
12. O Cliente escolhe Pix, dinheiro ou cartão.
13. O Cliente revisa o Pedido.
14. O sistema valida novamente Produtos, Adicionais, preços e disponibilidade.
15. O Cliente confirma o Pedido.
16. O sistema cria o Pedido com status Recebido.
17. O sistema exibe o acompanhamento.
18. O sistema oferece a ativação de notificações push.

## Resultado esperado

Um novo Pedido é criado e passa a aguardar análise do Administrador.

---

# Jornada 4 — Agendar Pedido

## Condições

O agendamento pode ser utilizado dentro ou fora do horário de funcionamento.

Quando a Loja estiver fechada, somente pedidos agendados podem ser concluídos.

## Fluxo

1. O Cliente inicia o checkout.
2. O sistema identifica que o Pedido será agendado.
3. O sistema calcula a primeira data permitida.
4. O Cliente escolhe uma data e um horário disponíveis.
5. O Cliente conclui as demais etapas do checkout.
6. O sistema registra o Pedido como agendado.
7. O Pedido é criado com a data e o horário solicitados.

## Regra de antecedência

- pedidos realizados até as 17h podem ser agendados a partir do dia seguinte;
- pedidos realizados após as 17h podem ser agendados a partir do segundo dia seguinte.

---

# Jornada 5 — Acompanhar Pedido

## Ator

Cliente.

## Fluxo

1. O Cliente acessa a tela de acompanhamento.
2. O sistema exibe o status atual.
3. O sistema exibe o histórico de alterações.
4. Quando o Administrador altera o status, a interface é atualizada automaticamente.
5. Caso o Cliente tenha autorizado notificações push, o sistema envia uma notificação.
6. O fluxo continua até Entregue ou Cancelado.

## Resultado esperado

O Cliente acompanha o Pedido sem depender de contato manual com a Loja.

---

# Jornada 6 — Confirmar e Produzir Pedido

## Ator

Administrador.

## Fluxo

1. O Administrador recebe um novo Pedido com status Recebido.
2. O Administrador analisa os dados.
3. O Administrador confirma o Pedido.
4. O Pedido passa para Confirmado.
5. Quando a produção começa, o Administrador altera para Em produção.
6. Quando finalizado:
   - delivery: Pronto para entrega;
   - retirada: Pronto para retirada.
7. Para delivery, o Administrador altera para Saiu para entrega.
8. Ao finalizar:
   - delivery: Entregue;
   - retirada: Entregue.
9. Cada alteração é registrada no histórico.

---

# Jornada 7 — Cancelar Pedido

## Cliente

1. O Cliente solicita o cancelamento.
2. O sistema verifica se o status permite cancelamento.
3. O Cliente informa obrigatoriamente o motivo.
4. O sistema registra o cancelamento.
5. O Pedido passa para Cancelado.
6. O sistema registra autor, motivo, data e hora.

O Cliente não pode cancelar quando o Pedido estiver:

- Pronto para entrega;
- Pronto para retirada;
- Saiu para entrega;
- Entregue;
- Cancelado.

## Administrador

1. O Administrador seleciona o cancelamento.
2. Informa obrigatoriamente o motivo.
3. O sistema registra o cancelamento.
4. O Pedido passa para Cancelado.

O Administrador não pode cancelar um Pedido já Entregue ou Cancelado.

---

# Jornada 8 — Recomprar

## Ator

Cliente.

## Fluxo

1. O Cliente acessa um Pedido anterior.
2. Seleciona a opção de recompra.
3. O sistema cria um novo Carrinho.
4. Os Itens antigos são usados apenas como referência.
5. O sistema valida o catálogo atual.
6. Produtos indisponíveis não são adicionados.
7. Adicionais indisponíveis não são adicionados.
8. Os preços atuais são utilizados.
9. O Cliente revisa o novo Carrinho.
10. O Cliente segue para o checkout.

## Resultado esperado

Uma nova compra é iniciada sem reutilizar ou modificar o Pedido anterior.
