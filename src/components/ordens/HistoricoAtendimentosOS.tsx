import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import AtendimentosCliente from '../clientes/AtendimentosCliente';
import OrdemDetalhes from './OrdemDetalhes';

interface HistoricoAtendimentosOSProps {
  clienteId: string;
  clienteNome: string | null;
  /** OS de onde o histórico foi aberto (fica marcada; clicar nela volta). */
  ordemOrigemId: string;
  ordemOrigemNumero: number;
  onVoltar: () => void;
}

/**
 * Histórico de atendimentos do cliente, por cima da OS. A OS de origem continua aberta por baixo
 * (inclusive o que não foi salvo): "Voltar" fecha só o histórico. Abrir outra OS daqui também é por
 * cima, e fechar essa OS volta para o histórico.
 */
export default function HistoricoAtendimentosOS({
  clienteId, clienteNome, ordemOrigemId, ordemOrigemNumero, onVoltar,
}: HistoricoAtendimentosOSProps) {
  const [aberta, setAberta] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  // Esc volta (só quando não há outra OS aberta por cima)
  useEffect(() => {
    if (aberta) return;
    const aoTecla = (e: KeyboardEvent) => e.key === 'Escape' && onVoltar();
    window.addEventListener('keydown', aoTecla);
    return () => window.removeEventListener('keydown', aoTecla);
  }, [aberta, onVoltar]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 pb-10">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-4 shadow-xs">
        <button
          type="button"
          onClick={onVoltar}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          <ArrowLeft size={16} /> Voltar para a OS {ordemOrigemNumero}
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-slate-900">Histórico de atendimentos</h1>
          {clienteNome && <p className="truncate text-xs text-slate-500">{clienteNome}</p>}
        </div>
      </div>

      <div className="mx-auto max-w-6xl">
        <AtendimentosCliente
          key={versao} // OS aberta daqui e salva: recarrega a lista
          clienteId={clienteId}
          ordemAtualId={ordemOrigemId}
          onAbrirOrdem={(id) => (id === ordemOrigemId ? onVoltar() : setAberta(id))}
        />
      </div>

      {aberta && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 pb-10">
          <OrdemDetalhes ordemId={aberta} onFechar={() => setAberta(null)} onSalvo={() => setVersao((v) => v + 1)} />
        </div>
      )}
    </div>
  );
}
