import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/modules/admin/audit';
import { requireAdmin } from '@/modules/admin/auth';
import type { AdminProductReview, ReviewStatus } from '@/modules/admin/types';

const SELECT =
  'id, product_id, rating, comment, status, customer_display_name, created_at, moderated_at, products(name)';

type ReviewRow = {
  id: string;
  product_id: string;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  customer_display_name: string;
  created_at: string;
  moderated_at: string | null;
  products: { name: string } | { name: string }[] | null;
};

function mapReview(row: ReviewRow): AdminProductReview {
  const product = Array.isArray(row.products) ? row.products[0] : row.products;
  return {
    id: row.id,
    productId: row.product_id,
    productName: product?.name ?? null,
    rating: row.rating,
    comment: row.comment,
    status: row.status,
    customerDisplayName: row.customer_display_name,
    createdAt: row.created_at,
    moderatedAt: row.moderated_at,
  };
}

export async function listAdminProductReviews(
  status?: ReviewStatus,
): Promise<Result<AdminProductReview[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  let query = admin
    .from('product_reviews')
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

export async function countPendingProductReviews(): Promise<Result<number>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { count, error } = await admin
    .from('product_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) {
    return err('INTERNAL_ERROR', 'Falha ao contar avaliações pendentes.', {
      cause: error,
    });
  }
  return ok(count ?? 0);
}

export async function moderateProductReview(input: {
  id: string;
  status: ReviewStatus;
}): Promise<Result<AdminProductReview>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('product_reviews')
    .update({ status: input.status, moderated_at: new Date().toISOString() })
    .eq('id', input.id)
    .select(SELECT)
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'Não foi possível atualizar a avaliação.', {
      cause: error,
    });
  }

  // `product_review.*` invalida o cache do cardápio (a média muda) — feito
  // pelo `writeAuditLog` via `catalogTagsForAuditAction`.
  await writeAuditLog({
    actorId: auth.data.id,
    action: 'product_review.moderate',
    entityType: 'product_review',
    entityId: input.id,
    metadata: { status: input.status },
  });

  return ok(mapReview(data as ReviewRow));
}
