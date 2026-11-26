import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, X } from 'lucide-react';
import { supabase } from '../../services/supabase';
import type { OrcamentoAprovadoAguardando } from '../../services/vendas';
import { tocarAlerta } from '../../services/avisosCampo';
import { formatarReais } from '../../utils/dinheiro';

/** Disparado quando chega uma aprovação: o cartão do Dashboard se atualiza. */
export const EVENTO_ORCAMENTO_APROVADO = 'brv:orcamento-aprovado';

/** Aprovação mais velha que isso não avisa (ex.: a conexão voltou depois de muito tempo). */
const AVISA_ATE_MS = 15 * 60 * 1000;

function horaCurta(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Aviso de orçamento aprovado pelo cliente (pedido do Braulio, 2026-11-25): quando o cliente aprova pelo link,
 * quem está com o sistema aberto (vendedor ou admin, montado no `Layout`) vê um aviso no canto da tela, em qualquer
 * página, com bipe, até fechar. Vem pelo Realtime da tabela `quotes` (migration 20261125200000); a RLS só entrega a
 * quem pode vender. Aprovação registrada pelo escritório ("Registrar resposta") não avisa: quem registrou já sabe.
 * Quem estava com o sistema fechado vê no cartão "Orçamentos aprovados" do Dashboard.
 */
export default function AvisoOrcamentoAprovado() {
  const navigate = useNavigate();
  const [avisos, setAvisos] = useState<OrcamentoAprovadoAguardando[]>([]);
  const avisados = useRef(new Set<string>());

  useEffect(() => {
    const canal = supabase
      .channel('orcamentos-aprovados')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'quotes', filter: 'status=eq.aprovado' },
        (payload) => {
          const q = payload.new as OrcamentoAprovadoAguardando & {
            converted_sale_id: string | null;
            converted_service_order_id: string | null;
          };
          if (q.response_channel !== 'link' || !q.responded_at) return;
          if (q.converted_sale_id || q.converted_service_order_id) return;
          if (Date.now() - new Date(q.responded_at).getTime() > AVISA_ATE_MS) return;
          const chave = `${q.id}:${q.responded_at}`;
          if (avisados.current.has(chave)) return;
          avisados.current.add(chave);

          setAvisos((atuais) => [
            {
              id: q.id,
              number: q.number,
              customer_name: q.customer_name,
              total_cents: Number(q.total_cents),
              responded_at: q.responded_at,
              responded_by_name: q.responded_by_name,
              response_channel: q.response_channel,
            },
            ...atuais.filter((a) => a.id !== q.id),
          ]);
          tocarAlerta();
          window.dispatchEvent(new CustomEvent(EVENTO_ORCAMENTO_APROVADO));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, []);

  // Com a aba em segundo plano, o título da aba também avisa
  useEffect(() => {
    if (avisos.length === 0) return;
    const original = document.title;
    document.title = `(${avisos.length}) Orçamento aprovado · ${original}`;
    return () => {
      document.title = original;
    };
  }, [avisos.length]);

  if (avisos.length === 0) return null;

  const fechar = (id: string) => setAvisos((atuais) => atuais.filter((a) => a.id !== id));

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 bottom-4 z-40 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 print:hidden"
    >
      {avisos.map((a) => (
        <div key={a.id} className="rounded-xl border border-emerald-200 bg-white p-3.5 shadow-sm">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">Orçamento aprovado</p>
              <p className="mt-0.5 truncate text-xs text-slate-700">
                {a.number} · {a.customer_name} · <strong>{formatarReais(a.total_cents)}</strong>
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Aprovado por {a.responded_by_name ?? 'cliente'} pelo link às {horaCurta(a.responded_at)}
              </p>
              <button
                type="button"
                onClick={() => {
                  fechar(a.id);
                  navigate(`/orcamentos?orcamento=${a.id}`);
                }}
                className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Abrir orçamento
              </button>
            </div>
            <button
              type="button"
              onClick={() => fechar(a.id)}
              aria-label="Fechar aviso"
              className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
