import {
  getSatelliteLocation,
  listSatelliteProducts,
} from '@/modules/catalog/satellite-repository';
import ProntaEntregaClient from '@/components/ProntaEntregaClient';

export const dynamic = 'force-dynamic';

export default async function ProntaEntregaPage() {
  const locationResult = await getSatelliteLocation();
  if (!locationResult.ok || !locationResult.data) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-serif text-2xl font-semibold">Pronta entrega</h1>
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar a unidade agora.
        </p>
      </div>
    );
  }
  const location = locationResult.data;

  const productsResult = await listSatelliteProducts(location.id);
  const products = productsResult.ok ? productsResult.data : [];

  return (
    <ProntaEntregaClient
      locationId={location.id}
      locationName={location.name}
      addressLine={location.addressLine}
      city={location.city}
      state={location.state}
      products={products}
    />
  );
}
