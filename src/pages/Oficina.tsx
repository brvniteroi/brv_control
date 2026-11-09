import { useCallback, useMemo, useState } from 'react';
import {
  AlertCircle,
  Kanban,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Wrench,
  X,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { mapaTotaisPorOs } from '../components/oficina/cores';
import EtiquetaModal from '../components/oficina/EtiquetaModal';
import ItemOficinaDetalhes from '../components/oficina/ItemOficinaDetalhes';
import KanbanOficina from '../components/oficina/KanbanOficina';
import ListaFinalizadosOficina from '../components/oficina/ListaFinalizadosOficina';
import NovaEntradaModal from '../components/oficina/NovaEntradaModal';
import { IndicadorElgin, MenuImpressoraCabecalho } from '../components/oficina/SituacaoElgin';
import { useAuth } from '../contexts/useAuth';
import { useItensOficina, useSituacaoImpressora } from '../hooks/useOficina';
import { mudarEtapa, receberItem } from '../services/oficina';
import type { EtapaOficina, ItemOficinaTela } from '../types/oficina';
import { numeroItem } from '../utils/oficina';

type AbaOficina = 'andamento' | 'finalizados';
type EtapaKanban = Exclude<EtapaOficina, 'entregue' | 'descarte' | 'cancelado'>;

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export default function Oficina() {
  const { profile } = useAuth();
  const papel = profile?.role;
  const ehEscritorio = papel === 'admin' || papel === 'escritorio';

  const [searchParams, setSearchParams] = useSearchParams();
  const itemParamId = searchParams.get('item');

  const { itens, setItens, carregando, erro, recarregar } = useItensOficina();
  const { online, agente } = useSituacaoImpressora();

  const [aba, setAba] = useState<AbaOficina>('andamento');
  const [busca, setBusca] = useState('');
  const [novaEntradaAberta, setNovaEntradaAberta] = useState(false);

  // Quando uma nova entrada acaba de ser criada, abrimos o detalhe já com a etiqueta pronta
  const [itemComEtiquetaAutomaticaId, setItemComEtiquetaAutomaticaId] = useState<string | null>(null);
  // Quando arrasta "Em trânsito" -> "Entrada" no Kanban, abrimos direto o modal de etiqueta
  const [itemEtiquetaKanban, setItemEtiquetaKanban] = useState<ItemOficinaTela | null>(null);

  const [avisoAcao, setAvisoAcao] = useState<string | null>(null);
  const [versaoFinalizados, setVersaoFinalizados] = useState(0);

  const totaisPorOs = useMemo(() => mapaTotaisPorOs(itens), [itens]);

  const itensFiltradosKanban = useMemo(() => {
    const termo = semAcento(busca.trim());
    if (!termo) return itens;
    return itens.filter((item) => {
      const totalOs = item.service_order_id ? totaisPorOs.get(item.service_order_id) : undefined;
      const campos = [
        item.os_number != null ? String(item.os_number) : '',
        numeroItem(item, totalOs),
        item.customer_name ?? '',
        item.equipment_type ?? '',
        item.brand ?? '',
        item.model ?? '',
        item.bench_employee_name ?? '',
        item.legacy_reference ?? '',
      ];
      return campos.some((c) => semAcento(c).includes(termo));
    });
  }, [itens, busca, totaisPorOs]);

  const abrirItem = useCallback(
    (id: string, comEtiqueta = false) => {
      setItemComEtiquetaAutomaticaId(comEtiqueta ? id : null);
      setSearchParams(
        (atual) => {
          const novo = new URLSearchParams(atual);
          novo.set('item', id);
          return novo;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  const fecharItem = useCallback(() => {
    setItemComEtiquetaAutomaticaId(null);
    setSearchParams(
      (atual) => {
        const novo = new URLSearchParams(atual);
        novo.delete('item');
        return novo;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const handleMoverEtapaKanban = useCallback(
    async (item: ItemOficinaTela, destino: EtapaKanban) => {
      setAvisoAcao(null);
      const snapshotAnterior = itens;
      const ehRecebimento = item.status === 'em_transito' && destino === 'entrada';
      const agoraIso = new Date().toISOString();

      // Atualização otimista no Kanban
      const itemOtimista: ItemOficinaTela = {
        ...item,
        status: destino,
        received_at: ehRecebimento && !item.received_at ? agoraIso : item.received_at,
      };
      setItens((atual) => atual.map((x) => (x.id === item.id ? itemOtimista : x)));

      try {
        if (ehRecebimento) {
          await receberItem(item.id);
          setItemEtiquetaKanban(itemOtimista);
        } else {
          await mudarEtapa(item.id, destino);
        }
      } catch (e) {
        // Desfaz se o banco recusar e mostra a mensagem em português
        setItens(snapshotAnterior);
        setAvisoAcao(e instanceof Error ? e.message : 'Não foi possível mover o item.');
      }
    },
    [itens, setItens],
  );

  return (
    <div className="space-y-5">
      {/* ================================================================= */}
      {/* CABEÇALHO                                                         */}
      {/* ================================================================= */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-brv-navy">
              <Wrench size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-brv-navy sm:text-2xl">Oficina</h1>
              <p className="text-xs text-slate-500">
                Equipamentos recolhidos para diagnóstico e conserto na loja
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <IndicadorElgin online={online} agente={agente} compacto />

            <button
              type="button"
              onClick={() => setNovaEntradaAberta(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 sm:text-sm"
            >
              <Plus size={16} />
              Nova entrada
            </button>

            {ehEscritorio && (
              <MenuImpressoraCabecalho
                online={online}
                agente={agente}
                nomeUsuario={profile?.full_name ?? 'usuário'}
              />
            )}
          </div>
        </div>

        {/* Barra de abas + busca */}
        <div className="flex flex-col gap-3 border-t border-slate-100 pt-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1 self-start" role="tablist" aria-label="Visão da oficina">
            <button
              type="button"
              role="tab"
              aria-selected={aba === 'andamento'}
              onClick={() => setAba('andamento')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                aba === 'andamento'
                  ? 'bg-white text-brv-navy shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Kanban size={15} />
              <span>Em andamento</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] tabular-nums ${
                  aba === 'andamento' ? 'bg-blue-50 text-blue-700' : 'bg-slate-200/70 text-slate-600'
                }`}
              >
                {itens.length}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={aba === 'finalizados'}
              onClick={() => setAba('finalizados')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                aba === 'finalizados'
                  ? 'bg-white text-brv-navy shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PackageCheck size={15} />
              <span>Finalizados</span>
            </button>
          </div>

          <div className="relative w-full sm:max-w-xs md:max-w-sm">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar na oficina"
              placeholder="Buscar por OS, cliente, tipo ou marca..."
              className="block w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pr-8 pl-9 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none sm:text-sm"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                aria-label="Limpar busca"
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Aviso de bloqueio ou erro de movimentação */}
      {avisoAcao && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-950 shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-amber-600" />
            <span>{avisoAcao}</span>
          </div>
          <button
            type="button"
            onClick={() => setAvisoAcao(null)}
            aria-label="Fechar aviso"
            className="rounded-md p-1 text-amber-700 hover:bg-amber-100"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ================================================================= */}
      {/* CONTEÚDO DA ABA ATIVA                                             */}
      {/* ================================================================= */}
      {aba === 'andamento' ? (
        carregando ? (
          <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-2xs">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <span className="text-sm font-medium">Carregando itens da oficina...</span>
          </div>
        ) : erro ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-8 text-center"
          >
            <AlertCircle size={28} className="text-red-600" />
            <p className="max-w-md text-sm font-medium text-red-800">{erro}</p>
            <button
              type="button"
              onClick={() => void recarregar()}
              className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
            >
              <RefreshCw size={14} />
              Tentar de novo
            </button>
          </div>
        ) : itens.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Wrench size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Nenhum equipamento em andamento na oficina</p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Clique em "Nova entrada" para registrar um equipamento trazido pela equipe de campo ou deixado no balcão.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNovaEntradaAberta(true)}
              className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700"
            >
              <Plus size={15} />
              Nova entrada
            </button>
          </div>
        ) : itensFiltradosKanban.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
            <Search size={28} className="text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">
              Nenhum item em andamento corresponde a "{busca.trim()}"
            </p>
            <button
              type="button"
              onClick={() => setBusca('')}
              className="mt-1 text-xs font-semibold text-blue-600 hover:underline"
            >
              Limpar busca
            </button>
          </div>
        ) : (
          <KanbanOficina
            itens={itensFiltradosKanban}
            totaisPorOs={totaisPorOs}
            papel={papel}
            onAbrirItem={(id) => abrirItem(id, false)}
            onMoverEtapa={handleMoverEtapaKanban}
            onAvisoBloqueio={setAvisoAcao}
          />
        )
      ) : (
        <ListaFinalizadosOficina
          busca={busca}
          versao={versaoFinalizados}
          onAbrirItem={(id) => abrirItem(id, false)}
        />
      )}

      {/* Modal: Nova entrada */}
      {novaEntradaAberta && (
        <NovaEntradaModal
          ehEscritorio={ehEscritorio}
          onFechar={() => setNovaEntradaAberta(false)}
          onCriado={(novoId, oferecerEtiqueta) => {
            setNovaEntradaAberta(false);
            void recarregar();
            abrirItem(novoId, oferecerEtiqueta);
          }}
        />
      )}

      {/* Etiqueta rápida ao receber no Kanban (Em trânsito -> Entrada) */}
      {itemEtiquetaKanban && (
        <EtiquetaModal
          item={
            itens.find((i) => i.id === itemEtiquetaKanban.id) ?? itemEtiquetaKanban
          }
          totalNaOs={
            itemEtiquetaKanban.service_order_id
              ? totaisPorOs.get(itemEtiquetaKanban.service_order_id)
              : undefined
          }
          onFechar={() => setItemEtiquetaKanban(null)}
        />
      )}

      {/* Painel de detalhe do item (também responde a /oficina?item=<id>) */}
      {itemParamId && (
        <ItemOficinaDetalhes
          key={itemParamId}
          itemId={itemParamId}
          abrirEtiquetaInicial={itemComEtiquetaAutomaticaId === itemParamId}
          onFechar={fecharItem}
          onAlterado={() => {
            void recarregar();
            setVersaoFinalizados((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}
