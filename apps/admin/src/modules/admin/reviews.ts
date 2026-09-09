import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import type { AdminReview, ReviewStatus } from '@/modules/admin/types';
import type { Database } from '@/types/database';

type ReviewUpdate = Database['public']['Tables']['order_reviews']['Update'];

const SELECT =
  'id, order_id, rating, comment, status, is_featured, customer_display_name, created_at, moderated_at, orders(order_number)';

type ReviewRow = {
  id: string;
  order_id: string;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  is_featured: boolean;
  customer_display_name: string;
  created_at: string;
  moderated_at: string | null;
  orders: { order_number: number } | { order_number: number }[] | null;
};

function mapReview(row: ReviewRow): AdminReview {
  const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
  return {
    id: row.id,
    orderId: row.order_id,
    orderNumber: order?.order_number ?? null,
    rating: row.rating,
    comment: row.comment,
    status: row.status,
    isFeatured: row.is_featured,
    customerDisplayName: row.customer_display_name,
    createdAt: row.created_at,
    moderatedAt: row.moderated_at,
  };
}

export async function listAdminReviews(
  status?: ReviewStatus,
): Promise<Result<AdminReview[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  let query = admin
    .from('order_reviews')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(200);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar as avaliações.', {
      cause: error,
    });
  }
  return ok((data ?? []).map((row) => mapReview(row as ReviewRow)));
}

export async function countPendingReviews(): Promise<Result<number>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { count, error } = await admin
    .from('order_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) {
    return err('INTERNAL_ERROR', 'Falha ao contar avaliações pendentes.', {
      cause: error,
    });
  }
  return ok(count ?? 0);
}

export type ModerateReviewInput = {
  id: string;
  status?: ReviewStatus;
  isFeatured?: boolean;
};

export async function moderateReview(
  input: ModerateReviewInput,
): Promise<Result<AdminReview>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  if (input.status === undefined && input.isFeatured === undefined) {
    return err('VALIDATION_ERROR', 'Nada para atualizar.');
  }

  const admin = createAdminSupabaseClient();
  const patch: ReviewUpdate = { moderated_at: new Date().toISOString() };
  if (input.status !== undefined) patch.status = input.status;
  if (input.isFeatured !== undefined) patch.is_featured = input.isFeatured;
  // Só depoimento aprovado pode ficar em destaque.
  if (input.status !== undefined && input.status !== 'approved') {
    patch.is_featured = false;
  }

  const { data, error } = await admin
    .from('order_reviews')
    .update(patch)
    .eq('id', input.id)
    .select(SELECT)
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'Não foi possível atualizar a avaliação.', {
      cause: error,
    });
  }

  await writeAuditLog({
    actorId: auth.data.id,
    action: 'review.moderate',
    entityType: 'order_review',
    entityId: input.id,
    metadata: {
      status: input.status ?? null,
      isFeatured: patch.is_featured ?? null,
    },
  });

  return ok(mapReview(data as ReviewRow));
}
