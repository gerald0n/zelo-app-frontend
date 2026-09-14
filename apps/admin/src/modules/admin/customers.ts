import 'server-only';

import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/modules/admin/auth';

const SEARCH_LIMIT = 20;
const LIST_PAGE_SIZE = 30;

export type AdminCustomerListItem = {
  id: string;
  name: string | null;
  phoneE164: string | null;
  email: string | null;
  createdAt: string;
};

type CustomerRow = {
  id: string;
  name: string | null;
  phone_e164: string | null;
  email: string | null;
  created_at: string;
};

function mapCustomer(row: CustomerRow): AdminCustomerListItem {
  return {
    id: row.id,
    name: row.name,
    phoneE164: row.phone_e164,
    email: row.email,
    createdAt: row.created_at,
  };
}

/** Busca por nome/telefone pro combobox da comanda manual. */
export async function searchAdminCustomers(
  q: string,
): Promise<Result<AdminCustomerListItem[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  // `,`/`()` quebram a sintaxe do filtro `or()` do PostgREST.
  const term = q.trim().replace(/[,()]/g, ' ').trim();
  if (!term) return ok([]);

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('customers')
    .select('id, name, phone_e164, email, created_at')
    .or(`name.ilike.%${term}%,phone_e164.ilike.%${term}%`)
    .order('created_at', { ascending: false })
    .limit(SEARCH_LIMIT);

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível buscar clientes.', {
      cause: error,
    });
  }
  return ok((data ?? []).map(mapCustomer));
}

/** Página "Clientes" — lista paginada, mais recentes primeiro. */
export async function listAdminCustomers(options: {
  page?: number;
}): Promise<
  Result<{
    customers: AdminCustomerListItem[];
    total: number;
    page: number;
    pageSize: number;
  }>
> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const page = Math.max(1, options.page ?? 1);
  const from = (page - 1) * LIST_PAGE_SIZE;
  const to = from + LIST_PAGE_SIZE - 1;

  const { data, error, count } = await admin
    .from('customers')
    .select('id, name, phone_e164, email, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar clientes.', {
      cause: error,
    });
  }

  return ok({
    customers: (data ?? []).map(mapCustomer),
    total: count ?? 0,
    page,
    pageSize: LIST_PAGE_SIZE,
  });
}
