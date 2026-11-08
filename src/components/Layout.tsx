import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { useAuth } from '../contexts/useAuth';
import AjudaPainel from '../ajuda/AjudaPainel';
import { telaDaRota, useTelaSobreposta } from '../ajuda/contextoAjuda';

export default function Layout() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const sobreposta = useTelaSobreposta();
  const temAjuda = profile?.role === 'admin' || profile?.role === 'escritorio';

  // F1 abre/fecha a ajuda da tela atual (no lugar da ajuda do navegador)
  useEffect(() => {
    if (!temAjuda) return;
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key !== 'F1') return;
      e.preventDefault();
      setAjudaAberta((a) => !a);
    };
    window.addEventListener('keydown', aoTecla);
    return () => window.removeEventListener('keydown', aoTecla);
  }, [temAjuda]);

  const fecharAjuda = useCallback(() => setAjudaAberta(false), []);

  return (
    <div className="flex h-screen overflow-hidden print:block print:h-auto print:overflow-visible">
      <Sidebar aberta={menuAberto} onFechar={() => setMenuAberto(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onAbrirMenu={() => setMenuAberto(true)} onAbrirAjuda={temAjuda ? () => setAjudaAberta(true) : undefined} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 print:overflow-visible print:p-0">
          <Outlet />
        </main>
      </div>
      {ajudaAberta && <AjudaPainel tela={sobreposta ?? telaDaRota(pathname)} onFechar={fecharAjuda} />}
    </div>
  );
}
