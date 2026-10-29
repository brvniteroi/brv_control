import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { listarOrdensDoCliente, type OrdemResumo } from '../../services/ordens';
import { formatarData, formatarDataHora, infoStatusOS } from '../../utils/ordens';

export default function AtendimentosCliente({ clienteId }: { clienteId: string | 'novo' }) {
  const [ordens, setOrdens] = useState<OrdemResumo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (clienteId === 'novo') return;
    let ativo = true;
    listarOrdensDoCliente(clienteId)
      .then((lista) => {
        if (ativo) setOrdens(lista);
      })
      .catch((e: unknown) => {
        console.error('Erro ao buscar atendimentos do cliente:', e);
        if (ativo) setErro('Não foi possível carregar os atendimentos deste cliente.');
      });
    return () => {
      ativo = false;
    };
  }, [clienteId]);

  return (
    <div className="mx-6 mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex items-center gap-2 text-slate-800">
        <ClipboardList size={18} className="text-blue-600" />
        <h2 className="text-base font-bold">
          Histórico de atendimentos{ordens ? ` (${ordens.length})` : ''}
        </h2>
      </div>

      {clienteId === 'novo' ? (
        <p className="mt-4 text-xs text-slate-400">Salve o cliente para ver e criar atendimentos.</p>
      ) : erro ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
      ) : ordens === null ? (
        <p className="mt-4 text-xs text-slate-400">Carregando...</p>
      ) : ordens.length === 0 ? (
        <p className="mt-4 text-xs text-slate-400">Este cliente ainda não tem ordens de serviço.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2.5">Nº</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">Situação</th>
                <th className="px-3 py-2.5">Técnico</th>
                <th className="px-3 py-2.5">Último agendamento</th>
                <th className="px-3 py-2.5">Abertura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {ordens.map((o) => {
                const info = infoStatusOS(o.status);
                const validas = o.tasks.filter((t) => t.status !== 'cancelada');
                const tecnicos = [...new Set(validas.map((t) => t.employee?.name).filter(Boolean))].join(', ');
                const datas = validas.map((t) => t.scheduled_start).filter((d): d is string => Boolean(d)).sort();
                return (
                  <tr key={o.id} className="transition hover:bg-slate-50/80">
                    <td className="px-3 py-3 font-mono font-bold">
                      <Link to={`/ordens-de-servico?os=${o.id}`} className="text-blue-600 hover:underline">
                        {o.number}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <div>{o.service_type?.name ?? '—'}</div>
                      {o.description && <div className="max-w-72 truncate text-[11px] text-slate-400">{o.description}</div>}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${info.classe}`}>
                        {info.rotulo}
                      </span>
                    </td>
                    <td className="px-3 py-3">{tecnicos || <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-3">{datas.length ? formatarDataHora(datas[datas.length - 1]) : '—'}</td>
                    <td className="px-3 py-3 text-slate-500">{formatarData(o.opened_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
