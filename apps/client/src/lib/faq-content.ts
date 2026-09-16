export type FaqItem = {
  question: string;
  answer: string;
};

/**
 * Fallback estático do popover de ajuda — usado só quando não há pergunta
 * ativa cadastrada em Configurações → Marketing (mesmo padrão de
 * `FALLBACK_SLIDES` em `MenuHeroCarousel.tsx`).
 */
export const FAQ_FALLBACK_ITEMS: FaqItem[] = [
  {
    question: 'Quais formas de pagamento vocês aceitam?',
    answer:
      'Aceitamos Pix pelo próprio app, com confirmação automática assim que o pagamento cai.',
  },
  {
    question: 'Posso retirar na loja ou só tem entrega?',
    answer:
      'As duas opções estão disponíveis no checkout — você escolhe entre retirar no balcão ou receber no endereço informado.',
  },
  {
    question: 'Dá pra agendar meu pedido pra outro dia ou horário?',
    answer:
      'Sim. Na etapa de recebimento do checkout você escolhe a data e o horário, dentro dos horários disponíveis da loja.',
  },
  {
    question: 'Como acompanho meu pedido depois de finalizado?',
    answer:
      'Em "Pedidos" você vê o status em tempo real — preparo, pronto, saiu pra entrega — até a conclusão.',
  },
  {
    question: 'Posso cancelar um pedido já feito?',
    answer:
      'Sim, enquanto ele ainda não entrar em preparo. Abra o pedido em "Pedidos" e use a opção de cancelamento; se já foi pago no Pix, o estorno é automático.',
  },
];
