import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import {
  listAdminAddons,
  listAdminCategories,
  listAdminProducts,
} from '@/modules/admin/catalog';
import { listAdminCoupons } from '@/modules/admin/coupons';
import { listAdminPromotions } from '@/modules/admin/promotions';

export const dynamic = 'force-dynamic';

export async function GET() {
  const results = await Promise.all([
    listAdminCategories(),
    listAdminProducts(),
    listAdminAddons(),
    listAdminPromotions(),
    listAdminCoupons(),
  ]);
  const [categories, products, addons, promotions, coupons] = results;

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

  return NextResponse.json({
    categories: categories.data,
    products: products.data,
    addons: addons.data,
    promotions: promotions.data,
    coupons: coupons.data,
  });
}
