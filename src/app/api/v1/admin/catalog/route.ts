import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import {
  listAdminAddons,
  listAdminCategories,
  listAdminProducts,
} from '@/modules/admin/catalog';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [categories, products, addons] = await Promise.all([
    listAdminCategories(),
    listAdminProducts(),
    listAdminAddons(),
  ]);

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

  return NextResponse.json({
    categories: categories.data,
    products: products.data,
    addons: addons.data,
  });
}
