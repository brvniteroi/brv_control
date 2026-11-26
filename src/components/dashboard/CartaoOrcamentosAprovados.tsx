import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import {
  listarOrcamentosAprovadosAguardando,
  type OrcamentoAprovadoAguardando,
} from '../../services/vendas';
import { EVENTO_ORCAMENTO_APROVADO } from '../vendas/AvisoOrcamentoAprovado';
import { formatarReais } from '../../utils/dinheiro';
import { formatarDataHora } from '../../utils/ordens';

const CANAL: Record<string, string> = {
  link: 'pelo link',
  whatsapp: 'pelo WhatsApp',
  telefone: 'por telefone',
  presencial: 'pessoalmente',
  email: 'por e-mail',
};

/**
 * "Orçamentos aprovados" no Dashboard (vendedor e admin; 2026-11-25): aprovados que ainda não viraram OS nem venda,
 * para quem estava com o sistema fechado na hora do aviso. Some quando não há nenhum. Atualiza quando chega uma
 * aprovação nova (evento do `AvisoOrcamentoAprovado`).
 */
export default function CartaoOrcamentosAprovados() {
  const navigate = useNavigate();
  const [itens, setItens] = useState<OrcamentoAprovadoAguardando[]>([]);

  const carregar = useCallback(() => {
    listarOrcamentosAprovadosAguardando()
      .then(setItens)
      .catch(() => setItens([])); // sem acesso ou sem a tabela: o cartão só não aparece
  }, []);

  useEffect(() => {
    carregar();
    window.addEventListener(EVENTO_ORCAMENTO_APROVADO, carregar);
    return () => window.removeEventListener(EVENTO_ORCAMENTO_APROVADO, carregar);
  }, [carregar]);

  if (itens.length === 0) return null;

  return (
    <section aria-label="Orçamentos aprovados" className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-xs sm:p-5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <CheckCircle2 size={18} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900">Orçamentos aprovados ({itens.length})</h2>
          <p className="text-[11px] text-slate-500">Aguardando gerar a OS ou a venda</p>
        </div>
      </div>

      <ul className="mt-3 divide-y divide-slate-100">
        {itens.map((q) => (
          <li key={q.id}>
            <button
              type="button"
              onClick={() => navigate(`/orcamentos?orcamento=${q.id}`)}
              className="flex w-full items-center justify-between gap-3 px-1 py-2 text-left text-xs hover:bg-slate-50"
            >
              <span className="min-w-0">
                <span className="font-mono font-semibold text-slate-700">{q.number}</span>{' '}
                <span className="font-semibold text-slate-900">{q.customer_name}</span>
                <span className="block text-[11px] text-slate-500">
                  {q.responded_at ? formatarDataHora(q.responded_at) : ''}
                  {q.response_channel ? ` · ${CANAL[q.response_channel] ?? q.response_channel}` : ''}
                </span>
              </span>
              <span className="shrink-0 font-semibold text-slate-900 tabular-nums">{formatarReais(q.total_cents)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
