# 90 - Instruções para Agentes de IA

# Objetivo

Este documento define como agentes de IA devem atuar ao gerar, modificar, revisar ou remover código.

Estas instruções prevalecem sobre preferências locais de implementação.

---

# Antes de Trabalhar

O agente deve:

1. ler a documentação aplicável;
2. identificar o módulo responsável;
3. procurar implementação semelhante;
4. verificar componentes, schemas e utilitários existentes;
5. confirmar as regras de negócio envolvidas;
6. escolher a solução mais simples que preserve os requisitos.

---

# Ordem de Prioridade

Quando houver mais de uma solução válida, priorizar:

1. correção;
2. simplicidade;
3. legibilidade;
4. manutenibilidade;
5. segurança;
6. performance;
7. escalabilidade.

Não sacrificar simplicidade por sofisticação desnecessária.

---

# Arquitetura

O agente deve respeitar:

- monólito modular;
- Next.js App Router;
- módulos por domínio;
- separação entre apresentação, aplicação, domínio e infraestrutura;
- regras críticas no servidor;
- integrações isoladas por adaptadores.

O agente não pode alterar a arquitetura sem solicitação explícita.

---

# Dependências

Antes de instalar qualquer biblioteca, verificar:

- a stack já resolve;
- a plataforma possui API nativa;
- existe dependência equivalente;
- há necessidade concreta;
- o custo de bundle e segurança é aceitável.

Não adicionar dependência por conveniência.

---

# Refatorações

Não refatorar código funcional sem motivo.

Refatoração é permitida quando:

- corrige bug;
- remove duplicação real;
- reduz complexidade relevante;
- melhora segurança;
- é solicitada explicitamente.

Não realizar refatorações cosméticas extensas.

---

# Internacionalização

O projeto não utilizará internacionalização.

Regras:

- textos da interface em português;
- não instalar biblioteca de i18n;
- não criar chaves de tradução;
- não abstrair textos apenas para futura tradução;
- mensagens repetidas podem ser centralizadas quando houver benefício real.

---

# Testes

O projeto não terá suíte automatizada de testes na primeira versão.

O agente não deve:

- instalar Vitest;
- instalar Testing Library;
- instalar Playwright;
- instalar MSW;
- criar arquivos `.test.*`;
- criar arquivos `.spec.*`;
- criar configuração de testes.

Em substituição, deve:

- executar typecheck;
- executar lint;
- executar build;
- realizar verificação manual dos fluxos afetados;
- informar claramente o que foi verificado.

---

# TypeScript

Obrigatório:

- `strict`;
- sem `any`;
- sem `@ts-ignore`;
- sem casts usados para esconder erro;
- `unknown` em fronteiras externas;
- Zod para entrada externa;
- tipos gerados do Supabase;
- nomes descritivos.

---

# Componentes

Componentes devem:

- possuir responsabilidade clara;
- evitar regras de negócio;
- evitar acesso direto complexo a dados;
- ser acessíveis;
- ser tipados;
- permanecer no módulo correto.

Componentes compartilhados devem ser genéricos.

Componentes de domínio podem ser específicos.

Preferir declaração `function` para componentes React.

---

# Estado

Utilizar:

- estado local para interação simples;
- React Hook Form para formulários;
- TanStack Query para estado remoto;
- Zustand para Carrinho;
- Supabase Realtime para sinalização.

Não duplicar estado derivado.

---

# API e Banco

Nunca:

- chamar service role no navegador;
- desabilitar RLS por conveniência;
- editar migration aplicada;
- implementar regra crítica apenas no cliente;
- confiar em identificador enviado sem comparar com sessão;
- usar decimal para dinheiro.

---

# Imports

- usar alias `@/` para `src`;
- usar `import type` quando aplicável;
- evitar caminhos relativos longos;
- organizar imports automaticamente;
- usar `index.ts` apenas como API pública de módulo;
- evitar barrels globais.

---

# Formatação

Adotar:

- aspas simples;
- 2 espaços;
- sem tabs;
- largura máxima de 100 caracteres;
- trailing commas;
- bracket spacing;
- ESLint;
- Prettier.

---

# Console e Logs

- não usar `console.log` em produção;
- `console.warn` e `console.error` somente em pontos controlados;
- preferir logs estruturados;
- nunca registrar segredos, OTP, tokens ou dados pessoais completos.

---

# Comentários

Comentários devem explicar:

- decisão;
- limitação externa;
- regra incomum;
- risco.

Não comentar o que o código já expressa.

---

# Nomenclatura

## Pastas

`kebab-case`.

## Componentes React

`PascalCase.tsx`.

## Hooks

`useNomeDescritivo`.

## Utilitários e módulos

`kebab-case.ts`.

## Tipos

Nomes descritivos.

Não utilizar prefixo `I`.

Evitar nomes genéricos como:

- `Data`;
- `Obj`;
- `Info`;
- `Item`;
- `Value`.

---

# TanStack Query

Convenção de hooks:

- `useGetResourceQuery`;
- `useCreateResourceMutation`;
- `useUpdateResourceMutation`;
- `useDeleteResourceMutation`.

Query keys devem ser centralizadas por módulo.

---

# Antes de Criar Código

Pesquisar:

- componente semelhante;
- schema existente;
- função existente;
- query key existente;
- utilitário existente;
- caso de uso existente;
- padrão já adotado.

Não duplicar implementação.

---

# Ao Finalizar

Executar:

1. formatação;
2. ESLint;
3. typecheck;
4. build;
5. verificação manual dos fluxos afetados;
6. revisão de segurança;
7. revisão de documentação.

Informar:

- o que mudou;
- arquivos alterados;
- decisões tomadas;
- verificações realizadas;
- limitações;
- riscos pendentes.

---

# Commits

Mensagens de commit devem seguir [Conventional Commits](https://www.conventionalcommits.org/).

Regras obrigatórias:

- uma única linha (sem corpo, sem rodapé);
- texto em português (pt-BR);
- tipo Conventional Commits no início;
- proibido incluir `Co-authored-by: Cursor` ou qualquer trailer equivalente;
- proibido multilinha, listas ou assinaturas automáticas do agente.

Tipos permitidos:

- `feat`;
- `fix`;
- `refactor`;
- `docs`;
- `chore`;
- `style`;
- `build`;
- `ci`;
- `perf`;
- `revert`.

Formato:

```text
tipo: descrição curta em português
```

Exemplos válidos:

```text
feat: adiciona CRUD de categorias no painel admin
fix: corrige taxa de entrega acima de 2 km
docs: documenta padrão de commits
```

Exemplos inválidos:

```text
feat: adiciona CRUD de categorias

Co-authored-by: Cursor <cursoragent@cursor.com>
```

```text
feat: adiciona CRUD de categorias

- cria rotas
- atualiza UI
```

---

# Proibições

O agente não deve:

- modificar `node_modules`;
- modificar outputs de build;
- adicionar i18n;
- adicionar testes;
- adicionar dependência sem justificativa;
- trocar stack;
- alterar arquitetura;
- criar backend separado;
- usar `any`;
- usar `@ts-ignore`;
- expor segredo;
- desabilitar RLS;
- editar migration aplicada;
- colocar regra crítica em componente;
- criar abstração sem uso;
- esconder erro de TypeScript;
- inventar regra de negócio;
- criar commit com `Co-authored-by: Cursor`;
- criar commit multilinha ou em idioma diferente de pt-BR.
