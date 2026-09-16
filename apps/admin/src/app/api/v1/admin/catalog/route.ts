import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import { listAdminAddons } from '@/modules/admin/catalog/addons';
import { listAdminCategories } from '@/modules/admin/catalog/categories';
import {
  listAdminPizzaAddons,
  listAdminPizzaSizes,
} from '@/modules/admin/catalog/pizza';
import { listAdminProducts } from '@/modules/admin/catalog/products';
import { listAdminCoupons } from '@/modules/admin/coupons';
import { listAdminPromotions } from '@/modules/admin/promotions';
import { listAdminSatelliteLocations } from '@/modules/admin/satellite-location';

export const dynamic = 'force-dynamic';

export async function GET() {
  const results = await Promise.all([
    listAdminCategories(),
    listAdminProducts(),
    listAdminAddons(),
    listAdminPromotions(),
    listAdminCoupons(),
    listAdminSatelliteLocations(),
    listAdminPizzaSizes(),
    listAdminPizzaAddons(),
  ]);
  const [
    categories,
    products,
    addons,
    promotions,
    coupons,
    satelliteLocations,
    pizzaSizes,
    pizzaAddons,
  ] = results;

  if (!categories.ok) {
    return NextResponse.json(
      { error: categories.error },
      { status: httpStatusFor(categories.error.code) },
    );
  }
  if (!products.ok) {
    return NextResponse.json(
      { error: products.error },
      { status: httpStatusFor(products.error.code) },
    );
  }
  if (!addons.ok) {
    return NextResponse.json(
      { error: addons.error },
      { status: httpStatusFor(addons.error.code) },
    );
  }
  if (!promotions.ok) {
    return NextResponse.json(
      { error: promotions.error },
      { status: httpStatusFor(promotions.error.code) },
    );
  }
  if (!coupons.ok) {
    return NextResponse.json(
      { error: coupons.error },
      { status: httpStatusFor(coupons.error.code) },
    );
  }
  if (!satelliteLocations.ok) {
    return NextResponse.json(
      { error: satelliteLocations.error },
      { status: httpStatusFor(satelliteLocations.error.code) },
    );
  }
  if (!pizzaSizes.ok) {
    return NextResponse.json(
      { error: pizzaSizes.error },
      { status: httpStatusFor(pizzaSizes.error.code) },
    );
  }
  if (!pizzaAddons.ok) {
    return NextResponse.json(
      { error: pizzaAddons.error },
      { status: httpStatusFor(pizzaAddons.error.code) },
    );
  }

  return NextResponse.json({
    categories: categories.data,
    products: products.data,
    addons: addons.data,
    promotions: promotions.data,
    coupons: coupons.data,
    satelliteLocations: satelliteLocations.data,
    pizzaSizes: pizzaSizes.data,
    pizzaAddons: pizzaAddons.data,
  });
}
