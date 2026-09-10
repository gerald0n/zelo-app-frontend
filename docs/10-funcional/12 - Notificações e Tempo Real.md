# 12 - Notificações e Tempo Real

# Objetivo

Este documento define como as interfaces recebem atualizações automáticas e como o Cliente pode receber notificações push.

---

# Atualizações em Tempo Real

O sistema deve utilizar uma conexão em tempo real, como WebSocket ou mecanismo equivalente.

Ela deve ser utilizada para:

- atualizar o status na tela do Cliente;
- atualizar a fila administrativa;
- informar novos Pedidos;
- refletir cancelamentos;
- refletir alterações relevantes sem recarregamento manual.

---

# Escopo de Assinatura

Cada Cliente deve receber apenas eventos dos próprios Pedidos.

O Administrador pode receber os eventos operacionais da Loja.

As assinaturas devem respeitar autenticação e autorização.

O realtime da fila do painel (`AdminRealtimeContext`) tem **debounce** para
não disparar uma tempestade de refetch quando vários eventos chegam juntos.
A tela do cliente também **revalida os dados ao voltar o foco** na aba/PWA
(`RefreshOnVisible`), cobrindo o intervalo em que a conexão ficou suspensa.

---

# Notificações Push

Há **duas frentes de push**, com tabelas e service workers separados:

- **Push do Cliente** (`push_subscriptions`) — "seu pedido mudou de status" e
  o **convite de avaliação** ("como foi seu pedido?") quando entra em
  `delivered`. Enviado pelo `apps/admin`.
- **Push do Painel** (`admin_push_subscriptions`) — "pedido novo". Enviado
  pelo `apps/client` (no checkout / no webhook do Mercado Pago). Toggle por
  aparelho em Ajustes → Dispositivos.

Como cada app envia mirando as assinaturas do outro, o **par VAPID precisa
ser o mesmo** nos dois deploys (par distinto = 401/403 silencioso).

Após a criação bem-sucedida do Pedido, o sistema deve explicar a finalidade das notificações e solicitar permissão.

Mensagem conceitual:

> Ative as notificações para receber atualizações sobre o andamento do seu pedido.

A solicitação não deve ocorrer antes de existir contexto claro para o Cliente.

---

# Permissão Opcional

A recusa da permissão não pode impedir:

- criação do Pedido;
- acesso ao acompanhamento;
- atualização em tempo real com a página aberta;
- consulta ao histórico.

---

# Eventos Notificáveis

O sistema pode enviar push quando o Pedido for:

- confirmado;
- colocado em produção;
- marcado como pronto para entrega;
- marcado como pronto para retirada;
- enviado para entrega;
- entregue;
- cancelado.

---

# Conteúdo

As notificações devem:

- identificar a Loja;
- informar a mudança ocorrida;
- evitar dados pessoais sensíveis;
- abrir diretamente o acompanhamento do Pedido quando acionadas.

---

# Diferença entre Tempo Real e Push

## Tempo Real

Atualiza interfaces abertas.

## Push

Informa o Cliente mesmo quando o sistema não está aberto.

Os dois mecanismos são complementares.

---

# Confiabilidade

Eventos devem ser idempotentes.

Uma reconexão não pode:

- duplicar alterações;
- retroceder status;
- expor Pedidos de outro Cliente.

A interface deve consultar o estado atual do Pedido após reconectar.
