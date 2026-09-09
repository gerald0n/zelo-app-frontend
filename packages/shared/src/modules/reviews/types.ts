import type { Database } from '@/types/database';

export type ReviewStatus = Database['public']['Enums']['review_status'];

/** Avaliação do pedido, do ponto de vista do cliente (tela de acompanhamento). */
export type CustomerOrderReview = {
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  createdAt: string;
};

/** Depoimento aprovado + em destaque, exibido na vitrine pública. */
export type PublicTestimonial = {
  id: string;
  displayName: string;
  rating: number;
  comment: string;
  date: string;
};

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  hidden: 'Escondida',
};

export const REVIEW_COMMENT_MAX = 1000;

type ReviewRowShape = {
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  created_at: string;
};

/** Normaliza a linha aninhada `order_reviews` (objeto, array ou null). */
export function mapReviewRow(
  raw: ReviewRowShape | ReviewRowShape[] | null,
): CustomerOrderReview | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  return row
    ? {
        rating: row.rating,
        comment: row.comment,
        status: row.status,
        createdAt: row.created_at,
      }
    : null;
}

/**
 * "Maria Silva" -> "Maria S." · "Maria" -> "Maria" · vazio -> "Cliente".
 * O resultado é gravado como snapshot na avaliação (o nome do cadastro muda).
 */
export function buildReviewDisplayName(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0);
  if (parts.length === 0) return 'Cliente';
  const first = parts[0];
  if (parts.length === 1) return first;
  const initial = parts[parts.length - 1][0]?.toUpperCase();
  return initial ? `${first} ${initial}.` : first;
}
