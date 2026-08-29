# Documentação Completa — Cardápio Online

Esta pasta contém a base de conhecimento oficial para desenvolvimento do sistema com agentes de IA.

## Ordem de leitura

1. `00-produto-e-dominio/00 - Produto.md`
2. `00-produto-e-dominio/00.5 - Domain.md`
3. documentos funcionais em `10-funcional`
4. documentos técnicos em `20-tecnico`
5. `90-agentes/99 - Constituição do Projeto.md`
6. `90-agentes/90 - Instruções para Agentes de IA.md`
7. roadmap e plano mestre em `100-planejamento`

## Decisões centrais

- Next.js full-stack;
- TypeScript strict;
- Supabase;
- Twilio Verify (SMS) para OTP;
- OTP do Cliente implementado na última fase;
- Google Maps Platform;
- Web Push;
- PWA;
- sem internacionalização;
- sem suíte automatizada de testes na primeira versão;
- validação por lint, typecheck, build, Sentry e verificação manual.

## Regra de precedência

Em caso de conflito:

1. Constituição do Projeto;
2. Produto e Domain;
3. Regras de Negócio;
4. Arquitetura e Segurança;
5. demais documentos;
6. decisões locais de implementação.
