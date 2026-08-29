import { NextResponse } from 'next/server';
import { httpStatusFor, publicErrorBody, type AppError } from '@/lib/errors';

export function jsonError(error: AppError): NextResponse {
  return NextResponse.json(publicErrorBody(error), {
    status: httpStatusFor(error.code),
  });
}
