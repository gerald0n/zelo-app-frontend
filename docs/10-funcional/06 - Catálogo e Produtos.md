# 06 - Catálogo e Produtos

# Objetivo

Este documento define o comportamento funcional do catálogo, dos Produtos, das Categorias e dos Adicionais.

---

# Modelo Comercial

Cada sabor, massa ou composição principal comercializada deve ser cadastrado como um Produto independente.

Exemplos:

- Cookie Kinder;
- Cookie Nutella;
- Cookie Brownie;
- Cookie Oreo.

A primeira versão não possui:

- variações;
- tamanhos;
- grupos de escolhas;
- combinações configuráveis;
- modificadores obrigatórios.

---

# Produto

Um Produto possui:

- nome;
- descrição;
- preço;
- Categoria;
- uma ou mais imagens opcionais;
- disponibilidade;
- ordem de exibição;
- lista opcional de Adicionais.

---

# Adicional

Um Adicional possui:

- nome;
- preço;
- disponibilidade;
- associação com um ou mais Produtos.

Exemplo:

Um Cookie Nutella pode permitir o Adicional “Nutella extra”.

O Adicional não altera a identidade principal do Produto.

---

# Categoria

Uma Categoria possui:

- nome;
- descrição opcional;
- disponibilidade;
- ordem de exibição.

Categorias existem apenas para organização do cardápio.

---

# Visibilidade

## Produto disponível

- aparece normalmente;
- pode ser aberto;
- pode ser adicionado ao Carrinho.

## Produto indisponível

- permanece visível;
- aparece visualmente desabilitado;
- não pode ser adicionado ao Carrinho;
- continua preservado em Pedidos anteriores.

## Categoria vazia

Uma Categoria sem nenhum Produto disponível não deve aparecer no cardápio público.

---

# Validação

A disponibilidade exibida no cardápio não substitui a validação no checkout.

Antes da criação do Pedido, o sistema deve validar novamente:

- Produto;
- Adicionais;
- preços;
- associações;
- disponibilidade.

---

# Ordenação

O Administrador deve poder definir a ordem de:

- Categorias;
- Produtos dentro das Categorias;
- Adicionais.

---

# Histórico

Alterações no catálogo não podem modificar:

- nome registrado em Item de Pedido;
- preço praticado;
- Adicionais comprados;
- descrição histórica relevante;
- quantidade;
- observações.

O Item do Pedido deve armazenar snapshots suficientes para preservar a compra.
