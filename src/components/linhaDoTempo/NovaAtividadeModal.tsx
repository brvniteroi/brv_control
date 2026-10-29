import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { listarOrdens, listarTipos, salvarAtividade, type OrdemResumo } from '../../services/ordens';
import type { TecnicoLinha } from '../../services/linhaDoTempo';
import { deCamposDataHora } from '../../utils/ordens';
import { DURACAO_PADRAO_MIN } from './janela';

interface Props {
  dia: string;
  tecnicos: TecnicoLinha[];
  aoFechar: () => void;
  aoSalvo: () => void;
}

const CAMPO =
  'block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

export default function NovaAtividadeModal({ dia, tecnicos, aoFechar, aoSalvo }: Props) {
  const [termo, setTermo] = useState('');
  const [encontradas, setResultados] = useState<OrdemResumo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [ordem, setOrdem] = useState<OrdemResumo | null>(null);
  const buscaValida = !ordem && termo.trim().length >= 2;
  const resultados = buscaValida ? encontradas : [];
  const [duracoes, setDuracoes] = useState<Record<string, number>>({});

  const [titulo, setTitulo] = useState('');
  const [tecnicoId, setTecnicoId] = useState('');
  const [data, setData] = useState(dia);
  const [hora, setHora] = useState('');
  const [duracao, setDuracao] = useState(String(DURACAO_PADRAO_MIN));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarTipos()
      .then((tipos) =>
        setDuracoes(Object.fromEntries(tipos.filter((t) => t.default_duration_minutes).map((t) => [t.id, t.default_duration_minutes!]))),
      )
      .catch(() => {}); // sem a duração padrão, vale 60 min
  }, []);

  // Busca de OS (só as que ainda estão em andamento)
  useEffect(() => {
    if (ordem || termo.trim().length < 2) return;
    let ativo = true;
    const timer = setTimeout(() => {
      setBuscando(true);
      listarOrdens({ termo: termo.trim(), status: '', tipoId: '' }, 0)
        .then((r) => {
          if (ativo) setResultados(r.itens.filter((o) => o.status !== 'concluida' && o.status !== 'cancelada').slice(0, 8));
        })
        .catch(() => {
          if (ativo) setResultados([]);
        })
        .finally(() => {
          if (ativo) setBuscando(false);
        });
    }, 300);
    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [termo, ordem]);

  const escolherOrdem = (o: OrdemResumo) => {
    setOrdem(o);
    setTitulo(o.service_type?.name ?? '');
    setDuracao(String((o.service_type && duracoes[o.service_type.id]) || DURACAO_PADRAO_MIN));
  };

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!ordem) return setErro('Escolha a OS desta atividade.');
    if (!titulo.trim()) return setErro('Informe o título da atividade.');
    const minutos = Number(duracao);
    if (hora && (!tecnicoId || !data)) return setErro('Para marcar horário, escolha o técnico e a data.');
    if (hora && (!Number.isFinite(minutos) || minutos < 15)) return setErro('A duração deve ser de pelo menos 15 minutos.');

    const inicio = hora ? deCamposDataHora(data, hora) : null;
    const fim = inicio ? new Date(new Date(inicio).getTime() + minutos * 60000).toISOString() : null;

    setSalvando(true);
    try {
      await salvarAtividade({
        service_order_id: ordem.id,
        employee_id: tecnicoId || null,
        title: titulo,
        description: '',
        status: inicio && tecnicoId ? 'agendada' : 'pendente',
        scheduled_start: inicio,
        scheduled_end: fim,
        technician_notes: '',
      });
      aoSalvo();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar a atividade.');
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={salvar} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Nova atividade</h2>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {erro && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</div>}

        <div>
          <label className="block text-xs font-semibold text-slate-700">Ordem de serviço *</label>
          {ordem ? (
            <div className="mt-1.5 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                <b>OS {ordem.number}</b> · {ordem.customer?.name}
              </span>
              <button type="button" onClick={() => setOrdem(null)} className="ml-2 shrink-0 text-xs font-semibold text-blue-600 hover:underline">
                Trocar
              </button>
            </div>
          ) : (
            <div className="relative mt-1.5">
              <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                placeholder="Número da OS ou nome do cliente"
                className={`${CAMPO} pl-9`}
              />
              {buscaValida && (
                <ul className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white text-sm shadow-sm">
                  {buscando && (
                    <li className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
                      <Loader2 size={13} className="animate-spin" /> Buscando...
                    </li>
                  )}
                  {!buscando && resultados.length === 0 && (
                    <li className="px-3 py-2 text-xs text-slate-500">Nenhuma OS em andamento encontrada.</li>
                  )}
                  {resultados.map((o) => (
                    <li key={o.id}>
                      <button type="button" onClick={() => escolherOrdem(o)} className="block w-full px-3 py-2 text-left hover:bg-slate-50">
                        <b>OS {o.number}</b> · {o.customer?.name}
                        <span className="ml-1 text-xs text-slate-500">{o.service_type?.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="na-titulo" className="block text-xs font-semibold text-slate-700">Título *</label>
          <input id="na-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} className={`${CAMPO} mt-1.5`} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label htmlFor="na-tec" className="block text-xs font-semibold text-slate-700">Técnico</label>
            <select id="na-tec" value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)} className={`${CAMPO} mt-1.5`}>
              <option value="">Definir depois</option>
              {tecnicos.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="na-data" className="block text-xs font-semibold text-slate-700">Data</label>
            <input id="na-data" type="date" value={data} onChange={(e) => setData(e.target.value)} className={`${CAMPO} mt-1.5`} />
          </div>
          <div>
            <label htmlFor="na-hora" className="block text-xs font-semibold text-slate-700">Hora de início</label>
            <input id="na-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={`${CAMPO} mt-1.5`} />
          </div>
          <div>
            <label htmlFor="na-dur" className="block text-xs font-semibold text-slate-700">Duração (min)</label>
            <input id="na-dur" type="number" min={15} step={15} value={duracao} onChange={(e) => setDuracao(e.target.value)} className={`${CAMPO} mt-1.5`} />
          </div>
        </div>
        <p className="text-[11px] text-slate-500">Sem técnico e hora, a atividade entra na fila "A agendar".</p>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={aoFechar} disabled={salvando} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button type="submit" disabled={salvando} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {salvando && <Loader2 size={13} className="animate-spin" />}
            Criar atividade
          </button>
        </div>
      </form>
    </div>
  );
}
