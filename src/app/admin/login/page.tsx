'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Eye, EyeOff, Loader2 } from 'lucide-react';
import { ADMIN_EMAIL, ADMIN_MIN_PASSWORD_LENGTH } from '@/config/admin';
import { useAdmin } from '@/contexts/AdminContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { BotTrap } from '@/components/BotTrap';

const loginSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z
    .string()
    .min(ADMIN_MIN_PASSWORD_LENGTH, 'Senha inválida.'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAdmin();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  // Fica true no sucesso e não volta: mantém o botão em loading até o
  // /admin carregar (senão `isSubmitting` zera e o botão "pisca").
  const [redirecting, setRedirecting] = useState(false);
  const [website, setWebsite] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const onCaptchaToken = useCallback((token: string) => {
    setCaptchaToken(token);
  }, []);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: ADMIN_EMAIL,
      password: '',
    },
  });

  const submit = form.handleSubmit(async (values) => {
    setError('');
    try {
      const result = await login(values.email, values.password, {
        captchaToken,
        website,
      });
      if (result.ok) {
        setRedirecting(true);
        router.replace('/admin');
      } else {
        setError(result.message);
      }
    } catch {
      setError('Falha de rede ao entrar.');
    }
  });

  return (
    <div className="flex min-h-dvh flex-col bg-background px-4 pb-5 pt-4">
      <Link
        href="/"
        aria-label="Voltar ao cardápio"
        className="flex size-[42px] items-center justify-center self-end"
      >
        <X className="size-6" />
      </Link>

      <div className="mx-auto my-auto w-full max-w-[420px]">
        <div className="mb-5 flex items-center gap-2">
          <span className="text-2xl font-bold tracking-tight">Zelo</span>
          <Badge className="rounded-md px-2 py-1 text-2xs font-bold tracking-widest">
            ADMIN
          </Badge>
        </div>
        <h1 className="text-xl font-bold tracking-tight">
          Painel da confeitaria
        </h1>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          Acompanhe pedidos e gerencie a operação da loja.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">E-mail</Label>
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
            <Label className="mb-1.5 block text-xs font-semibold">Senha</Label>
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

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          <div className="relative">
            <BotTrap
              website={website}
              onWebsiteChange={setWebsite}
              onCaptchaToken={onCaptchaToken}
            />
          </div>

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
