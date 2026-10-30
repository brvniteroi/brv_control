import { useEffect, useState } from 'react';
import { FileText, KeyRound, ListChecks, LogOut, PlusCircle } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { buscarMeuCliente, type PortalCliente } from '../../services/portal';
import AlterarSenhaModal from '../../components/AlterarSenhaModal';
import ChamadosTab from '../../components/portal/ChamadosTab';
import NovoChamadoTab from '../../components/portal/NovoChamadoTab';
import DocumentosTab from '../../components/portal/DocumentosTab';

type Aba = 'chamados' | 'novo' | 'documentos';

const ABAS: { id: Aba; rotulo: string; icone: typeof ListChecks }[] = [
  { id: 'chamados', rotulo: 'Meus Chamados', icone: ListChecks },
  { id: 'novo', rotulo: 'Abrir Novo Chamado', icone: PlusCircle },
  { id: 'documentos', rotulo: 'Documentos / Laudos', icone: FileText },
];

export default function PortalHome() {
  const { signOut } = useAuth();
  const [aba, setAba] = useState<Aba>('chamados');
  const [cliente, setCliente] = useState<PortalCliente | null | undefined>(undefined);
  const [alterandoSenha, setAlterandoSenha] = useState(false);

  useEffect(() => {
    buscarMeuCliente()
      .then(setCliente)
      .catch(() => setCliente(null));
  }, []);

  return (
    <div className="min-h-screen bg-[#F4F6F8]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 p-1.5">
              <img src="/logo-brv.webp" alt="BRV" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-slate-900">Portal do Cliente</h1>
              <p className="truncate text-xs text-slate-500">{cliente?.name ?? ' '}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setAlterandoSenha(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <KeyRound size={14} /> <span className="hidden sm:inline">Senha</span>
            </button>
            <button
              type="button"
              onClick={() => signOut()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <LogOut size={14} /> <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4" aria-label="Seções do portal">
          {ABAS.map(({ id, rotulo, icone: Icone }) => (
            <button
              key={id}
              type="button"
              onClick={() => setAba(id)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                aba === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icone size={16} /> {rotulo}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {cliente === null ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-800">
            Seu login ainda não está ligado a um cliente. Fale com a BRV.
          </p>
        ) : (
          <>
            {aba === 'chamados' && <ChamadosTab />}
            {aba === 'novo' && <NovoChamadoTab aoAbrir={() => setAba('chamados')} />}
            {aba === 'documentos' && <DocumentosTab clienteNome={cliente?.name ?? ''} />}
          </>
        )}
      </main>

      {alterandoSenha && <AlterarSenhaModal onFechar={() => setAlterandoSenha(false)} />}
    </div>
  );
}
