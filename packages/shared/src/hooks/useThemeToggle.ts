'use client';

import { useCallback, useEffect } from 'react';
import { useUiPref } from '@/hooks/useUiPref';

const STORAGE_KEY = 'zelo:theme';

/**
 * Alterna claro/escuro pela classe `.dark` no `<html>` e persiste a escolha.
 * O único effect apenas sincroniza a classe do DOM com o estado — sem
 * `setState` em effect (o valor salvo vem do `useUiPref`).
 */
export function useThemeToggle() {
  const [raw, setRaw] = useUiPref(STORAGE_KEY, 'light');
  const theme: 'light' | 'dark' = raw === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggle = useCallback(() => {
    setRaw(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setRaw]);

  return { theme, toggle };
}
