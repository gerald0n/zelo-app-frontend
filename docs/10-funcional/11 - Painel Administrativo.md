# 11 - Painel Administrativo

# Objetivo

Este documento define as funcionalidades do painel administrativo da primeira versão.

---

# Acesso

Existe um único Administrador.

O acesso administrativo deve:

- utilizar autenticação própria;
- ser separado da autenticação dos Clientes;
- proteger todas as rotas administrativas;
- encerrar sessões inválidas;
- registrar ações relevantes.

Não existem perfis ou níveis de permissão na primeira versão.

---

# Dashboard

O dashboard deve permitir visualizar:

- novos Pedidos;
- Pedidos confirmados;
- Pedidos em produção;
- Pedidos prontos;
- Pedidos em entrega;
- Pedidos agendados;
- Pedidos concluídos;
- Pedidos cancelados.

A ordenação deve destacar prioridade operacional e horário agendado.

---

# Gerenciamento de Pedidos

O Administrador deve poder:

- visualizar detalhes;
- confirmar;
- iniciar produção;
- marcar como pronto;
- marcar saída para entrega;
- marcar como entregue;
- cancelar;
- consultar histórico;
- identificar entrega ou retirada;
- visualizar pagamento;
- visualizar endereço;
- visualizar observações.

---

# Cancelamento

Ao cancelar, o Administrador deve informar obrigatoriamente o motivo.

O sistema deve registrar:

- Administrador como autor;
- motivo;
- status anterior;
- data e hora.

---

# Gerenciamento do Catálogo

## Categorias

- criar;
- editar;
- ordenar;
- ativar;
- desativar.

## Produtos

- criar;
- editar;
- ordenar;
- ativar;
- desativar;
- definir preço;
- definir imagens;
- associar Categoria;
- associar Adicionais.

## Adicionais

- criar;
- editar;
- definir preço;
- ativar;
- desativar;
- associar Produtos.

---

# Configurações da Loja

O Administrador deve configurar:

- nome;
- informações de contato;
- telefone;
- WhatsApp;
- código Pix copia e cola;
- endereço e coordenadas da Loja;
- horários de funcionamento;
- formas de pagamento;
- modalidades de entrega;
- taxa de entrega;
- distância de gratuidade;
- localidades atendidas.

---

# Tempo Real

Novos Pedidos e mudanças relevantes devem aparecer sem recarregamento manual.

A interface administrativa deve refletir atualizações concorrentes de forma segura.

---

# Auditoria

Devem ser registradas pelo menos as seguintes ações:

- confirmação de Pedido;
- alteração de status;
- cancelamento;
- alteração de disponibilidade;
- alteração de preço;
- alteração de configurações operacionais.
