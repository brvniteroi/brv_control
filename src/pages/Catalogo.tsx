import { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  Copy,
  Lock,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  X,
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
  const [contagens, setContagens] = useState({
    todos: 0,
    produtos: 0,
    servicos: 0,
    inativos: 0,
    sugestoes_revisao: 0,
  });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [avisoAcao, setAvisoAcao] = useState<string | null>(null);

  // Modais
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
          setContagens(res.contagens);
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
          O catálogo de produtos e serviços é restrito à equipe do escritório e administradores.
        </p>
      </div>
    );
  }

  const handleInativarOuReativar = async (item: CatalogItem) => {
    setAvisoAcao(null);
    try {
      const atualizado = await inativarItemCatalogo(item.id);
      setAvisoAcao(
        atualizado.active
          ? `Item "${atualizado.name}" reativado no catálogo.`
          : `Item "${atualizado.name}" inativado (itens que já foram vendidos nunca são excluídos para preservar o histórico).`,
      );
      setVersao((v) => v + 1);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível alterar o status do item.');
    }
  };

  const totalPaginas = Math.max(1, Math.ceil(total / ITENS_VENDAS_POR_PAGINA));

  return (
    <div className="space-y-5">
      <NavegacaoVendas />

      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-brv-navy">
              <PackageSearch size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-brv-navy sm:text-2xl">
                Catálogo de Produtos e Serviços
              </h1>
              <p className="text-xs text-slate-500">
                Produtos (NFC-e / NF-e) e serviços de mão de obra (NFS-e nacional)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setRevisarAberto(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-800 transition hover:bg-indigo-100"
            >
              <Sparkles size={15} />
              <span>Revisar tipos</span>
              {contagens.sugestoes_revisao > 0 && (
                <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {contagens.sugestoes_revisao}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setFormModal({ item: null })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 sm:text-sm"
            >
              <Plus size={16} />
              Novo item
            </button>
          </div>
        </div>

        {/* Chips + Busca + Filtro de categoria */}
        <search className="flex flex-col gap-3 border-t border-slate-100 pt-3.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar catálogo por tipo">
            {ABAS_CATALOGO.map((op) => {
              const ativa = aba === op.id;
              const qtd = contagens[op.id];
              return (
                <button
                  key={op.id}
                  type="button"
                  aria-pressed={ativa}
                  onClick={() => {
                    setAba(op.id);
                    setPagina(0);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                    ativa
                      ? 'border-brv-navy bg-brv-navy text-white shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{op.rotulo}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      ativa ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {qtd}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={categoria}
              aria-label="Filtrar por categoria"
              onChange={(e) => {
                setCategoria(e.target.value);
                setPagina(0);
              }}
              className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none"
            >
              <option value="">Todas as categorias</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <div className="relative min-w-64">
              <Search
                size={15}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPagina(0);
                }}
                aria-label="Buscar no catálogo por código, nome ou código de barras"
                placeholder="Buscar código, nome ou código de barras..."
                className="block w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pr-8 pl-9 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => {
                    setBusca('');
                    setPagina(0);
                  }}
                  aria-label="Limpar busca"
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </search>
      </div>

      {avisoAcao && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-medium text-blue-900"
        >
          <span>{avisoAcao}</span>
          <button
            type="button"
            onClick={() => setAvisoAcao(null)}
            aria-label="Fechar aviso"
            className="text-blue-600 hover:text-blue-900"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Estados: Carregando / Erro / Vazio / Lista */}
      {carregando ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-2xs">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          <span className="text-sm font-medium">Carregando catálogo...</span>
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
            onClick={() => setVersao((v) => v + 1)}
            className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            <RefreshCw size={14} />
            Tentar de novo
          </button>
        </div>
      ) : itens.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <PackageSearch size={32} className="text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">Nenhum item encontrado no catálogo</p>
          <p className="max-w-sm text-xs text-slate-400">
            Ajuste os filtros acima ou clique em "Novo item" para cadastrar um produto ou serviço.
          </p>
        </div>
      ) : (
        <>
          {/* Cartões no celular (< md) */}
          <div className="space-y-2.5 md:hidden">
            {itens.map((item) => {
              const fiscalOk = itemTemDadoFiscalCompleto(item);
              const estoqueBaixo =
                item.kind === 'produto' &&
                item.controls_stock &&
                item.stock_quantity <= item.min_stock_quantity;
              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-500">
                        #{item.code}
                      </span>
                      <h2 className="text-sm font-bold text-slate-900">{item.name}</h2>
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${CORES_TIPO_ITEM[item.kind].selo}`}
                    >
                      {CORES_TIPO_ITEM[item.kind].rotulo}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-extrabold text-brv-navy">
                      {formatarReais(item.sale_price_cents)} / {item.unit}
                    </span>
                    {podeVerCusto && item.cost_price_cents != null && (
                      <span className="text-slate-400">
                        (Custo: {formatarReais(item.cost_price_cents)})
                      </span>
                    )}
                    {item.kind === 'produto' && item.controls_stock && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          estoqueBaixo
                            ? 'bg-red-50 text-red-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        Estoque: {item.stock_quantity} {item.unit}
                      </span>
                    )}
                    {!fiscalOk && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                        <AlertTriangle size={10} /> Fiscal incompleto
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-slate-100 pt-2.5">
                    <button
                      type="button"
                      onClick={() => setFormModal({ item })}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil size={12} /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormModal({ item, duplicar: true })}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Copy size={12} /> Duplicar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleInativarOuReativar(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {item.active ? <Archive size={12} /> : <ArchiveRestore size={12} />}
                      {item.active ? 'Inativar' : 'Reativar'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tabela no computador (>= md) */}
          <div
            tabIndex={0}
            role="region"
            aria-label="Tabela do catálogo de produtos e serviços"
            className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs md:block"
          >
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Nome / Categoria</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Unid.</th>
                  <th className="px-4 py-3 text-right">Preço</th>
                  {podeVerCusto && <th className="px-4 py-3 text-right">Custo</th>}
                  <th className="px-4 py-3 text-right">Estoque</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3 text-right">Ações</th>
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
                    <tr key={item.id} className="transition hover:bg-blue-50/30">
                      <td className="px-4 py-3 font-mono font-bold text-slate-700">
                        <div>{item.code}</div>
                        {item.barcode && (
                          <div className="text-[10px] font-normal text-slate-400">
                            EAN {item.barcode}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setFormModal({ item })}
                            className="text-left font-bold text-slate-900 hover:text-blue-600 hover:underline"
                          >
                            {item.name}
                          </button>
                          {!fiscalOk && (
                            <span
                              title="Falta preencher NCM/CFOP/CSOSN (produto) ou Código de Serviço/ISS (serviço)"
                              className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900"
                            >
                              <AlertTriangle size={10} /> Fiscal incompleto
                            </span>
                          )}
                        </div>
                        {item.category && (
                          <div className="mt-0.5 text-[11px] text-slate-400">{item.category}</div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${CORES_TIPO_ITEM[item.kind].selo}`}
                        >
                          {CORES_TIPO_ITEM[item.kind].rotulo}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-semibold text-slate-600">{item.unit}</td>

                      <td className="px-4 py-3 text-right font-extrabold tabular-nums text-brv-navy">
                        {formatarReais(item.sale_price_cents)}
                      </td>

                      {podeVerCusto && (
                        <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                          {item.cost_price_cents != null
                            ? formatarReais(item.cost_price_cents)
                            : '—'}
                        </td>
                      )}

                      <td className="px-4 py-3 text-right tabular-nums">
                        {item.kind === 'produto' && item.controls_stock ? (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              estoqueBaixo
                                ? 'bg-red-50 text-red-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {item.stock_quantity} {item.unit}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            item.active
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {item.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setFormModal({ item })}
                            title="Editar item"
                            aria-label={`Editar ${item.name}`}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-blue-600"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormModal({ item, duplicar: true })}
                            title="Duplicar item"
                            aria-label={`Duplicar ${item.name}`}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-blue-600"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleInativarOuReativar(item)}
                            title={
                              item.active
                                ? 'Inativar item (itens vendidos não são excluídos)'
                                : 'Reativar item'
                            }
                            aria-label={`${item.active ? 'Inativar' : 'Reativar'} ${item.name}`}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-amber-700"
                          >
                            {item.active ? <Archive size={14} /> : <ArchiveRestore size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Rodapé e paginação */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600">
            <span>
              Mostrando <strong>{itens.length}</strong> de <strong>{total}</strong> itens
            </span>

            {totalPaginas > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pagina === 0}
                  onClick={() => setPagina((p) => Math.max(0, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <span>
                  Página <strong>{pagina + 1}</strong> de <strong>{totalPaginas}</strong>
                </span>
                <button
                  type="button"
                  disabled={pagina + 1 >= totalPaginas}
                  onClick={() => setPagina((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:opacity-40"
                >
                  Próxima <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </>
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
          onSalvo={(salvo) => {
            setAvisoAcao(`Item "${salvo.name}" (${salvo.code}) salvo com sucesso.`);
            setVersao((v) => v + 1);
          }}
        />
      )}

      {revisarAberto && (
        <RevisarTiposCatalogoModal
          aberto={revisarAberto}
          onFechar={() => setRevisarAberto(false)}
          onAplicado={(qtd) => {
            setAvisoAcao(`${qtd} item(ns) convertidos para Serviço com sucesso.`);
            setVersao((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}

