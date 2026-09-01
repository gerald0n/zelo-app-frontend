'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  checkoutDesktopContainerClass,
  pageHeaderBarClass,
} from '@/lib/layout';

export function AccountPageHeader({
  title,
  backHref = '/conta',
}: {
  title: string;
  backHref?: string;
}) {
  return (
    <header
      className={cn(
        pageHeaderBarClass,
        checkoutDesktopContainerClass,
      )}
    >
      <Link href={backHref} aria-label="Voltar">
        <ArrowLeft className="size-6" />
      </Link>
      <h1 className="text-lg font-semibold">{title}</h1>
      <span className="size-6" aria-hidden />
    </header>
  );
}
