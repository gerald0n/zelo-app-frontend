import 'server-only';

import sharp from 'sharp';
import { err, ok, type Result } from '@/lib/errors';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { storeLogoPublicUrl } from '@/lib/constants';
import { requirePlatformAdmin } from '@/modules/gestor/auth';
import type { CatalogStoreTheme } from '@/modules/catalog/types';
import type { Database } from '@/types/database';

type StoreRow = Database['public']['Tables']['stores']['Row'];
type StoreInsert = Database['public']['Tables']['stores']['Insert'];
type StoreUpdate = Database['public']['Tables']['stores']['Update'];

export type GestorStore = {
  id: string;
  name: string;
  domain: string | null;
  city: string;
  state: string;
  phoneE164: string;
  createdAt: string;
};

function toGestorStore(row: StoreRow): GestorStore {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    city: row.city,
    state: row.state,
    phoneE164: row.phone_e164,
    createdAt: row.created_at,
  };
}

export async function listStores(): Promise<Result<GestorStore[]>> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('stores')
    .select('id, name, domain, city, state, phone_e164, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível listar as lojas.', {
      cause: error,
    });
  }

  return ok((data ?? []).map((row) => toGestorStore(row as StoreRow)));
}

export type StoreDetail = StoreRow;

export async function getStore(id: string): Promise<Result<StoreDetail>> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('stores')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível carregar a loja.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Loja não encontrada.');

  return ok(data);
}

export type CreateStoreInput = {
  name: string;
  domain?: string | null;
  phoneE164: string;
  whatsappE164: string;
  addressLine: string;
  city: string;
  state: string;
  postalCode?: string | null;
  latitude: number;
  longitude: number;
  timezone?: string;
};

/**
 * Provisionamento manual de tenant — versão mínima do step 1 do wizard
 * desenhado na Fase E do ADR-0001 (só nome/domínio/endereço; tema, feature
 * flags e integrações ficam para quando essas fatias existirem). Domínio
 * de tenant próprio ainda depende de DNS configurado manualmente pelo
 * cliente — aqui só grava o valor, não provisiona nada na Vercel.
 */
export async function createStore(
  input: CreateStoreInput,
): Promise<Result<GestorStore>> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;

  const name = input.name.trim();
  if (!name) return err('VALIDATION_ERROR', 'Informe o nome da loja.');

  const addressLine = input.addressLine.trim();
  const city = input.city.trim();
  const state = input.state.trim();
  if (!addressLine || !city || !state) {
    return err('VALIDATION_ERROR', 'Informe o endereço completo.');
  }

  const phoneE164 = input.phoneE164.trim();
  const whatsappE164 = input.whatsappE164.trim();
  if (!/^\+\d{10,15}$/.test(phoneE164) || !/^\+\d{10,15}$/.test(whatsappE164)) {
    return err(
      'VALIDATION_ERROR',
      'Telefone e WhatsApp precisam estar em E.164 (ex.: +5588999999999).',
    );
  }

  if (
    !Number.isFinite(input.latitude) ||
    !Number.isFinite(input.longitude) ||
    (input.latitude === 0 && input.longitude === 0)
  ) {
    return err(
      'VALIDATION_ERROR',
      'Informe latitude/longitude reais (pin no Google Maps).',
    );
  }

  const domain = input.domain?.trim() || null;

  const admin = createAdminSupabaseClient();

  if (domain) {
    const { data: existing } = await admin
      .from('stores')
      .select('id')
      .eq('domain', domain)
      .maybeSingle();
    if (existing) {
      return err('VALIDATION_ERROR', 'Esse domínio já está em uso por outra loja.');
    }
  }

  const patch: StoreInsert = {
    name,
    domain,
    phone_e164: phoneE164,
    whatsapp_e164: whatsappE164,
    address_line: addressLine,
    city,
    state,
    postal_code: input.postalCode?.trim() || null,
    latitude: input.latitude,
    longitude: input.longitude,
    timezone: input.timezone?.trim() || 'America/Sao_Paulo',
  };

  const { data, error } = await admin
    .from('stores')
    .insert(patch)
    .select('id, name, domain, city, state, phone_e164, created_at')
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'Não foi possível criar a loja.', {
      cause: error,
    });
  }

  await writeGestorAuditLog({
    actorId: auth.data.id,
    action: 'store.create',
    entityId: data.id,
    metadata: { name, domain },
  });

  return ok(toGestorStore(data as StoreRow));
}

