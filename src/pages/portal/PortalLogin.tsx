import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';

export default function PortalLogin() {
  const { session, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Já logado: o PortalRoute encaminha cada perfil para o lugar certo
  if (!loading && session) return <Navigate to="/portal" replace />;

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const { error } = await signIn(email.trim(), senha);
      if (error) {
        setErro(
          error.message.includes('Invalid login credentials')
            ? 'E-mail ou senha incorretos.'
            : 'Não foi possível entrar. Tente novamente.',
        );
      }
    } catch {
      setErro('Falha na conexão. Verifique sua internet.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F6F8] p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 p-1.5">
            <img src="/logo-brv.webp" alt="BRV" className="h-full w-full object-contain" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">Portal do Cliente</h1>
            <p className="text-xs text-slate-500">BRV Niterói</p>
          </div>
        </div>

        <form onSubmit={entrar} className="mt-7 space-y-4">
          {erro && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {erro}
            </div>
          )}

          <div>
            <label htmlFor="portal-email" className="block text-xs font-medium text-slate-700">E-mail</label>
            <div className="relative mt-1">
              <Mail size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-blue-600" />
              <input
                id="portal-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-lg border border-slate-200 py-2.5 pr-3 pl-10 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="portal-senha" className="block text-xs font-medium text-slate-700">Senha</label>
            <div className="relative mt-1">
              <Lock size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-blue-600" />
              <input
                id="portal-senha"
                type={mostrarSenha ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="block w-full rounded-lg border border-slate-200 py-2.5 pr-10 pl-10 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Exibir senha'}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={enviando || !email.trim() || !senha}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {enviando && <Loader2 size={15} className="animate-spin" />}
            Entrar
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-slate-400">
          Não tem acesso? Peça à BRV para liberar o seu login.
        </p>
      </div>
    </div>
  );
}
