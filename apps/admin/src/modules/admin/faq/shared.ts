import type { Database } from '@/types/database';

export type FaqItemUpdate = Database['public']['Tables']['faq_items']['Update'];

export type AdminFaqItem = {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
};

export type FaqItemRow = {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
};

export function mapFaqItem(row: FaqItemRow): AdminFaqItem {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

export const FAQ_ITEM_SELECT = 'id, question, answer, sort_order, is_active';
