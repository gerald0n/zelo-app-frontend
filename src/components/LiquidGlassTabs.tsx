'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState, type ComponentType } from 'react';
import { cn } from '@/lib/utils';

export type LiquidGlassTab = {
  href: string;
  label: string;
  icon: ComponentType<{
    className?: string;
    strokeWidth?: number;
    'aria-hidden'?: boolean | 'true' | 'false';
  }>;
  match: (pathname: string) => boolean;
};

type Props = {
  tabs: LiquidGlassTab[];
  pathname: string;
  className?: string;
  itemClassName?: string;
  labelClassName?: string;
};

export default function LiquidGlassTabs({
  tabs,
  pathname,
  className,
  itemClassName,
  labelClassName,
}: Props) {
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [bubble, setBubble] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
  const [animate, setAnimate] = useState(false);

  const activeIndex = tabs.findIndex((tab) => tab.match(pathname));

  useLayoutEffect(() => {
    const list = listRef.current;
    const item = itemRefs.current[activeIndex];
    if (!list || !item || activeIndex < 0) return;

    const update = () => {
      const listRect = list.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      setBubble({
        left: itemRect.left - listRect.left,
        top: itemRect.top - listRect.top,
        width: itemRect.width,
        height: itemRect.height,
      });
    };

    update();
    const frame = requestAnimationFrame(() => setAnimate(true));

    const observer = new ResizeObserver(update);
    observer.observe(list);
    observer.observe(item);
    window.addEventListener('resize', update);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [activeIndex]);

  return (
    <ul
      ref={listRef}
      className={cn(
        'liquid-glass relative mx-auto flex items-stretch gap-0.5 rounded-2xl p-1',
        className,
      )}
    >
      {activeIndex >= 0 && bubble.width > 0 ? (
        <span
          aria-hidden
          className={cn(
            'liquid-glass-bubble pointer-events-none absolute left-0 top-0 z-0 rounded-xl',
            animate && 'liquid-glass-bubble-animate',
          )}
          style={{
            width: bubble.width,
            height: bubble.height,
            transform: `translate3d(${bubble.left}px, ${bubble.top}px, 0)`,
          }}
        />
      ) : null}

      {tabs.map((tab, index) => {
        const active = tab.match(pathname);
        const Icon = tab.icon;
        return (
          <li
            key={tab.href}
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
            className="relative z-10 flex flex-1"
          >
            <Link
              href={tab.href}
              className={cn(
                'liquid-glass-item flex w-full flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1.5',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground active:scale-[0.97]',
                itemClassName,
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                className="size-5"
                strokeWidth={active ? 2.35 : 1.85}
                aria-hidden="true"
              />
              <span
                className={cn(
                  'text-2xs tracking-wide',
                  active ? 'font-semibold' : 'font-medium',
                  labelClassName,
                )}
              >
                {tab.label}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
