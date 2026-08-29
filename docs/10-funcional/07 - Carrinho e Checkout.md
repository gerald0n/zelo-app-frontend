# 07 - Carrinho e Checkout

# Objetivo

Este documento define o funcionamento do Carrinho e do processo de checkout.

---

# Carrinho

O Carrinho representa a intenção atual de compra.

Pode ser criado:

- pelo Cliente durante a navegação;
- por uma Recompra.

O Carrinho pode ser alterado até a confirmação do Pedido.

---

# Item do Carrinho

Cada Item deve possuir:

- Produto;
- quantidade;
- Adicionais selecionados;
- observação opcional;
- preço unitário atual;
- valor dos Adicionais;
- subtotal do Item.

---

# Operações Permitidas

O Cliente pode:

- adicionar Produto;
- aumentar ou reduzir quantidade;
- alterar Adicionais;
- editar observação;
- remover Item;
- limpar Carrinho.

---

# Cálculo

O resumo deve apresentar:

- subtotal dos Produtos;
- total dos Adicionais;
- taxa de entrega;
- total final.

Todos os valores devem ser calculados em centavos.

---

# Etapas do Checkout

1. revisão do Carrinho;
2. identificação por telefone;
3. validação por OTP;
4. dados pessoais, somente se o Cliente ainda não tiver nome;
5. escolha entre imediato e agendado;
6. escolha entre retirada e delivery;
7. endereço, quando necessário;
8. cálculo da entrega;
9. forma de pagamento;
10. observações gerais;
11. revisão final;
12. confirmação.

A identificação pede apenas o celular. O nome não entra no login e não sobrescreve o cadastro existente.

Se a conta ainda não tiver nome, o sistema pergunta uma vez antes de seguir o checkout e grava no Cliente. Sem nome, o Pedido não é criado.

O Carrinho anônimo do aparelho é unido ao Carrinho persistido do Cliente no login. Alterações seguintes sincronizam para outros dispositivos da mesma conta.

A interface pode reorganizar visualmente as etapas, desde que todas as validações sejam preservadas.

---

# Validação Final

Antes de criar o Pedido, o sistema deve validar novamente:

- Loja aberta ou agendamento válido;
- telefone validado;
- existência de pelo menos um Item;
- disponibilidade dos Produtos;
- disponibilidade dos Adicionais;
- preços atuais;
- endereço, quando delivery;
- área atendida;
- distância e taxa;
- forma de pagamento habilitada;
- data e horário do agendamento.

Caso algum dado tenha mudado, o Cliente deve ser informado antes de confirmar.

---

# Criação do Pedido

Após a confirmação:

- o Pedido recebe status Recebido;
- os dados são armazenados como snapshots;
- o Carrinho deixa de representar a compra atual;
- a tela de acompanhamento é exibida;
- o sistema oferece notificações push.

---

# Recompra

A Recompra cria um novo Carrinho.

Ela deve:

- utilizar o Pedido anterior apenas como referência;
- consultar o catálogo atual;
- usar preços atuais;
- ignorar Produtos indisponíveis;
- ignorar Adicionais indisponíveis;
- informar ao Cliente sobre itens que não puderam ser restaurados.
