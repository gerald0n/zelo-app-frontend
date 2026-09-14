export type QuotePreview = {
  inServiceArea: boolean;
  routeDistanceMeters: number;
  latitude: number;
  longitude: number;
  formattedAddress?: string;
  locationPrecision?: 'high' | 'low';
  message?: string;
};

export async function validateAddress(payload: {
  street: string;
  number: string;
  neighborhood: string;
  complement: string;
  referencePoint: string;
  latitude?: number;
  longitude?: number;
}): Promise<{ ok: true; data: QuotePreview } | { ok: false; message: string }> {
  try {
    const response = await fetch('/api/v1/addresses/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: json?.error?.message ?? 'Não foi possível validar o endereço.',
      };
    }
    return { ok: true, data: json.validation as QuotePreview };
  } catch {
    return { ok: false, message: 'Falha de rede ao validar o endereço.' };
  }
}
