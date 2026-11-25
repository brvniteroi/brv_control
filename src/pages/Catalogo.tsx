import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  CheckCircle2,
  Copy,
  Lock,
  Package,
  Pencil,
  Plus,
  Search,
} from 'lucide-react';
import { useNivelFinanceiro } from '../components/financeiro/fonteDeDados';
import {
  CatalogoFormModal,
  RevisarTiposCatalogoModal,
} from '../components/vendas/CatalogoModais';
import { CORES_TIPO_ITEM } from '../components/vendas/cores';
import {
  inativarItemCatalogo,
  listarCatalogo,
} from '../components/vendas/fonteDeDados';
import NavegacaoVendas from '../components/vendas/NavegacaoVendas';
import {
  ITENS_VENDAS_POR_PAGINA,
  ehEscritorioOuAdminVendas,
  itemTemDadoFiscalCompleto,
} from '../components/vendas/regrasVendas';
import { useAuth } from '../contexts/useAuth';
import type { CatalogItem } from '../types/vendas';
import { formatarReais } from '../utils/dinheiro';

type AbaCatalogo = 'todos' | 'produtos' | 'servicos' | 'inativos';

const ABAS_CATALOGO: readonly { id: AbaCatalogo; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'produtos', rotulo: 'Produtos' },
  { id: 'servicos', rotulo: 'Serviços' },
  { id: 'inativos', rotulo: 'Inativos' },
];

const SELECT =
  'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

