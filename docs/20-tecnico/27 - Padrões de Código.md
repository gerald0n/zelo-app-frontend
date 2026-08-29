# 27 - Padrões de Código — Revisado

Este arquivo substitui referências anteriores a testes automatizados e internacionalização.

# Regras Principais

- TypeScript strict;
- sem `any`;
- sem `@ts-ignore`;
- Zod em fronteiras externas;
- valores monetários em centavos;
- datas em UTC com exibição em `America/Fortaleza`;
- componentes sem regras de negócio;
- Server Components por padrão;
- Client Components apenas quando necessários;
- imports organizados;
- alias `@/`;
- `index.ts` apenas como API pública de módulo;
- sem barrels globais;
- sem `console.log` em produção;
- comentários apenas para decisões e limitações.

# Formatação

- aspas simples;
- 2 espaços;
- sem tabs;
- largura máxima de 100 caracteres;
- trailing commas;
- bracket spacing;
- ESLint;
- Prettier.

# Internacionalização

Não utilizar biblioteca de i18n.

Textos da interface permanecem em português.

# Testes

Não criar ou configurar testes automatizados na primeira versão.

Antes de concluir uma tarefa, executar:

1. Prettier;
2. ESLint;
3. typecheck;
4. build;
5. verificação manual dos fluxos afetados.

O resumo deve informar as verificações realizadas.
