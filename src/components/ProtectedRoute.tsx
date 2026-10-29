import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { AlertCircle, LogOut, RefreshCw } from 'lucide-react';

export default function ProtectedRoute() {
  const { session, profile, loading, profileLoading, signOut, refreshProfile } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        className="flex h-screen w-full items-center justify-center p-4"
        style={{
          background: 'radial-gradient(circle at 50% 25%, #0b3cb8 0%, #06216d 55%, #020d30 100%)',
        }}
      >
        <div className="flex flex-col items-center gap-3 text-white">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
          <span className="text-sm font-medium">Carregando BRV Control...</span>
        </div>
      </div>
    );
  }

  // Não logado: redireciona para login
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Logado mas perfil ainda buscando
  if (profileLoading && !profile) {
    return (
      <div
        className="flex h-screen w-full items-center justify-center p-4"
        style={{
          background: 'radial-gradient(circle at 50% 25%, #0b3cb8 0%, #06216d 55%, #020d30 100%)',
        }}
      >
        <div className="flex flex-col items-center gap-3 text-white">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
          <span className="text-sm font-medium">Validando permissões...</span>
        </div>
      </div>
    );
  }

  // Usuário inativo no profiles (active = false)
  if (profile && !profile.active) {
    return (
      <div
        className="flex min-h-screen items-center justify-center p-4 sm:p-6"
        style={{
          background: 'radial-gradient(circle at 50% 25%, #0b3cb8 0%, #06216d 55%, #020d30 100%)',
        }}
      >
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
            <AlertCircle size={28} />
          </div>
          <div className="mt-4 text-center">
            <h2 className="text-xl font-bold text-slate-900">Acesso Pendente</h2>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Sua conta (<span className="font-semibold text-slate-800">{profile.email}</span>) foi criada,
              mas ainda aguarda ativação pelo administrador do sistema.
            </p>
          </div>

          <div className="mt-7 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => refreshProfile()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              <RefreshCw size={16} />
              Verificar novamente
            </button>
            <button
              type="button"
              onClick={() => signOut()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <LogOut size={16} />
              Sair da conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
