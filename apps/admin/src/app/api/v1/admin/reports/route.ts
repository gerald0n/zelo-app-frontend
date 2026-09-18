import { NextResponse } from 'next/server';
import { httpStatusFor } from '@/lib/errors';
import {
  getOperationsReport,
  type ReportRange,
} from '@/modules/admin/reports';
import { getFinancialReport } from '@/modules/admin/financial-report';
import { getDashboardReport } from '@/modules/admin/dashboard-report';
import type { DashboardQuery } from '@/modules/admin/dashboard';

export const dynamic = 'force-dynamic';

function parseDashboardQuery(params: URLSearchParams): DashboardQuery | null {
  const from = params.get('from');
  const to = params.get('to');
  const prevFrom = params.get('prevFrom');
  const prevTo = params.get('prevTo');
  const bucketFrom = params.get('bucketFrom');
  const grain = params.get('grain');
  const count = Number(params.get('count'));

  if (
    !from ||
    !to ||
    !prevFrom ||
    !prevTo ||
    !bucketFrom ||
    (grain !== 'hour' && grain !== 'day') ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 60 ||
    [from, to, prevFrom, prevTo, bucketFrom].some((v) =>
      Number.isNaN(Date.parse(v)),
    )
  ) {
    return null;
  }

  return { from, to, prevFrom, prevTo, bucketFrom, grain, count };
}

function parseReportRange(params: URLSearchParams): ReportRange | null {
  const from = params.get('from');
  const to = params.get('to');

  if (
    !from ||
    !to ||
    Number.isNaN(Date.parse(from)) ||
    Number.isNaN(Date.parse(to)) ||
    Date.parse(to) <= Date.parse(from)
  ) {
    return null;
  }

  return { from, to };
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

  const range = parseReportRange(searchParams);
  if (!range) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Parâmetros inválidos.' } },
      { status: 400 },
    );
  }

  const result =
    kind === 'financial'
      ? await getFinancialReport(range)
      : await getOperationsReport(range);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusFor(result.error.code) },
    );
  }
  return NextResponse.json(result.data);
}