export default function Catalogo() {
  const { profile } = useAuth();
  const podeAcessar = ehEscritorioOuAdminVendas(profile?.role);
  const { nivel } = useNivelFinanceiro(profile);
  const podeVerCusto = nivel === 'completo';

  const [aba, setAba] = useState<AbaCatalogo>('todos');
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [pagina, setPagina] = useState(0);
  const [versao, setVersao] = useState(0);

  const [itens, setItens] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [sugestoesRevisao, setSugestoesRevisao] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [formModal, setFormModal] = useState<{
    item: CatalogItem | null;
    duplicar?: boolean;
  } | null>(null);
  const [revisarAberto, setRevisarAberto] = useState(false);

  useEffect(() => {
    if (!podeAcessar) return;
    let ativo = true;
    const timer = setTimeout(() => {
      setCarregando(true);
      setErro(null);
      listarCatalogo({
        pagina,
        busca,
        aba,
        categoria,
      })
        .then((res) => {
          if (!ativo) return;
          setItens(res.itens);
          setTotal(res.total);
          setCategorias(res.categorias);
          setSugestoesRevisao(res.contagens.sugestoes_revisao);
        })
        .catch((e: unknown) => {
          if (!ativo) return;
          setErro(e instanceof Error ? e.message : 'Não foi possível carregar o catálogo.');
        })
        .finally(() => {
          if (ativo) setCarregando(false);
        });
    }, 150);

    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [podeAcessar, pagina, busca, aba, categoria, versao]);

  if (!podeAcessar) {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Lock size={24} />
        </div>
        <h1 className="mt-3 text-base font-bold text-slate-800">Acesso restrito</h1>
        <p className="mt-1 max-w-sm text-xs text-slate-500">
          O catálogo é restrito à equipe do escritório e administradores.
        </p>
      </div>
    );
  }

  const handleInativarOuReativar = async (item: CatalogItem) => {
    try {
      await inativarItemCatalogo(item.id);
      setVersao((v) => v + 1);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível alterar o status do item.');
    }
  };

  const totalPaginas = Math.max(1, Math.ceil(total / ITENS_VENDAS_POR_PAGINA));

  return (
    <div className="space-y-6">
      {/* Cabeçalho da página */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Catálogo</h1>
          <p className="mt-1 text-xs text-slate-500">
            Gerencie os produtos e serviços usados nos orçamentos e vendas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NavegacaoVendas />

          {sugestoesRevisao > 0 && (
            <button
              type="button"
              onClick={() => setRevisarAberto(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Revisar tipos ({sugestoesRevisao})
            </button>
          )}

          <button
            type="button"
            onClick={() => setFormModal({ item: null })}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700"
          >
            <Plus size={18} />
            Novo item
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <search className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(0);
            }}
            placeholder="Buscar por código, nome ou código de barras..."
            className="block w-full rounded-xl border border-slate-200 py-2.5 pr-3 pl-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <select
          value={categoria}
          aria-label="Filtrar por categoria"
          onChange={(e) => {
            setCategoria(e.target.value);
            setPagina(0);
          }}
          className={SELECT}
        >
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <div className="flex rounded-xl bg-slate-100 p-1">
          {ABAS_CATALOGO.map((op) => (
            <button
              key={op.id}
              type="button"
              onClick={() => {
                setAba(op.id);
                setPagina(0);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                aba === op.id
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {op.rotulo}
            </button>
          ))}
        </div>
      </search>

      {/* Estados da lista */}
      {erro ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <span>{erro}</span>
          <button
            type="button"
            onClick={() => setVersao((v) => v + 1)}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 font-semibold text-red-700 hover:bg-red-100"
          >
            Tentar de novo
          </button>
        </div>
      ) : carregando ? (
        <div className="flex h-64 w-full items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <span className="text-xs font-medium">Carregando catálogo...</span>
          </div>
        </div>
      ) : itens.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-2xs">
            <Package size={28} />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-800">Nenhum item encontrado</h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            {busca || categoria || aba !== 'todos'
              ? 'Nenhum item corresponde aos filtros escolhidos.'
              : 'Cadastre o primeiro produto ou serviço do catálogo.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div
            tabIndex={0}
            role="region"
            aria-label="Tabela do catálogo"
            className="overflow-x-auto"
          >
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Código</th>
                  <th className="px-5 py-3.5">Item</th>
                  <th className="px-5 py-3.5">Tipo</th>
                  <th className="px-5 py-3.5">Unid.</th>
                  <th className="px-5 py-3.5 text-right">Preço</th>
                  {podeVerCusto && <th className="px-5 py-3.5 text-right">Custo</th>}
                  <th className="px-5 py-3.5 text-right">Estoque</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {itens.map((item) => {
                  const fiscalOk = itemTemDadoFiscalCompleto(item);
                  const estoqueBaixo =
                    item.kind === 'produto' &&
                    item.controls_stock &&
                    item.stock_quantity <= item.min_stock_quantity;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setFormModal({ item })}
                      className="cursor-pointer transition hover:bg-slate-50/80"
                    >
                      <td className="px-5 py-4 font-mono font-bold text-slate-900">
                        <div>{item.code}</div>
                        {item.barcode && (
                          <div className="text-[11px] font-normal text-slate-400">
                            {item.barcode}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-900">{item.name}</span>
                          {!fiscalOk && (
                            <span
                              title="Falta NCM/CFOP/CSOSN ou código de serviço/ISS"
                              className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
                            >
                              <AlertTriangle size={11} /> Fiscal incompleto
                            </span>
                          )}
                        </div>
                        {(item.category || item.manufacturer) && (
                          <div className="text-[11px] text-slate-400">
                            {[item.category, item.manufacturer].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${CORES_TIPO_ITEM[item.kind].selo}`}
                        >
                          {CORES_TIPO_ITEM[item.kind].rotulo}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-slate-600">{item.unit}</td>

                      <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-900">
                        {formatarReais(item.sale_price_cents)}
                      </td>

                      {podeVerCusto && (
                        <td className="px-5 py-4 text-right tabular-nums text-slate-500">
                          {item.cost_price_cents != null
                            ? formatarReais(item.cost_price_cents)
                            : '—'}
                        </td>
                      )}

                      <td className="px-5 py-4 text-right tabular-nums">
                        {item.kind === 'produto' && item.controls_stock ? (
                          <span
                            className={
                              estoqueBaixo
                                ? 'font-semibold text-amber-700'
                                : 'text-slate-600'
                            }
                          >
                            {item.stock_quantity} {item.unit}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {item.active ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                            <CheckCircle2 size={12} /> Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                            <Archive size={12} /> Inativo
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setFormModal({ item })}
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                          >
                            <Pencil size={13} className="inline" /> Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormModal({ item, duplicar: true })}
                            title="Duplicar"
                            aria-label={`Duplicar ${item.name}`}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50"
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleInativarOuReativar(item)}
                            title={item.active ? 'Inativar' : 'Reativar'}
                            aria-label={`${item.active ? 'Inativar' : 'Reativar'} ${item.name}`}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50"
                          >
                            {item.active ? <Archive size={13} /> : <ArchiveRestore size={13} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            <span>
              {total} {total === 1 ? 'item' : 'itens'} · página {pagina + 1} de {totalPaginas}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pagina === 0}
                onClick={() => setPagina((p) => Math.max(0, p - 1))}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={pagina + 1 >= totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      )}

      {formModal && (
        <CatalogoFormModal
          key={`${formModal.item?.id ?? 'novo'}-${formModal.duplicar ? 'dup' : 'ed'}`}
          aberto
          item={formModal.item}
          modoDuplicar={formModal.duplicar}
          podeVerCusto={podeVerCusto}
          categoriasExistentes={categorias}
          onFechar={() => setFormModal(null)}
          onSalvo={() => setVersao((v) => v + 1)}
        />
      )}

      {revisarAberto && (
        <RevisarTiposCatalogoModal
          aberto={revisarAberto}
          onFechar={() => setRevisarAberto(false)}
          onAplicado={() => setVersao((v) => v + 1)}
        />
      )}
    </div>
  );
}
