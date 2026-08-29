# 30 - Definition of Done

# Objetivo

Este documento define quando uma tarefa pode ser considerada concluída.

A primeira versão do projeto não exigirá testes automatizados nem internacionalização.

---

# Critérios Gerais

Uma tarefa está concluída quando:

- atende ao requisito;
- respeita a documentação;
- preserva regras de negócio;
- possui tipagem forte;
- valida entrada no servidor;
- trata erros previsíveis;
- não expõe dados sensíveis;
- não cria duplicação desnecessária;
- mantém a arquitetura;
- atualiza documentação quando necessário.

---

# Qualidade Estática

Antes de concluir:

- Prettier deve passar;
- ESLint deve passar;
- TypeScript deve passar sem erros;
- build deve concluir;
- não deve existir `any`;
- não deve existir `@ts-ignore`;
- não deve existir `console.log` de produção;
- imports devem estar organizados;
- variáveis não utilizadas devem ser removidas.

---

# Verificação Manual

O agente deve verificar manualmente os fluxos afetados.

Exemplos:

- renderização;
- interação;
- submissão;
- mensagens de erro;
- responsividade;
- autorização;
- atualização em tempo real.

O resumo da tarefa deve informar:

- o que foi verificado;
- o que não pôde ser verificado;
- limitações encontradas.

---

# Banco de Dados

Quando houver alteração de banco:

- migration nova criada;
- migration antiga preservada;
- constraints revisadas;
- índices avaliados;
- RLS habilitada;
- políticas revisadas;
- impacto em dados existentes considerado;
- tipos do Supabase regenerados.

---

# APIs

Quando houver contrato HTTP:

- entrada validada;
- autorização aplicada;
- resposta consistente;
- código de erro estável;
- idempotência quando necessária;
- sem stack trace;
- documentação atualizada.

---

# Interface

A interface deve:

- funcionar em mobile;
- possuir estados de carregamento;
- possuir estado vazio;
- possuir estado de erro;
- evitar ações duplicadas;
- possuir labels acessíveis;
- usar textos em português;
- não depender de internacionalização.

---

# Segurança

Verificar:

- autenticação;
- autorização;
- RLS;
- segredos no servidor;
- dados pessoais em logs;
- exposição em URLs;
- validação de upload;
- webhooks;
- rate limits quando aplicáveis.

---

# Observabilidade

Para fluxos críticos:

- erros inesperados chegam ao Sentry;
- logs são sanitizados;
- contexto suficiente é registrado;
- dados sensíveis são omitidos.

---

# Documentação

Atualizar documentação quando houver:

- nova regra;
- alteração de contrato;
- mudança de arquitetura;
- nova dependência;
- nova variável;
- mudança de banco;
- decisão relevante.

---

# Tarefa Não Concluída

Uma tarefa não está concluída quando:

- build falha;
- TypeScript possui erro;
- regra foi implementada somente no cliente;
- migration antiga foi modificada;
- documentação está contraditória;
- existe dependência sem justificativa;
- há comportamento não verificado;
- dados sensíveis aparecem em logs;
- o agente assumiu requisito relevante sem registrar.
