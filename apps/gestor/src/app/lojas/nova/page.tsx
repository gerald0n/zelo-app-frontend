import { redirect } from 'next/navigation';
import { createStore } from '@/modules/gestor/stores';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

async function createStoreAction(formData: FormData): Promise<void> {
  'use server';

  const get = (key: string) => (formData.get(key) as string | null) ?? '';
  const latitude = Number(get('latitude').replace(',', '.'));
  const longitude = Number(get('longitude').replace(',', '.'));

  const result = await createStore({
    name: get('name'),
    domain: get('domain') || null,
    phoneE164: get('phoneE164'),
    whatsappE164: get('whatsappE164'),
    addressLine: get('addressLine'),
    city: get('city'),
    state: get('state'),
    postalCode: get('postalCode') || null,
    latitude,
    longitude,
  });

  if (!result.ok) {
    redirect(`/lojas/nova?erro=${encodeURIComponent(result.error.message)}`);
  }

  redirect(`/lojas/${result.data.id}`);
}

export default async function NovaLojaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold tracking-tight">Nova loja</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Cadastro mínimo do tenant — tema, logo e feature flags ficam para
        quando essas telas existirem (ADR-0001, Fase E).
      </p>

      {erro ? (
        <p className="mb-4 text-sm text-destructive">{erro}</p>
      ) : null}

      <form action={createStoreAction} className="space-y-3">
        <Field label="Nome da loja" name="name" required />
        <Field
          label="Domínio (opcional)"
          name="domain"
          placeholder="cardapio.empresa.com.br"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Telefone (E.164)"
            name="phoneE164"
            placeholder="+5588999999999"
            required
          />
          <Field
            label="WhatsApp (E.164)"
            name="whatsappE164"
            placeholder="+5588999999999"
            required
          />
        </div>
        <Field label="Endereço" name="addressLine" required />
        <div className="grid grid-cols-3 gap-3">
          <Field label="Cidade" name="city" required />
          <Field label="Estado (UF)" name="state" required />
          <Field label="CEP" name="postalCode" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Latitude"
            name="latitude"
            placeholder="-6.048527"
            required
          />
          <Field
            label="Longitude"
            name="longitude"
            placeholder="-38.461176"
            required
          />
        </div>

        <button
          type="submit"
          className="mt-2 flex h-11 w-full items-center justify-center rounded-md bg-primary text-sm font-semibold text-white"
        >
          Criar loja
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-semibold">{label}</Label>
      <Input
        name={name}
        placeholder={placeholder}
        required={required}
        className="h-10 w-full rounded-md border border-border px-3 text-base outline-none focus:border-primary"
      />
    </div>
  );
}
