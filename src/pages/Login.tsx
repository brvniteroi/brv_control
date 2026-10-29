import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../services/supabase';
import { Eye, EyeOff, Lock, User } from 'lucide-react';

export default function Login() {
  const { session, signIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [submetendo, setSubmetendo] = useState(false);
  const [googleCarregando, setGoogleCarregando] = useState(false);

  // Redireciona para o destino original ou Dashboard
  const destino = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  if (!authLoading && session) {
    return <Navigate to={destino} replace />;
  }

  const podeContinuar = email.trim().length > 0 && password.length > 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);

    const emailTrim = email.trim();
    if (!emailTrim || !password) {
      setErro('Insira seu e-mail e senha.');
      return;
    }

    setSubmetendo(true);
    try {
      const { error } = await signIn(emailTrim, password);
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErro('E-mail ou senha incorretos.');
        } else if (error.message.includes('Email not confirmed')) {
          setErro('E-mail ainda não confirmado. Verifique sua caixa de entrada.');
        } else {
          setErro(error.message || 'Erro ao realizar login. Tente novamente.');
        }
      } else {
        navigate(destino, { replace: true });
      }
    } catch {
      setErro('Ocorreu uma falha na conexão. Verifique sua internet.');
    } finally {
      setSubmetendo(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErro(null);
    setGoogleCarregando(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${destino}`,
        },
      });
      if (error) {
        setErro('Login com Google não configurado no Supabase ou falhou. Utilize e-mail e senha.');
      }
    } catch {
      setErro('Não foi possível conectar com o Google no momento.');
    } finally {
      setGoogleCarregando(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4 sm:p-6"
      style={{
        background: 'radial-gradient(circle at 50% 25%, #0b3cb8 0%, #06216d 55%, #020d30 100%)',
      }}
    >
      {/* Card principal estilo Field Control */}
      <div className="flex w-full max-w-[850px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] md:flex-row md:rounded-3xl">
        {/* Coluna Esquerda - Apresentação */}
        <div className="flex w-full flex-col justify-between border-b border-slate-100 bg-[#F7F9FC] p-8 md:w-[45%] md:border-r md:border-b-0 md:p-10">
          <div>
            {/* Box azul padrão Field Control com a logo da BRV */}
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#1E50D8] to-[#3B82F6] p-2.5 shadow-[0_4px_16px_rgba(30,80,216,0.3)]">
              <img
                src="/logo-brv.webp"
                alt="Logo BRV"
                className="h-full w-full object-contain drop-shadow-sm"
              />
            </div>

            <h1 className="mt-5 text-lg font-bold text-slate-900 tracking-tight">
              BRV Control
            </h1>

            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              Uma plataforma com tecnologia de ponta para gerenciar suas equipes de campo e obter
              mais produtividade.
            </p>
          </div>

          <div className="mt-8 md:mt-0">
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              Termos e privacidade
            </a>
          </div>
        </div>

        {/* Coluna Direita - Formulário de Login */}
        <div className="flex w-full flex-col justify-center bg-white p-8 md:w-[55%] md:p-10">
          <h2 className="text-xl font-bold text-slate-800">Login</h2>
          <p className="mt-1 text-xs text-slate-500">
            Insira o seu e-mail e senha abaixo para continuar com o processo de login.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {erro && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700"
              >
                {erro}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-slate-700"
              >
                E-mail *
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                  <User size={18} />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Digite aqui"
                  className="block w-full rounded-lg border border-slate-200 py-2.5 pr-3 pl-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-slate-700"
              >
                Senha *
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                  <Lock size={18} />
                </div>
                <input
                  id="password"
                  type={mostrarSenha ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="block w-full rounded-lg border border-slate-200 py-2.5 pr-10 pl-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!podeContinuar || submetendo}
              className={`mt-2 flex w-full items-center justify-center rounded-lg py-2.5 text-sm font-medium transition ${
                podeContinuar && !submetendo
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {submetendo ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Entrando...</span>
                </div>
              ) : (
                'Continuar'
              )}
            </button>
          </form>

          {/* Divisor "ou" */}
          <div className="my-5 flex items-center">
            <div className="flex-1 border-t border-slate-200" />
            <span className="px-3 text-xs text-slate-400">ou</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

          {/* Botão Google */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleCarregando}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{googleCarregando ? 'Conectando...' : 'Entrar com o Google'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
