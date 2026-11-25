import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import OrcamentosSicweb from '../components/clientes/OrcamentosSicweb';

/** Busca em todos os orçamentos antigos do SicWeb, inclusive os que não estão ligados a nenhum cliente (quem vende). */
export default function OrcamentosAntigos() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Orçamentos antigos</h1>
          <p className="mt-1 text-xs text-slate-500">Consulta dos orçamentos feitos no SicWeb no último ano.</p>
        </div>
        <Link
          to="/orcamentos"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft size={15} />
          Voltar aos orçamentos
        </Link>
      </div>
      <OrcamentosSicweb />
    </div>
  );
}
