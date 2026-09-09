import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import {
  getOperationsReport,
  type ReportPeriod,
} from '@/modules/admin/reports';
import { getFinancialReport } from '@/modules/admin/financial-report';

export const dynamic = 'force-dynamic';

const PERIODS: ReportPeriod[] = ['today', '7d', '30d'];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get('period');
  const period: ReportPeriod = PERIODS.includes(raw as ReportPeriod)
    ? (raw as ReportPeriod)
    : 'today';

  const result =
    searchParams.get('kind') === 'financial'
      ? await getFinancialReport(period)
      : await getOperationsReport(period);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json(result.data);
}
