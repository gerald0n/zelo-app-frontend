# 04 - Regras de Negócio

# Objetivo

Este documento centraliza as regras de negócio obrigatórias do sistema.

As regras devem ser aplicadas no servidor e não podem depender exclusivamente da interface.

---

# Cliente e Identificação

## RN-001

Todo Cliente deve possuir um telefone validado.

## RN-002

O telefone é o principal identificador do Cliente.

## RN-003

Um Cliente é criado automaticamente após a primeira validação bem-sucedida do telefone.

## RN-004

Não existe autenticação de Cliente por usuário e senha.

## RN-005

A validação do telefone deve ocorrer antes da confirmação do primeiro Pedido.

---

# Catálogo

## RN-006

Todo Produto pertence exatamente a uma Categoria.

## RN-007

Produtos indisponíveis não podem ser adicionados ao Carrinho nem vendidos.

## RN-008

Produtos indisponíveis permanecem visíveis no cardápio com aparência desabilitada.

## RN-009

Categorias sem nenhum Produto disponível não devem ser exibidas.

## RN-010

Um Produto pode possuir nenhum ou vários Adicionais.

## RN-011

O sistema não possui variações, tamanhos ou grupos de opções na primeira versão.

Cada sabor ou composição comercial deve ser cadastrado como um Produto próprio.

## RN-012

Somente Adicionais associados ao Produto podem ser selecionados.

## RN-013

Adicionais indisponíveis não podem ser vendidos.

---

# Carrinho

## RN-014

O Carrinho representa uma intenção de compra e pode ser alterado livremente antes da confirmação.

## RN-015

O Carrinho deve possuir pelo menos um Item para iniciar a confirmação do Pedido.

## RN-016

Todos os Produtos e Adicionais devem ser validados novamente antes da criação do Pedido.

## RN-017

Após a confirmação, o Carrinho origina um novo Pedido e deixa de representar a compra atual.

---

# Pedido

## RN-018

Todo Pedido pertence exatamente a um Cliente.

## RN-019

Todo Pedido possui pelo menos um Item.

## RN-020

O status inicial de todo Pedido é Recebido.

## RN-021

Recebido significa que o Pedido foi enviado pelo Cliente e aguarda análise da Loja.

## RN-022

Confirmado significa que a Loja aceitou o Pedido.

## RN-023

Para Pix, a confirmação pode ocorrer somente após conferência manual do pagamento pela Loja.

## RN-024

Todo Pedido deve preservar os valores e as informações existentes no momento da compra.

## RN-025

Alterações no catálogo não podem modificar Pedidos anteriores.

## RN-026

Pedidos Entregues ou Cancelados são terminais.

## RN-027

Pedidos cancelados não podem retornar ao fluxo normal.

---

# Entrega e Retirada

## RN-028

As modalidades disponíveis são retirada e delivery.

## RN-029

Delivery está disponível somente para endereços da área urbana atendida da cidade de Pereiro.

## RN-030

Distritos, sítios, comunidades rurais e demais localidades fora da sede urbana não são atendidos.

## RN-031

Endereços fora da área atendida podem utilizar retirada.

## RN-032

A distância deve ser calculada por rota viária entre a Loja e o endereço confirmado.

## RN-033

Distância em linha reta não deve ser usada para calcular a taxa.

## RN-034

Para rotas de até 2 km, a taxa de entrega é R$ 0,00.

## RN-035

Para rotas superiores a 2 km, a taxa fixa é R$ 5,00.

## RN-036

A taxa não aumenta progressivamente conforme a distância.

---

# Endereço

## RN-037

Todo Pedido com delivery deve possuir um Endereço do Pedido.

## RN-038

O Endereço do Pedido deve ser armazenado como snapshot imutável.

## RN-039

Alterações em Endereços Salvos não podem alterar Pedidos anteriores.

## RN-040

Um endereço só pode ser salvo mediante confirmação explícita do Cliente.

## RN-041

O endereço deve incluir coordenadas confirmadas para cálculo de rota.

---

# Horário e Agendamento

## RN-042

O catálogo pode ser visualizado quando a Loja estiver fechada.

## RN-043

Pedidos imediatos não podem ser confirmados fora do horário de funcionamento.

## RN-044

Quando a Loja estiver fechada, o checkout deve permitir somente agendamento.

## RN-045

Pedidos realizados até 17:00 podem ser agendados a partir do dia seguinte.

## RN-046

Pedidos realizados após 17:00 podem ser agendados a partir do segundo dia seguinte.

## RN-047

Exatamente 17:00 pertence à regra de entrega a partir do dia seguinte.

## RN-048

A data e o horário escolhidos devem respeitar o funcionamento configurado da Loja.

---

# Pagamento

## RN-049

As formas iniciais são Pix, dinheiro e cartão.

## RN-050

Dinheiro e cartão são pagos no recebimento.

## RN-051

No pagamento em dinheiro, o Cliente pode informar a necessidade de troco.

## RN-052

O Pix é conferido manualmente na primeira versão.

## RN-053

O sistema deve exibir o Pix copia e cola configurado pela Loja.

## RN-054

O envio de comprovante ocorre por WhatsApp e não representa confirmação automática.

## RN-055

O sistema não deve marcar Pix como pago apenas porque o Cliente acionou o botão do WhatsApp.

---

# Cancelamento

## RN-056

Todo cancelamento exige um motivo.

## RN-057

O cancelamento deve registrar autor, motivo, data e hora.

## RN-058

O Cliente pode cancelar nos status:

- Recebido;
- Confirmado;
- Em produção.

## RN-059

O Cliente não pode cancelar nos status:

- Pronto para entrega;
- Pronto para retirada;
- Saiu para entrega;
- Entregue;
- Cancelado.

## RN-060

O Administrador pode cancelar qualquer Pedido que ainda não esteja Entregue ou Cancelado.

---

# Tempo Real e Push

## RN-061

Alterações de status devem ser refletidas automaticamente na tela do Cliente.

## RN-062

A permissão para notificações push deve ser solicitada após a criação bem-sucedida do Pedido.

## RN-063

A permissão de push é opcional.

## RN-064

A recusa da permissão não pode impedir acompanhamento, checkout ou consulta do Pedido.

## RN-065

WebSocket e push são mecanismos complementares.

---

# Administração

## RN-066

A primeira versão possui apenas um Administrador.

## RN-067

Não existem perfis, funções ou níveis de permissão administrativos na primeira versão.

## RN-068

A autenticação administrativa deve ser separada da identificação dos Clientes.
