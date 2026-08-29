# 28 - Observabilidade e Tratamento de Erros

# Objetivo

Este documento define como a aplicação deve registrar, classificar e tratar falhas.

A aplicação não terá uma suíte automatizada de testes na primeira versão. Por isso, observabilidade, validação estática, logs seguros e verificação manual dos fluxos críticos ganham importância adicional.

---

# Princípios

- erros previsíveis devem possuir códigos estáveis;
- erros inesperados devem ser enviados ao Sentry;
- mensagens ao usuário devem ser claras e não técnicas;
- logs não devem conter dados sensíveis;
- falhas externas não devem corromper o estado interno;
- operações críticas devem ser rastreáveis;
- o sistema deve falhar de forma segura.

---

# Categorias de Erro

## Erros de Validação

Exemplos:

- telefone inválido;
- endereço incompleto;
- quantidade inválida;
- horário de agendamento inválido.

Devem retornar código `VALIDATION_ERROR`.

## Erros de Autenticação

Exemplos:

- sessão ausente;
- OTP inválido;
- sessão expirada.

Códigos:

- `UNAUTHENTICATED`;
- `OTP_INVALID`;
- `SESSION_EXPIRED`.

## Erros de Autorização

Exemplos:

- Cliente tentando acessar Pedido de outro Cliente;
- usuário comum tentando acessar painel administrativo.

Código:

- `FORBIDDEN`.

## Erros de Negócio

Exemplos:

- Produto indisponível;
- Carrinho expirado;
- cancelamento bloqueado;
- Loja fechada;
- endereço fora da área atendida.

Devem possuir códigos específicos e estáveis.

## Erros de Integração

Exemplos:

- Meta Cloud API indisponível;
- Google Maps sem rota;
- falha no Web Push;
- erro temporário do Supabase.

Código genérico:

- `INTEGRATION_UNAVAILABLE`.

Sempre que possível, utilizar códigos específicos por integração internamente.

## Erros Inesperados

Exemplos:

- exceção não tratada;
- estado impossível;
- falha não classificada.

Código público:

- `INTERNAL_ERROR`.

Detalhes técnicos não devem ser enviados ao Cliente.

---

# Formato de Resultado

Casos de uso devem retornar resultados tipados.

```ts
type Result<T, TCode extends string> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: {
        code: TCode;
        message: string;
      };
    };
```

Exceções devem ser reservadas para falhas inesperadas ou fronteiras de infraestrutura.

---

# Sentry

O Sentry será utilizado em:

- navegador;
- servidor;
- Route Handlers;
- Server Actions;
- tarefas e integrações críticas.

Configurar:

- ambiente;
- versão da aplicação;
- origem da falha;
- contexto sanitizado;
- tags de módulo;
- identificador técnico da operação.

Nunca enviar:

- OTP;
- senha;
- token;
- service role key;
- token da Meta;
- chave VAPID privada;
- endereço completo;
- telefone completo;
- conteúdo integral de webhooks.

---

# Logs

Logs devem ser estruturados.

Campos recomendados:

- `event`;
- `module`;
- `operation`;
- `entity_id`;
- `order_number`;
- `error_code`;
- `duration_ms`;
- `environment`;
- `timestamp`.

Dados pessoais devem ser omitidos ou mascarados.

---

# Uso de Console

## Permitido

- `console.warn`;
- `console.error`.

Somente em pontos controlados e com dados sanitizados.

## Proibido

- `console.log` em código de produção;
- log de payload completo;
- log de segredo;
- log de OTP;
- log de token.

---

# Falhas em Integrações

## SMS OTP

Se o envio falhar:

- não considerar OTP entregue;
- retornar erro controlado;
- permitir nova tentativa respeitando rate limit;
- registrar falha sanitizada no Sentry.

## Google Maps

Se não houver rota:

- não calcular taxa arbitrariamente;
- informar que o endereço não pôde ser validado;
- impedir confirmação do delivery;
- permitir retirada.

## Web Push

Falha no push:

- não desfaz alteração de status;
- não bloqueia Pedido;
- pode revogar assinatura inválida;
- deve ser registrada apenas quando operacionalmente relevante.

## Supabase Realtime

Falha ou desconexão:

- deve tentar reconectar;
- deve atualizar o estado a partir do banco;
- não deve duplicar eventos;
- não deve retroceder status.

---

# Operações Críticas

Devem possuir rastreabilidade:

- solicitação de OTP;
- verificação de OTP;
- criação de Pedido;
- alteração de status;
- cancelamento;
- alteração de preço;
- alteração de disponibilidade;
- alteração de configurações;
- falha de integração;
- upload de imagem.

---

# Alertas Recomendados

Criar alertas para:

- aumento de falhas no OTP;
- falhas repetidas na criação de Pedido;
- erros de autorização;
- falhas do Google Maps;
- aumento de erros internos;
- falhas de deploy;
- erros em funções transacionais.

---

# Mensagens ao Usuário

Mensagens devem:

- explicar o que aconteceu;
- informar o que o usuário pode fazer;
- evitar termos técnicos;
- evitar exposição de detalhes internos.

Exemplo:

> Não foi possível validar o endereço. Revise a localização ou escolha retirada.

---

# Verificação Manual

Como não haverá suíte automatizada de testes, toda entrega deve incluir verificação manual dos fluxos afetados.

A verificação deve ser proporcional ao risco e registrada no resumo da tarefa.
