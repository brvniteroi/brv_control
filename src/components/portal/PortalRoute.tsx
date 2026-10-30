import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AlertCircle, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';

/** Só entra quem tem login ativo com perfil "cliente"; equipe volta para o sistema. */
export default function PortalRoute() {
  const { session, profile, loading, profileLoading, signOut } = useAuth();
  const location = useLocation();

  if (loading || (session && profileLoading && !profile)) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F6F8]">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  if (!session) return <Navigate to="/portal/login" state={{ from: location }} replace />;
  if (profile && profile.role !== 'cliente') return <Navigate to="/" replace />;

  if (!profile || !profile.active) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6F8] p-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
            <AlertCircle size={26} />
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-900">Acesso não liberado</h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Seu acesso ao portal ainda não foi liberado. Fale com a BRV para ativá-lo.
          </p>
          <button
            type="button"
            onClick={() => signOut()}
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
