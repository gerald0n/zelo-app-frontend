import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PublicTestimonial } from '@/modules/reviews/types';

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            'size-3.5',
            n <= value
              ? 'fill-amber-400 text-amber-400'
              : 'fill-transparent text-muted-foreground/30',
          )}
        />
      ))}
    </div>
  );
}

/**
 * Vitrine de depoimentos (avaliações aprovadas + em destaque). Não renderiza
 * nada quando ainda não há nenhum — melhor do que uma seção vazia.
 */
export function Testimonials({
  testimonials,
  className,
}: {
  testimonials: PublicTestimonial[];
  className?: string;
}) {
  if (testimonials.length === 0) return null;

  return (
    <section
      className={cn('px-4 pt-2 pb-6', className)}
      aria-labelledby="testimonials-heading"
    >
      <h3
        id="testimonials-heading"
        className="font-serif text-lg font-semibold text-foreground"
      >
        O que dizem sobre a Zelo
      </h3>
      <ul className="mt-2.5 flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-3">
        {testimonials.map((t) => (
          <li
            key={t.id}
            className="rounded-xl border border-border bg-card p-3.5"
          >
            <Stars value={t.rating} />
            <p className="mt-1.5 text-sm text-card-foreground">“{t.comment}”</p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t.displayName}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
