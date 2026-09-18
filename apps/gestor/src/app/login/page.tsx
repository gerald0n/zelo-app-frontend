'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useGestorAuth } from '@/contexts/GestorAuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const loginSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(8, 'Senha inválida.'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function GestorLoginPage() {
  const router = useRouter();
  const { login } = useGestorAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [redirecting, setRedirecting] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = form.handleSubmit(async (values) => {
    setError('');
    try {
      const result = await login(values.email, values.password);
      if (result.ok) {
        setRedirecting(true);
        router.replace('/lojas');
      } else {
        setError(result.message);
      }
    } catch {
      setError('Falha de rede ao entrar.');
    }
  });

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-[420px]">
        <div className="mb-5">
          <span className="text-2xl font-bold tracking-tight">Gestor</span>
          <p className="mt-1 text-sm text-muted-foreground">
            Acesso restrito a administradores da plataforma.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              E-mail
            </Label>
            <Input
              autoCapitalize="none"
              type="email"
              {...form.register('email')}
              className="h-10 w-full rounded-md border border-border px-3 text-base outline-none focus:border-primary"
            />
            {form.formState.errors.email ? (
              <p className="mt-1 text-xs text-destructive">
                {form.formState.errors.email.message}
              </p>
            ) : null}
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Senha
            </Label>
            <div className="flex h-10 items-center rounded-md border border-border px-3">
              <Input
                type={showPassword ? 'text' : 'password'}
                {...form.register('password')}
                className="h-full flex-1 border-none bg-transparent p-0 text-base shadow-none outline-none focus-visible:ring-0"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? (
                  <EyeOff className="size-5 text-muted-foreground" />
                ) : (
                  <Eye className="size-5 text-muted-foreground" />
                )}
              </button>
            </div>
            {form.formState.errors.password ? (
              <p className="mt-1 text-xs text-destructive">
                {form.formState.errors.password.message}
              </p>
            ) : null}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <button
            type="submit"
            disabled={form.formState.isSubmitting || redirecting}
            className="flex h-11 w-full items-center justify-center rounded-md bg-primary text-sm font-semibold text-white disabled:opacity-60"
          >
            {form.formState.isSubmitting || redirecting ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              'Entrar'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
