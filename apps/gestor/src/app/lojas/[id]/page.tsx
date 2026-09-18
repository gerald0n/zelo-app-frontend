import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getStore, updateStore, updateStoreBranding } from '@/modules/gestor/stores';
import type { CatalogStoreTheme } from '@/modules/catalog/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const THEME_FIELDS: Array<{ key: keyof CatalogStoreTheme; label: string }> = [
  { key: 'primary', label: 'Primária' },
  { key: 'primaryForeground', label: 'Primária (texto)' },
  { key: 'secondary', label: 'Secundária' },
  { key: 'secondaryForeground', label: 'Secundária (texto)' },
  { key: 'accent', label: 'Destaque' },
  { key: 'accentForeground', label: 'Destaque (texto)' },
  { key: 'caramel', label: 'Caramelo' },
  { key: 'caramelForeground', label: 'Caramelo (texto)' },
];

export default async function LojaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { id } = await params;
  const { erro, ok } = await searchParams;

  const result = await getStore(id);
  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return <p className="text-sm text-destructive">{result.error.message}</p>;
  }

  const store = result.data;
  const theme = (store.theme ?? {}) as CatalogStoreTheme;

  async function updateStoreAction(formData: FormData): Promise<void> {
    'use server';

    const get = (key: string) => (formData.get(key) as string | null) ?? '';
    const patch = await updateStore(id, {
      name: get('name'),
      domain: get('domain') || null,
      phoneE164: get('phoneE164'),
      whatsappE164: get('whatsappE164'),
      addressLine: get('addressLine'),
      city: get('city'),
      state: get('state'),
      postalCode: get('postalCode') || null,
    });

    if (!patch.ok) {
      redirect(`/lojas/${id}?erro=${encodeURIComponent(patch.error.message)}`);
    }
    redirect(`/lojas/${id}?ok=1`);
  }

  async function updateBrandingAction(formData: FormData): Promise<void> {
    'use server';

    const get = (key: string) => (formData.get(key) as string | null) ?? '';
    const nextTheme: CatalogStoreTheme = {};
    for (const field of THEME_FIELDS) {
      nextTheme[field.key] = get(`theme.${field.key}`);
    }

    const patch = await updateStoreBranding(id, {
      logoUrl: get('logoUrl') || null,
      theme: nextTheme,
    });

    if (!patch.ok) {
      redirect(`/lojas/${id}?erro=${encodeURIComponent(patch.error.message)}`);
    }
    redirect(`/lojas/${id}?ok=1`);
  }

  return (
    <div>
      <Link href="/lojas" className="text-xs text-muted-foreground">
        ← Lojas
      </Link>
      <h1 className="mb-1 mt-2 text-xl font-bold tracking-tight">
        {store.name}
      </h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Criada em {new Date(store.created_at).toLocaleDateString('pt-BR')}
      </p>

      {erro ? <p className="mb-4 text-sm text-destructive">{erro}</p> : null}
      {ok ? (
        <p className="mb-4 text-sm text-emerald-600">Loja atualizada.</p>
      ) : null}

      <form action={updateStoreAction} className="space-y-3">
        <Field label="Nome da loja" name="name" defaultValue={store.name} required />
        <Field
          label="Domínio"
          name="domain"
          defaultValue={store.domain ?? ''}
          placeholder="cardapio.empresa.com.br"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Telefone (E.164)"
            name="phoneE164"
            defaultValue={store.phone_e164}
            required
          />
          <Field
            label="WhatsApp (E.164)"
            name="whatsappE164"
            defaultValue={store.whatsapp_e164}
            required
          />
        </div>
        <Field
          label="Endereço"
          name="addressLine"
          defaultValue={store.address_line}
          required
        />
        <div className="grid grid-cols-3 gap-3">
          <Field label="Cidade" name="city" defaultValue={store.city} required />
          <Field label="Estado (UF)" name="state" defaultValue={store.state} required />
          <Field
            label="CEP"
            name="postalCode"
            defaultValue={store.postal_code ?? ''}
          />
        </div>

        <button
          type="submit"
          className="mt-2 flex h-11 w-full items-center justify-center rounded-md bg-primary text-sm font-semibold text-white"
        >
          Salvar
        </button>
      </form>

      <h2 className="mb-1 mt-8 text-lg font-bold tracking-tight">
        Marca (tema e logo)
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Sem upload ainda — logo é uma URL já hospedada em algum lugar. Cor é
        qualquer valor CSS válido (ex.: <code>oklch(0.5 0.2 250)</code> ou{' '}
        <code>#7a2e2e</code>); campo vazio volta pro valor padrão do app.
      </p>

      <form action={updateBrandingAction} className="space-y-3">
        <Field
          label="URL do logo"
          name="logoUrl"
          defaultValue={store.logo_url ?? ''}
          placeholder="https://…/logo.png"
        />
        <div className="grid grid-cols-2 gap-3">
          {THEME_FIELDS.map((field) => (
            <Field
              key={field.key}
              label={field.label}
              name={`theme.${field.key}`}
              defaultValue={theme[field.key] ?? ''}
              placeholder="oklch(0.5 0.2 250)"
            />
          ))}
        </div>

        <button
          type="submit"
          className="mt-2 flex h-11 w-full items-center justify-center rounded-md bg-primary text-sm font-semibold text-white"
        >
          Salvar marca
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-semibold">{label}</Label>
      <Input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="h-10 w-full rounded-md border border-border px-3 text-base outline-none focus:border-primary"
      />
    </div>
  );
}
