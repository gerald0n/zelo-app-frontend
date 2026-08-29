# 99 - Constituição do Projeto

# Objetivo

Este documento contém regras imutáveis do projeto.

Todos os agentes e desenvolvedores devem obedecê-las.

Em caso de conflito, este documento prevalece sobre decisões locais.

---

# Produto

1. O sistema atende uma única Loja.
2. O Cliente é identificado por telefone validado.
3. O Administrador utiliza e-mail e senha.
4. O Pedido é histórico permanente.
5. Carrinho e Pedido são conceitos diferentes.
6. Recompra sempre cria novo Carrinho.
7. Produtos indisponíveis não podem ser vendidos.
8. Pedidos preservam snapshots.
9. Valores monetários são armazenados em centavos.
10. Datas operacionais usam `America/Fortaleza`.

---

# Arquitetura

11. A aplicação é Next.js full-stack.
12. A aplicação é um monólito modular.
13. Não existe backend separado.
14. Regras de negócio vivem fora de componentes.
15. O domínio não depende de React ou Supabase.
16. Integrações externas usam adaptadores.
17. PostgreSQL é a fonte de verdade.
18. Realtime não substitui persistência.
19. Push não é requisito para confirmar Pedido.
20. Falha externa não pode corromper o estado principal.

---

# Banco e Segurança

21. RLS é obrigatória.
22. Service role nunca vai para o navegador.
23. Migrations aplicadas são imutáveis.
24. Pedidos e históricos não são excluídos.
25. Produtos históricos são arquivados.
26. Operações críticas usam transação.
27. Criação de Pedido é idempotente.
28. Toda entrada externa é validada.
29. Segredos ficam somente no servidor.
30. OTP nunca aparece em logs.
31. Tokens nunca aparecem em logs.
32. Dados pessoais são minimizados.
33. O Cliente acessa apenas os próprios dados.
34. Autorização administrativa é verificada no servidor.
35. Webhooks são validados e idempotentes.

---

# Código

36. TypeScript strict é obrigatório.
37. `any` é proibido.
38. `@ts-ignore` é proibido.
39. Erros não são escondidos por casts.
40. Nomes devem expressar intenção.
41. Funções devem possuir responsabilidade clara.
42. Duplicação relevante deve ser removida.
43. Abstração prematura é proibida.
44. Nova dependência exige justificativa.
45. Imports devem permanecer organizados.
46. Componentes compartilhados devem ser genéricos.
47. Componentes de domínio podem ser específicos.
48. `console.log` é proibido em produção.
49. Comentários explicam decisões, não sintaxe.
50. Código deve permanecer próximo ao módulo responsável.

---

# Interface

51. A aplicação é mobile first.
52. A aplicação é PWA instalável.
53. A interface utiliza português.
54. Internacionalização não será implementada.
55. Estados de carregamento são obrigatórios.
56. Estados vazios são obrigatórios quando aplicáveis.
57. Estados de erro são obrigatórios.
58. Acessibilidade deve ser preservada.
59. Ações duplicadas devem ser prevenidas.
60. Produtos indisponíveis aparecem desabilitados.

---

# Qualidade

61. O projeto não terá testes automatizados na primeira versão.
62. Bibliotecas de teste não devem ser instaladas.
63. Toda alteração deve passar por ESLint.
64. Toda alteração deve passar por typecheck.
65. Toda alteração deve passar por build.
66. Fluxos afetados devem ser verificados manualmente.
67. O agente deve informar o que verificou.
68. Erros inesperados devem chegar ao Sentry.
69. Logs devem ser sanitizados.
70. Documentação deve ser atualizada quando decisões mudarem.

---

# Git e Commits

71. Commits seguem Conventional Commits.
72. A mensagem de commit tem exatamente uma linha em português (pt-BR).
73. Commits não incluem `Co-authored-by: Cursor` nem trailers equivalentes.
74. Commits não usam corpo multilinha nem assinaturas automáticas do agente.

---

# Agentes de IA

75. O agente deve ler a documentação antes de codificar.
76. O agente deve procurar código existente antes de criar.
77. O agente deve preferir solução simples.
78. O agente não deve trocar stack.
79. O agente não deve alterar arquitetura sem solicitação.
80. O agente não deve inventar requisitos.
81. O agente não deve criar abstrações futuras sem necessidade.
82. O agente não deve refatorar por estética.
83. O agente deve informar riscos e limitações.
84. O agente deve preservar compatibilidade ou versionar mudanças.
85. O agente deve registrar novas decisões relevantes.
86. O agente deve corrigir contradições documentais.
87. O agente deve evitar mudanças fora do escopo.
88. O agente deve explicar impactos de banco.
89. O agente deve explicar impactos de segurança.