export type UpdateStoreInput = {
  name?: string;
  domain?: string | null;
  phoneE164?: string;
  whatsappE164?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  postalCode?: string | null;
};

export async function updateStore(
  id: string,
  input: UpdateStoreInput,
): Promise<Result<StoreDetail>> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;

  const admin = createAdminSupabaseClient();

  const patch: StoreUpdate = {};
  if (typeof input.name === 'string') {
    const name = input.name.trim();
    if (!name) return err('VALIDATION_ERROR', 'Informe o nome da loja.');
    patch.name = name;
  }
  if (input.domain !== undefined) {
    const domain = input.domain?.trim() || null;
    if (domain) {
      const { data: existing } = await admin
        .from('stores')
        .select('id')
        .eq('domain', domain)
        .neq('id', id)
        .maybeSingle();
      if (existing) {
        return err(
          'VALIDATION_ERROR',
          'Esse domínio já está em uso por outra loja.',
        );
      }
    }
    patch.domain = domain;
  }
  if (typeof input.phoneE164 === 'string') {
    patch.phone_e164 = input.phoneE164.trim();
  }
  if (typeof input.whatsappE164 === 'string') {
    patch.whatsapp_e164 = input.whatsappE164.trim();
  }
  if (typeof input.addressLine === 'string') {
    patch.address_line = input.addressLine.trim();
  }
  if (typeof input.city === 'string') patch.city = input.city.trim();
  if (typeof input.state === 'string') patch.state = input.state.trim();
  if (input.postalCode !== undefined) {
    patch.postal_code = input.postalCode?.trim() || null;
  }

  if (Object.keys(patch).length === 0) {
    return err('VALIDATION_ERROR', 'Nenhuma alteração informada.');
  }

  const { data, error } = await admin
    .from('stores')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível atualizar a loja.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Loja não encontrada.');

  await writeGestorAuditLog({
    actorId: auth.data.id,
    action: 'store.update',
    entityId: id,
    metadata: patch,
  });

  return ok(data);
}

const THEME_KEYS = [
  'primary',
  'primaryForeground',
  'secondary',
  'secondaryForeground',
  'accent',
  'accentForeground',
  'caramel',
  'caramelForeground',
] as const satisfies readonly (keyof CatalogStoreTheme)[];

export type UpdateStoreBrandingInput = {
  logoUrl?: string | null;
  theme: CatalogStoreTheme;
  fontPreset?: string;
};

/**
 * Step 2 do wizard (ADR-0001, Fase E): tema de cor, logo e fonte. `logoUrl`
 * é gravado tanto pelo upload (`uploadStoreLogo`, que faz o upload pro
 * Storage e chama esta função com a URL pública resultante) quanto por uma
 * URL externa informada à mão — os dois casos passam pelo mesmo campo de
 * texto na UI. Cada chave do tema é um valor CSS de cor (ex.: `oklch(0.5
 * 0.2 250)`), consumido por `buildThemeStyle()` nos dois apps de tenant —
 * uma chave vazia limpa o override. `fontPreset` é um dos ids de
 * `FONT_PRESETS` (`font-presets.ts`); preset desconhecido ou ausente cai
 * no padrão.
 */
export async function updateStoreBranding(
  id: string,
  input: UpdateStoreBrandingInput,
): Promise<Result<StoreDetail>> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;

  const theme: CatalogStoreTheme = {};
  for (const key of THEME_KEYS) {
    const value = input.theme[key]?.trim();
    if (value) theme[key] = value;
  }

  const admin = createAdminSupabaseClient();
  const patch: StoreUpdate = {
    font_config: (input.fontPreset
      ? { preset: input.fontPreset }
      : {}) as Database['public']['Tables']['stores']['Update']['font_config'],
    theme: theme as Database['public']['Tables']['stores']['Update']['theme'],
  };
  if (input.logoUrl !== undefined) {
    patch.logo_url = input.logoUrl?.trim() || null;
  }

  const { data, error } = await admin
    .from('stores')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    return err('INTERNAL_ERROR', 'Não foi possível atualizar a marca.', {
      cause: error,
    });
  }
  if (!data) return err('NOT_FOUND', 'Loja não encontrada.');

  await writeGestorAuditLog({
    actorId: auth.data.id,
    action: 'store.branding_update',
    entityId: id,
    metadata: { theme, logoUrl: patch.logo_url, fontPreset: input.fontPreset ?? null },
  });

  return ok(data);
}

