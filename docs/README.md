# Documentação Completa — Cardápio Online

Esta pasta contém a base de conhecimento oficial para desenvolvimento do sistema com agentes de IA.

## Ordem de leitura

1. `00-produto-e-dominio/00 - Produto.md`
2. `00-produto-e-dominio/00.5 - Domain.md`
3. documentos funcionais em `10-funcional`
4. documentos técnicos em `20-tecnico`
5. `90-agentes/99 - Constituição do Projeto.md`
6. `90-agentes/90 - Instruções para Agentes de IA.md`
7. roadmap e plano mestre em `100-planejamento` (**histórico** — as 14 fases
   foram concluídas)
8. `20-tecnico/31 - Estado da Implementação vs. Documentação de Referência.md`
   — o que mudou depois de ago/2026 e ainda não voltou para os docs 08–11 e
   21–29
9. planos de evolução pós-lançamento: `100-planejamento/102`–`107` e
   `_HANDOFF - Evolução do App.md` (fonte viva de cada área)

## Estado atual (2026-09-09)

As 14 fases do roadmap foram concluídas e o app está **em produção**
(`cardapio.zeloconfeitaria.com.br` + `admin.zeloconfeitaria.com.br`, dois
projetos Vercel). A evolução ativa acontece nos planos 102–107. Os
documentos de referência (`10-funcional/`, `20-tecnico/`) descrevem
majoritariamente o estado de 30/08/2026 — ver o doc 31 antes de tratá-los
como verdade.

## Decisões centrais

- monorepo pnpm: `apps/client`, `apps/admin`, `packages/shared`;
- Next.js full-stack (App Router);
- TypeScript strict;
- Supabase (Postgres, Auth, Storage, Realtime);
- Twilio Verify (SMS) para OTP — com fallback de código gerado pelo app
  (`OTP_HASH_SECRET`) quando a Verify não está configurada;
- Cloudflare Turnstile no envio de OTP;
- Mercado Pago (Pix dinâmico) — confirmação automática por webhook;
- Google Maps Platform (Leaflet/OSM removidos);
- Web Push (cliente e painel; o mesmo par VAPID nos dois projetos Vercel);
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
