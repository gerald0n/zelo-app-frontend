import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import {
  getOperationsReport,
  type ReportPeriod,
} from '@/modules/admin/reports';
import { getFinancialReport } from '@/modules/admin/financial-report';
import { getDashboardReport } from '@/modules/admin/dashboard-report';
import type { DashboardQuery } from '@/modules/admin/dashboard';

export const dynamic = 'force-dynamic';

const PERIODS: ReportPeriod[] = ['today', '7d', '30d'];

function parseDashboardQuery(params: URLSearchParams): DashboardQuery | null {
  const from = params.get('from');
  const prevFrom = params.get('prevFrom');
  const prevTo = params.get('prevTo');
  const bucketFrom = params.get('bucketFrom');
  const grain = params.get('grain');
  const count = Number(params.get('count'));

  if (
    !from ||
    !prevFrom ||
    !prevTo ||
    !bucketFrom ||
    (grain !== 'hour' && grain !== 'day') ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 60 ||
    [from, prevFrom, prevTo, bucketFrom].some((v) =>
      Number.isNaN(Date.parse(v)),
    )
  ) {
    return null;
  }

  return { from, prevFrom, prevTo, bucketFrom, grain, count };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get('kind');

  if (kind === 'dashboard') {
    const query = parseDashboardQuery(searchParams);
    if (!query) {
      return NextResponse.json(
        {
          error: { code: 'VALIDATION_ERROR', message: 'Parâmetros inválidos.' },
        },
        { status: 400 },
      );
    }
    const result = await getDashboardReport(query);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: httpStatusFor(result.error.code) },
      );
    }
    return NextResponse.json(result.data);
  }

  const raw = searchParams.get('period');
  const period: ReportPeriod = PERIODS.includes(raw as ReportPeriod)
    ? (raw as ReportPeriod)
    : 'today';

  const result =
    kind === 'financial'
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
