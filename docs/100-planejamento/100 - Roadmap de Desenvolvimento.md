# 100 - Roadmap de Desenvolvimento

# Objetivo

Este documento define a ordem macro de implementação.

A autenticação do Cliente por OTP, a sessão e o logout serão implementados na última fase, pois dependem da Twilio Verify (SMS) configurada para o Brasil.

---

# Fase 1 — Fundação

- criar repositório;
- criar projeto Next.js;
- configurar TypeScript strict;
- configurar Tailwind CSS;
- configurar shadcn/ui;
- configurar Prettier e ESLint;
- configurar alias `@/`;
- criar estrutura modular;
- validar variáveis de ambiente;
- criar documentação no repositório.

Critério de saída:

- lint, typecheck e build funcionando.

---

# Fase 2 — Supabase e Banco

- iniciar Supabase;
- criar migrations;
- criar enums;
- criar tabelas;
- criar constraints;
- criar índices;
- habilitar RLS;
- criar políticas;
- criar funções transacionais;
- criar seed;
- gerar tipos TypeScript;
- configurar Storage.

Critério de saída:

- banco reproduzível do zero;
- seed carregável;
- RLS revisada.

---

# Fase 3 — Infraestrutura de Desenvolvimento

- configurar clientes Supabase;
- criar tratamento de erros;
- configurar Sentry;
- criar logging sanitizado;
- criar identidade temporária de desenvolvimento para Cliente;
- impedir identidade temporária em produção.

---

# Fase 4 — Catálogo Público

- Loja e funcionamento;
- Categorias;
- Produtos;
- imagens;
- Adicionais;
- busca;
- Produto indisponível desabilitado;
- Categoria vazia oculta;
- interface mobile first.

---

# Fase 5 — Carrinho

- Zustand;
- persistência versionada;
- expiração em 7 dias;
- adicionar, editar e remover;
- observações;
- Adicionais;
- totais locais indicativos;
- revalidação no servidor.

---

# Fase 6 — Entrega, Retirada e Agendamento

- formulário de endereço;
- Google Maps;
- geocodificação;
- confirmação no mapa;
- validação da área urbana;
- cálculo por rota;
- regra de até 2 km;
- taxa fixa acima de 2 km;
- retirada;
- horários;
- regra das 17h;
- datas e horários disponíveis.

---

# Fase 7 — Checkout e Pagamento

- fluxo de checkout;
- dados do Cliente em modo temporário;
- Pix copia e cola;
- botão de comprovante no WhatsApp;
- dinheiro e troco;
- cartão no recebimento;
- revisão;
- prevenção de envio duplicado;
- criação transacional de Pedido.

---

# Fase 8 — Pedidos do Cliente

- acompanhamento;
- histórico;
- snapshots;
- cancelamento com motivo;
- recompra;
- estados de erro;
- acesso temporário controlado durante desenvolvimento.

---

# Fase 9 — Painel Administrativo

- login administrativo;
- proteção de rotas;
- dashboard;
- fila;
- detalhes;
- transições de status;
- cancelamento;
- catálogo;
- imagens;
- horários;
- configurações da Loja;
- pagamentos e notas internas.

---

# Fase 10 — Realtime

- novos Pedidos;
- alterações de status;
- invalidação do TanStack Query;
- reconexão;
- segurança das assinaturas;
- atualização automática do Cliente e Administrador.

---

# Fase 11 — Web Push

- VAPID;
- service worker;
- PushSubscription;
- armazenamento;
- envio;
- remoção de assinaturas inválidas;
- abertura do acompanhamento;
- solicitação após Pedido criado.

---

# Fase 12 — PWA

- manifest;
- ícones;
- instalação;
- cache limitado;
- página offline;
- atualização do service worker;
- validação mobile.

---

# Fase 13 — Produção

- Vercel;
- domínio;
- variáveis;
- Supabase de produção;
- chaves restritas;
- Sentry;
- backups;
- validação manual;
- monitoramento pós-deploy.

---

# Fase 14 — Autenticação do Cliente via SMS

Última fase.

- configurar Twilio Verify;
- ativar canal SMS;
- liberar Brasil em Geo Permissions;
- obter credenciais;
- implementar solicitação de OTP;
- implementar verificação;
- implementar sessão;
- implementar logout;
- reconciliar Carrinho anônimo;
- substituir identidade temporária;
- impedir bypass em ambientes publicados;
- configurar rate limits;
- validar fluxo real de ponta a ponta.

---

# Encerramento

Após a Fase 14:

- remover qualquer acesso temporário publicado;
- revisar documentação;
- revisar segurança;
- executar lint, typecheck e build;
- validar manualmente os fluxos críticos;
- registrar pendências conhecidas.
