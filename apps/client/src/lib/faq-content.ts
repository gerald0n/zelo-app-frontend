export type FaqItem = {
  question: string;
  answer: string;
};

/** Conteúdo do popover de ajuda — editável sem tocar no componente. */
export const FAQ_ITEMS: FaqItem[] = [
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
