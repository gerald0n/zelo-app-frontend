# 03 - Requisitos Funcionais

# Objetivo

Este documento reúne os requisitos funcionais da primeira versão do sistema.

Cada requisito descreve uma capacidade que o sistema deve oferecer.

---

# Cardápio

## RF-001 — Exibir cardápio

O sistema deve exibir o cardápio público da Loja.

## RF-002 — Exibir Categorias

O sistema deve exibir somente Categorias que possuam pelo menos um Produto disponível.

## RF-003 — Exibir Produtos indisponíveis

Produtos indisponíveis devem permanecer visíveis, com aparência desabilitada e sem possibilidade de compra.

## RF-004 — Buscar Produtos

O Cliente deve poder buscar Produtos pelo nome.

## RF-005 — Visualizar Produto

O Cliente deve poder visualizar nome, descrição, preço, imagens, disponibilidade e Adicionais.

---

# Carrinho

## RF-006 — Adicionar Item

O Cliente deve poder adicionar Produtos disponíveis ao Carrinho.

## RF-007 — Selecionar Adicionais

O Cliente deve poder selecionar apenas Adicionais associados ao Produto e disponíveis.

## RF-008 — Alterar Carrinho

O Cliente deve poder alterar quantidade, Adicionais e observação de um Item.

## RF-009 — Remover Item

O Cliente deve poder remover Itens do Carrinho.

## RF-010 — Calcular valores

O sistema deve calcular automaticamente subtotal, Adicionais, taxa de entrega e total.

---

# Identificação do Cliente

## RF-011 — Validar telefone

O sistema deve validar o telefone do Cliente por OTP.

## RF-012 — Criar Cliente automaticamente

No primeiro acesso validado, o sistema deve criar automaticamente o cadastro do Cliente.

## RF-013 — Reutilizar cadastro

Em acessos posteriores, o sistema deve identificar o Cliente pelo telefone validado.

---

# Checkout

## RF-014 — Escolher atendimento temporal

O Cliente deve poder escolher entre Pedido imediato e Pedido agendado, conforme as regras de funcionamento.

## RF-015 — Escolher modalidade de entrega

O Cliente deve poder escolher retirada ou delivery.

## RF-016 — Informar endereço

Para delivery, o Cliente deve informar ou selecionar um endereço.

## RF-017 — Confirmar localização

O Cliente deve poder confirmar a localização do endereço.

## RF-018 — Validar área atendida

O sistema deve impedir delivery para endereços fora da área urbana atendida de Pereiro.

## RF-019 — Calcular distância

O sistema deve calcular a distância por rota viária entre a Loja e o endereço.

## RF-020 — Calcular taxa de entrega

O sistema deve aplicar a taxa conforme a distância calculada.

## RF-021 — Escolher pagamento

O Cliente deve poder escolher Pix, dinheiro ou cartão.

## RF-022 — Informar troco

Ao escolher dinheiro, o Cliente deve poder informar se precisa de troco e para qual valor.

## RF-023 — Exibir Pix

Ao escolher Pix, o sistema deve exibir o código Pix copia e cola configurado.

## RF-024 — Abrir envio de comprovante

O sistema deve oferecer um botão para abrir o WhatsApp da Loja e facilitar o envio do comprovante.

## RF-025 — Revisar Pedido

O Cliente deve visualizar todos os dados e valores antes da confirmação.

## RF-026 — Confirmar Pedido

O sistema deve criar o Pedido somente após validação final do checkout.

---

# Agendamento

## RF-027 — Exibir datas permitidas

O sistema deve exibir apenas datas compatíveis com a antecedência mínima e o funcionamento da Loja.

## RF-028 — Exibir horários permitidos

O sistema deve exibir somente horários configurados como disponíveis.

## RF-029 — Restringir Loja fechada

Quando a Loja estiver fechada, o sistema deve permitir a visualização do catálogo, mas deve aceitar somente Pedidos agendados.

---

# Pedidos

## RF-030 — Criar Pedido

O sistema deve criar o Pedido com status inicial Recebido.

## RF-031 — Preservar snapshots

O Pedido deve preservar Produtos, preços, Adicionais, endereço e demais informações da compra.

## RF-032 — Exibir acompanhamento

O Cliente deve poder acompanhar o status atual e o histórico.

## RF-033 — Atualizar em tempo real

A tela do Cliente deve reagir automaticamente às alterações do Pedido.

## RF-034 — Exibir histórico

O Cliente deve poder visualizar Pedidos anteriores.

## RF-035 — Recomprar

O Cliente deve poder iniciar um novo Carrinho a partir de um Pedido anterior.

---

# Cancelamento

## RF-036 — Cancelamento pelo Cliente

O Cliente deve poder cancelar o Pedido enquanto o status permitir.

## RF-037 — Cancelamento pelo Administrador

O Administrador deve poder cancelar Pedidos ainda não finalizados.

## RF-038 — Exigir motivo

Todo cancelamento deve exigir um motivo.

## RF-039 — Registrar cancelamento

O sistema deve registrar autor, motivo, data e hora.

---

# Painel Administrativo

## RF-040 — Login administrativo

O sistema deve possuir autenticação exclusiva para um único Administrador.

## RF-041 — Dashboard operacional

O Administrador deve visualizar pedidos ativos e seus estados.

## RF-042 — Atualizar status

O Administrador deve atualizar o status dos Pedidos.

## RF-043 — Gerenciar Produtos

O Administrador deve criar, editar, ativar e desativar Produtos.

## RF-044 — Gerenciar Categorias

O Administrador deve criar, editar, ordenar, ativar e desativar Categorias.

## RF-045 — Gerenciar Adicionais

O Administrador deve criar, editar, associar e alterar a disponibilidade de Adicionais.

## RF-046 — Configurar Loja

O Administrador deve configurar informações gerais, telefone, WhatsApp, Pix, horários e localização da Loja.

## RF-047 — Configurar formas de pagamento

O Administrador deve habilitar ou desabilitar as formas de pagamento aceitas.

## RF-048 — Configurar horários

O Administrador deve configurar dias e horários de funcionamento.

---

# Notificações

## RF-049 — Solicitar permissão para push

Após a criação bem-sucedida do Pedido, o sistema deve oferecer a ativação de notificações push.

## RF-050 — Não bloquear experiência

A recusa da permissão não deve impedir nenhuma funcionalidade principal.

## RF-051 — Notificar alterações relevantes

O sistema deve enviar notificações push para mudanças relevantes de status quando houver autorização.
