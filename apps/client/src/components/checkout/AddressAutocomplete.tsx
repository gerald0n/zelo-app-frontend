'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import {
  createPlacesSessionToken,
  fetchPlaceDetails,
  fetchPlaceSuggestions,
  hasPlacesBrowserKey,
  type PlaceSuggestion,
  type ResolvedPlace,
} from '@/modules/delivery/places';

type AddressAutocompleteProps = {
  /** Texto atual da rua (controlado pelo pai). */
  value: string;
  /** Digitação livre — o pai deve limpar lat/lng ao receber. */
  onChange: (text: string) => void;
  /** O cliente escolheu uma sugestão e o `placeId` foi resolvido. */
  onResolve: (place: ResolvedPlace) => void;
  /** Centro do viés de busca (coordenada da loja). */
  bias?: { latitude: number; longitude: number };
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  'aria-label'?: string;
};

const DEBOUNCE_MS = 300;

/** Altura mínima útil para a lista antes de valer a pena abrir para cima. */
const MIN_LIST_SPACE_PX = 152;
const LIST_MAX_PX = 288;
const LIST_MIN_PX = 112;

export function AddressAutocomplete({
  value,
  onChange,
  onResolve,
  bias,
  placeholder = 'Rua',
  className,
  inputClassName,
  'aria-label': ariaLabel,
}: AddressAutocompleteProps) {
  const enabled = hasPlacesBrowserKey();

  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [resolving, setResolving] = useState(false);

  /** `true` quando a lista abre acima do campo (teclado colando embaixo). */
  const [dropUp, setDropUp] = useState(false);
  const [listMaxPx, setListMaxPx] = useState(LIST_MAX_PX);
  /** Mensagem quando o cliente escolhe um endereço fora de Pereiro. */
  const [outsideArea, setOutsideArea] = useState(false);

  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sessionTokenRef = useRef<string>(createPlacesSessionToken());
  const abortRef = useRef<AbortController | null>(null);
  const blurTimerRef = useRef<number | null>(null);
  /** Último texto vindo de um `onResolve` — não dispara busca de novo. */
  const resolvedTextRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const query = value.trim();

    if (query.length < 3 || resolvedTextRef.current === value) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setOpen(true);
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const results = await fetchPlaceSuggestions(query, {
        sessionToken: sessionTokenRef.current,
        bias,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;
      setSuggestions(results);
      setActiveIndex(-1);
      setLoading(false);
      if (results.length > 0) setOpen(true);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [value, enabled, bias]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
    };
  }, []);

  /**
   * Decide se a lista abre para baixo ou para cima e qual a altura máxima,
   * medindo o espaço real acima/abaixo do campo. Usa `visualViewport`, que
   * encolhe quando o teclado virtual sobe (o `100vh`/`innerHeight` não).
   */
  const recalcPlacement = useCallback(() => {
    const input = containerRef.current?.querySelector('input');
    if (!input) return;
    const rect = input.getBoundingClientRect();
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    const viewTop = vv?.offsetTop ?? 0;
    const viewBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;

    const spaceBelow = viewBottom - rect.bottom - 8;
    const spaceAbove = rect.top - viewTop - 8;
    const openUp = spaceBelow < MIN_LIST_SPACE_PX && spaceAbove > spaceBelow;

    const room = openUp ? spaceAbove : spaceBelow;
    setDropUp(openUp);
    setListMaxPx(
      Math.max(LIST_MIN_PX, Math.min(LIST_MAX_PX, Math.floor(room))),
    );
  }, []);

  async function selectSuggestion(suggestion: PlaceSuggestion) {
    setOpen(false);
    setSuggestions([]);
    setOutsideArea(false);
    setResolving(true);
    const token = sessionTokenRef.current;
    const place = await fetchPlaceDetails(suggestion.placeId, token);
    // A sessão fecha após o Details — próxima busca começa uma nova.
    sessionTokenRef.current = createPlacesSessionToken();
    setResolving(false);

    if (place && !place.cityMatches) {
      // Endereço de outra cidade: sem coordenada confiável, o mapa cairia
      // num ponto aleatório de Pereiro. Recusa e limpa o campo.
      resolvedTextRef.current = null;
      setOutsideArea(true);
      onChange('');
      return;
    }

    if (place) {
      resolvedTextRef.current = place.street || suggestion.primaryText;
      onResolve(place);
    } else {
      // Details falhou: usa ao menos o texto principal da sugestão.
      resolvedTextRef.current = suggestion.primaryText;
      onChange(suggestion.primaryText);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (event.key === 'ArrowDown' && suggestions.length > 0) {
        setOpen(true);
        setActiveIndex(0);
        event.preventDefault();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(
        (index) => (index - 1 + suggestions.length) % suggestions.length,
      );
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      void selectSuggestion(suggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  const showList = enabled && open && (suggestions.length > 0 || loading);

  useEffect(() => {
    if (!showList) return;
    recalcPlacement();

    const vv = window.visualViewport;
    const onViewportChange = () => recalcPlacement();
    vv?.addEventListener('resize', onViewportChange);
    vv?.addEventListener('scroll', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      vv?.removeEventListener('resize', onViewportChange);
      vv?.removeEventListener('scroll', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [showList, suggestions.length, recalcPlacement]);

  return (
    <div ref={containerRef} className={cn('relative min-w-0', className)}>
      <div className="relative">
        <Input
          type="text"
          value={value}
          onChange={(event) => {
            resolvedTextRef.current = null;
            if (outsideArea) setOutsideArea(false);
            onChange(event.target.value);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
            // Depois que o teclado virtual sobe (~300ms), traz o campo para
            // uma posição com espaço para a lista e remede o layout.
            window.setTimeout(() => {
              containerRef.current?.scrollIntoView({
                block: 'center',
                behavior: 'smooth',
              });
              recalcPlacement();
            }, 320);
          }}
          onBlur={() => {
            blurTimerRef.current = window.setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={inputClassName}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
          }
          aria-label={ariaLabel}
          autoComplete="off"
        />
        {(loading || resolving) && (
          <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {outsideArea ? (
        <p className="mt-1 text-xs text-destructive">
          Endereço fora de Pereiro. A entrega é feita só em Pereiro-CE.
        </p>
      ) : null}

      {showList && (
        <ul
          id={listboxId}
          role="listbox"
          style={{ maxHeight: listMaxPx }}
          className={cn(
            'absolute left-0 right-0 z-30 overflow-y-auto overscroll-contain rounded-md border border-border bg-card py-1 shadow-lg',
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
        >
          {suggestions.length === 0 && loading ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              Buscando endereços…
            </li>
          ) : (
            suggestions.map((suggestion, index) => (
              <li
                key={suggestion.placeId}
                id={`${listboxId}-opt-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => {
                  // Antes do blur do input.
                  event.preventDefault();
                  void selectSuggestion(suggestion);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  'flex cursor-pointer items-start gap-2 px-3 py-2 text-sm',
                  index === activeIndex ? 'bg-accent' : 'bg-transparent',
                )}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">
                    {suggestion.primaryText}
                  </span>
                  {suggestion.secondaryText ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {suggestion.secondaryText}
                    </span>
                  ) : null}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