/**
 * Upload de logo pro Storage (bucket `store-logos`, mesmo padrão de
 * `uploadBannerImage` no admin): não confia no `Content-Type` do cliente,
 * reencoda no servidor com `sharp` (recorta quadrado — o logo aparece em
 * selo circular/quadrado no client/admin, `ZeloSeal.tsx`), converte pra
 * WebP, envia, grava a URL pública em `stores.logo_url` e remove o arquivo
 * antigo do Storage (se o logo anterior também veio de um upload, não de
 * uma URL externa).
 */
export async function uploadStoreLogo(
  id: string,
  file: File,
): Promise<Result<StoreDetail>> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;

  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowed.has(file.type)) {
    return err('VALIDATION_ERROR', 'Use imagem JPEG, PNG ou WebP.');
  }
  if (file.size > 5 * 1024 * 1024) {
    return err('VALIDATION_ERROR', 'A imagem deve ter no máximo 5 MB.');
  }

  const current = await getStore(id);
  if (!current.ok) return current;

  const source = Buffer.from(await file.arrayBuffer());
  let normalized: Buffer;
  try {
    const pipeline = sharp(source, { failOn: 'error' }).rotate();
    const meta = await pipeline.metadata();
    if (!meta.width || !meta.height) {
      return err('VALIDATION_ERROR', 'Arquivo de imagem inválido.');
    }
    normalized = await pipeline
      .resize(512, 512, { fit: 'cover' })
      .webp({ quality: 88 })
      .toBuffer();
  } catch {
    return err('VALIDATION_ERROR', 'Arquivo de imagem inválido.');
  }

  const admin = createAdminSupabaseClient();
  const storagePath = `${id}/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await admin.storage
    .from('store-logos')
    .upload(storagePath, normalized, {
      contentType: 'image/webp',
      upsert: false,
    });
  if (uploadError) {
    return err('INTERNAL_ERROR', 'Não foi possível enviar a imagem.', {
      cause: uploadError,
    });
  }

  const publicUrl = storeLogoPublicUrl(storagePath);
  const { data, error } = await admin
    .from('stores')
    .update({ logo_url: publicUrl })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error || !data) {
    await admin.storage.from('store-logos').remove([storagePath]);
    return err('INTERNAL_ERROR', 'Não foi possível salvar o logo.', {
      cause: error,
    });
  }

  const previousUrl = current.data.logo_url;
  if (previousUrl?.includes('/storage/v1/object/public/store-logos/')) {
    const previousPath = previousUrl.split('/storage/v1/object/public/store-logos/')[1];
    if (previousPath) {
      await admin.storage.from('store-logos').remove([previousPath]);
    }
  }

  await writeGestorAuditLog({
    actorId: auth.data.id,
    action: 'store.logo_upload',
    entityId: id,
    metadata: { logoUrl: publicUrl },
  });

  return ok(data);
}

/**
 * Log de auditoria próprio do gestor — mesma tabela `audit_logs` global do
 * admin (sem `store_id`, é uma tabela cross-tenant), mas sem o efeito
 * colateral de invalidar cache de catálogo (`modules/admin/audit.ts`): uma
 * mutação de `stores` feita aqui é o cadastro do tenant, não uma mudança de
 * catálogo de um tenant já existente.
 */
async function writeGestorAuditLog(options: {
  actorId: string;
  action: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const admin = createAdminSupabaseClient();
  await admin.from('audit_logs').insert({
    actor_type: 'admin',
    actor_id: options.actorId,
    action: options.action,
    entity_type: 'store',
    entity_id: options.entityId ?? null,
    metadata: (options.metadata ?? null) as Database['public']['Tables']['audit_logs']['Insert']['metadata'],
  });
}
