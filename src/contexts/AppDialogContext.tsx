'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';

export type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'destructive';
};

export type PromptOptions = {
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  minLength?: number;
};

export type AlertOptions = {
  title: string;
  description?: string;
  body?: string;
  confirmLabel?: string;
};

type DialogRequest =
  | {
      kind: 'confirm';
      options: ConfirmOptions;
      resolve: (value: boolean) => void;
    }
  | {
      kind: 'prompt';
      options: PromptOptions;
      resolve: (value: string | null) => void;
    }
  | {
      kind: 'alert';
      options: AlertOptions;
      resolve: () => void;
    };

type AppDialogContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
  alert: (options: AlertOptions) => Promise<void>;
};

const AppDialogContext = createContext<AppDialogContextValue | null>(null);

function AppDialogModal({
  request,
  onClose,
}: {
  request: DialogRequest;
  onClose: () => void;
}) {
  const [promptValue, setPromptValue] = useState(
    request.kind === 'prompt' ? (request.options.defaultValue ?? '') : '',
  );
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, [request]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (request.kind === 'confirm') request.resolve(false);
        if (request.kind === 'prompt') request.resolve(null);
        if (request.kind === 'alert') request.resolve();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [request, onClose]);

  const title =
    request.kind === 'confirm'
      ? request.options.title
      : request.kind === 'prompt'
        ? request.options.title
        : request.options.title;

  const description =
    request.kind === 'confirm'
      ? request.options.description
      : request.kind === 'prompt'
        ? request.options.description
        : request.options.description;

  const confirmLabel =
    request.kind === 'confirm'
      ? (request.options.confirmLabel ?? 'Confirmar')
      : request.kind === 'prompt'
        ? (request.options.confirmLabel ?? 'Confirmar')
        : (request.options.confirmLabel ?? 'Entendi');

  const cancelLabel =
    request.kind === 'confirm'
      ? (request.options.cancelLabel ?? 'Cancelar')
      : request.kind === 'prompt'
        ? (request.options.cancelLabel ?? 'Cancelar')
        : undefined;

  const destructive =
    request.kind === 'confirm' && request.options.tone === 'destructive';

  const promptMinLength =
    request.kind === 'prompt' ? (request.options.minLength ?? 1) : 0;
  const promptValid =
    request.kind !== 'prompt' ||
    promptValue.trim().length >= promptMinLength;

  const handleConfirm = () => {
    if (request.kind === 'confirm') request.resolve(true);
    if (request.kind === 'prompt') {
      if (!promptValid) return;
      request.resolve(promptValue.trim());
    }
    if (request.kind === 'alert') request.resolve();
    onClose();
  };

  const handleCancel = () => {
    if (request.kind === 'confirm') request.resolve(false);
    if (request.kind === 'prompt') request.resolve(null);
    if (request.kind === 'alert') request.resolve();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={handleCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="app-dialog-title" className="text-lg font-semibold">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm leading-5 text-muted-foreground">
            {description}
          </p>
        ) : null}

        {request.kind === 'alert' && request.options.body ? (
          <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs leading-5 text-foreground">
            {request.options.body}
          </pre>
        ) : null}

        {request.kind === 'prompt' ? (
          <Textarea
            value={promptValue}
            onChange={(event) => setPromptValue(event.target.value)}
            placeholder={request.options.placeholder}
            rows={3}
            className="mt-3 w-full resize-none rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        ) : null}

        <div
          className={cn(
            'mt-5 flex gap-2.5',
            request.kind === 'alert' ? 'justify-stretch' : '',
          )}
        >
          {request.kind !== 'alert' ? (
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 rounded-md border border-border bg-background py-3 text-sm font-semibold text-foreground"
            >
              {cancelLabel}
            </button>
          ) : null}
          <button
            ref={confirmRef}
            type="button"
            disabled={!promptValid}
            onClick={handleConfirm}
            className={cn(
              'rounded-md py-3 text-sm font-semibold text-white',
              request.kind === 'alert' ? 'w-full' : 'flex-1',
              destructive ? 'bg-destructive' : 'bg-primary',
              !promptValid && 'opacity-50',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppDialogProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const queueRef = useRef<DialogRequest[]>([]);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        queueRef.current.push({
          kind: 'confirm',
          options,
          resolve,
        });
        setRequest((current) => current ?? queueRef.current.shift() ?? null);
      }),
    [],
  );

  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        queueRef.current.push({
          kind: 'prompt',
          options,
          resolve,
        });
        setRequest((current) => current ?? queueRef.current.shift() ?? null);
      }),
    [],
  );

  const alert = useCallback(
    (options: AlertOptions) =>
      new Promise<void>((resolve) => {
        queueRef.current.push({
          kind: 'alert',
          options,
          resolve,
        });
        setRequest((current) => current ?? queueRef.current.shift() ?? null);
      }),
    [],
  );

  const contextValue = useMemo(
    () => ({ confirm, prompt, alert }),
    [confirm, prompt, alert],
  );

  return (
    <AppDialogContext.Provider value={contextValue}>
      {children}
      {request ? (
        <AppDialogModal
          request={request}
          onClose={() => {
            setRequest(null);
            window.setTimeout(() => {
              setRequest((current) => current ?? queueRef.current.shift() ?? null);
            }, 0);
          }}
        />
      ) : null}
    </AppDialogContext.Provider>
  );
}

export function useAppDialog() {
  const context = useContext(AppDialogContext);
  if (!context) {
    throw new Error('useAppDialog must be used within AppDialogProvider');
  }
  return context;
}
