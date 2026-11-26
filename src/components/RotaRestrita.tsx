import { Navigate, Outlet } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { podeVender } from '../utils/acessoVendas';

/** Rotas de Vendas, Orçamentos e Catálogo (`vendas`) e as só de administrador (`admin`). */
export default function RotaRestrita({ exige }: { exige: 'vendas' | 'admin' }) {
  const { profile } = useAuth();
  if (!profile) return <Navigate to="/" replace />;
  const liberado = exige === 'admin' ? profile.role === 'admin' : podeVender(profile);
  if (liberado) return <Outlet />;
  return (
    <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
        <Lock size={24} />
      </div>
      <h1 className="mt-3 text-base font-bold text-slate-800">Acesso restrito</h1>
      <p className="mt-1 max-w-sm text-xs text-slate-500">
        {exige === 'admin'
          ? 'Esta tela é só para administradores.'
          : 'Vendas, Orçamentos e Catálogo são só para vendedores. Peça ao administrador para liberar o seu acesso.'}
      </p>
    </div>
  );
}
