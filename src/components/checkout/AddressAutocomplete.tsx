'use client';

import { useEffect, useId, useRef, useState } from 'react';
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

  const listboxId = useId();
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

  async function selectSuggestion(suggestion: PlaceSuggestion) {
    setOpen(false);
    setSuggestions([]);
    setResolving(true);
    const token = sessionTokenRef.current;
    const place = await fetchPlaceDetails(suggestion.placeId, token);
    // A sessão fecha após o Details — próxima busca começa uma nova.
    sessionTokenRef.current = createPlacesSessionToken();
    setResolving(false);

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

  return (
    <div className={cn('relative min-w-0', className)}>
      <div className="relative">
        <Input
          type="text"
          value={value}
          onChange={(event) => {
            resolvedTextRef.current = null;
            onChange(event.target.value);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onBlur={() => {
            blurTimerRef.current = window.setTimeout(
              () => setOpen(false),
              120,
            );
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

      {showList && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-card py-1 shadow-lg"
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
