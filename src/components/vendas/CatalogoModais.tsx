import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Sparkles,
} from 'lucide-react';
import type {
  CatalogItem,
  CatalogItemKind,
  MerchandiseOrigin,
  SaveCatalogItemInput,
} from '../../types/vendas';
import {
  centavosParaTextoInput,
  converterTextoParaCentavos,
  formatarReais,
} from '../../utils/dinheiro';
import { CORES_TIPO_ITEM, ORIGENS_MERCADORIA, UNIDADES_CATALOGO } from './cores';
import {
  listarSugestoesDeServico,
  marcarComoServico,
  salvarItemCatalogo,
} from './fonteDeDados';
import ModalDialogoVendas from './ModalDialogoVendas';
import { itemTemDadoFiscalCompleto } from './regrasVendas';

const CAMPO =
  'mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

interface CatalogoFormModalProps {
  aberto: boolean;
  /** Item sendo editado, ou `null` quando for novo. */
  item: CatalogItem | null;
  /** Quando `true`, pré-preenche a partir de `item` como uma cópia (sem `id`). */
  modoDuplicar?: boolean;
  podeVerCusto: boolean;
  categoriasExistentes: string[];
  onFechar: () => void;
  onSalvo: (item: CatalogItem) => void;
}

export function CatalogoFormModal({
  aberto,
  item,
  modoDuplicar = false,
  podeVerCusto,
  categoriasExistentes,
  onFechar,
  onSalvo,
}: CatalogoFormModalProps) {
  const editandoId = item && !modoDuplicar ? item.id : undefined;

  const [codigo, setCodigo] = useState(
    item ? (modoDuplicar ? `${item.code}-COPIA` : item.code) : '',
  );
  const [codigoBarras, setCodigoBarras] = useState(
    item && !modoDuplicar ? (item.barcode ?? '') : '',
  );
  const [nome, setNome] = useState(
    item ? (modoDuplicar ? `${item.name} (Cópia)` : item.name) : '',
  );
  const [tipo, setTipo] = useState<CatalogItemKind>(item?.kind ?? 'produto');
  const [unidade, setUnidade] = useState(item?.unit ?? 'UN');
  const [categoria, setCategoria] = useState(item?.category ?? '');
  const [precoVendaTexto, setPrecoVendaTexto] = useState(
    item ? centavosParaTextoInput(item.sale_price_cents) : '',
  );
  const [precoCustoTexto, setPrecoCustoTexto] = useState(
    item?.cost_price_cents != null ? centavosParaTextoInput(item.cost_price_cents) : '',
  );
  const [controlaEstoque, setControlaEstoque] = useState(item?.controls_stock ?? true);
  const [estoqueAtual, setEstoqueAtual] = useState(
    item ? String(item.stock_quantity) : '0',
  );
  const [estoqueMinimo, setEstoqueMinimo] = useState(
    item ? String(item.min_stock_quantity) : '0',
  );
  const [frequente, setFrequente] = useState(item?.is_frequent ?? false);
  const [ativo, setAtivo] = useState(item?.active ?? true);

  // Dados fiscais
  const [ncm, setNcm] = useState(item?.ncm ?? '');
  const [cfop, setCfop] = useState(item?.cfop ?? '5102');
  const [csosn, setCsosn] = useState(item?.csosn ?? '102');
  const [origem, setOrigem] = useState<MerchandiseOrigin>(item?.origin ?? 0);
  const [unidadeTributavel, setUnidadeTributavel] = useState(
    item?.taxable_unit ?? item?.unit ?? 'UN',
  );
  const [codigoServico, setCodigoServico] = useState(item?.service_code ?? '14.01');
  const [aliquotaIss, setAliquotaIss] = useState(
    item?.iss_rate != null ? String(item.iss_rate).replace('.', ',') : '2,0',
  );
  const [descricaoNota, setDescricaoNota] = useState(item?.invoice_description ?? '');

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const fiscalCompleto = itemTemDadoFiscalCompleto({
    kind: tipo,
    ncm,
    cfop,
    csosn,
    service_code: codigoServico,
    iss_rate: Number(aliquotaIss.replace(',', '.')) || null,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!codigo.trim()) {
      setErro('Informe o código do item.');
      return;
    }
    if (!nome.trim()) {
      setErro('Informe o nome do item.');
      return;
    }
    const vendaCentavos = converterTextoParaCentavos(precoVendaTexto);
    if (vendaCentavos === null || vendaCentavos < 0) {
      setErro('Informe um preço de venda válido (ex.: 49,90).');
      return;
    }

    let custoCentavos: number | null | undefined = undefined;
    if (podeVerCusto) {
      if (precoCustoTexto.trim()) {
        const c = converterTextoParaCentavos(precoCustoTexto);
        if (c === null || c < 0) {
          setErro('Informe um preço de custo válido ou deixe em branco.');
          return;
        }
        custoCentavos = c;
      } else {
        custoCentavos = null;
      }
    }

    const issNum = aliquotaIss.trim()
      ? Number(aliquotaIss.trim().replace(',', '.'))
      : null;
    if (tipo === 'servico' && issNum !== null && (!Number.isFinite(issNum) || issNum < 0 || issNum > 10)) {
      setErro('Informe uma alíquota de ISS válida entre 0% e 10% (ex.: 2,0).');
      return;
    }

    const payload: SaveCatalogItemInput = {
      id: editandoId,
      code: codigo.trim(),
      barcode: codigoBarras.trim() || null,
      name: nome.trim(),
      kind: tipo,
      unit: unidade.trim() || (tipo === 'servico' ? 'SRV' : 'UN'),
      category: categoria.trim() || null,
      sale_price_cents: vendaCentavos,
      cost_price_cents: custoCentavos,
      controls_stock: tipo === 'produto' ? controlaEstoque : false,
      stock_quantity: tipo === 'produto' && controlaEstoque ? Number(estoqueAtual) || 0 : 0,
      min_stock_quantity: tipo === 'produto' && controlaEstoque ? Number(estoqueMinimo) || 0 : 0,
      active: ativo,
      is_frequent: frequente,
      ncm: tipo === 'produto' ? ncm.replace(/\D/g, '') || null : null,
      cfop: tipo === 'produto' ? cfop.replace(/\D/g, '') || '5102' : null,
      csosn: tipo === 'produto' ? csosn.replace(/\D/g, '') || '102' : null,
      origin: origem,
      taxable_unit: unidadeTributavel.trim() || unidade.trim() || 'UN',
      service_code: tipo === 'servico' ? codigoServico.trim() || null : null,
      iss_rate: tipo === 'servico' ? issNum : null,
      invoice_description: tipo === 'servico' ? descricaoNota.trim() || null : null,
    };

    setSalvando(true);
    try {
      const salvo = await salvarItemCatalogo(payload);
      onSalvo(salvo);
      onFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar o item do catálogo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalDialogoVendas
      aberto={aberto}
      onFechar={onFechar}
      titulo={
        modoDuplicar
          ? 'Duplicar item do catálogo'
          : editandoId
            ? `Editar item · ${item?.code ?? ''}`
            : 'Novo item no catálogo'
      }
      subtitulo="Produtos vão em NFC-e / NF-e e Serviços vão em NFS-e nacional."
      larguraMax="max-w-2xl"
      fecharAoClicarFora={!salvando}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {/* Tipo: Produto ou Serviço */}
        <fieldset>
          <legend className="block text-xs font-semibold text-slate-700">Tipo do item *</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2.5">
            {(['produto', 'servico'] as const).map((op) => {
              const selecionado = tipo === op;
              return (
                <label
                  key={op}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition ${
                    selecionado
                      ? 'border-blue-600 bg-blue-50/70 text-blue-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="tipo-item-catalogo"
                    value={op}
                    checked={selecionado}
                    onChange={() => {
                      setTipo(op);
                      if (op === 'servico' && unidade === 'UN') setUnidade('SRV');
                      if (op === 'produto' && unidade === 'SRV') setUnidade('UN');
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span>{CORES_TIPO_ITEM[op].rotulo}</span>
                    <span className="block text-[10px] font-normal text-slate-500">
                      {op === 'produto' ? 'Nota fiscal NFC-e ou NF-e' : 'Mão de obra · NFS-e nacional'}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <div>
            <label htmlFor="cat-codigo" className="block text-xs font-semibold text-slate-700">
              Código *
            </label>
            <input
              id="cat-codigo"
              name="code"
              type="text"
              required
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ex.: 000126"
              className={CAMPO}
            />
          </div>

          <div>
            <label htmlFor="cat-ean" className="block text-xs font-semibold text-slate-700">
              Código de barras (opcional)
            </label>
            <input
              id="cat-ean"
              name="barcode"
              type="text"
              inputMode="numeric"
              autoCorrect="off"
              spellCheck={false}
              value={codigoBarras}
              onChange={(e) => setCodigoBarras(e.target.value)}
              placeholder="EAN / GTIN"
              className={CAMPO}
            />
          </div>

          <div>
            <label htmlFor="cat-unidade" className="block text-xs font-semibold text-slate-700">
              Unidade *
            </label>
            <select
              id="cat-unidade"
              name="unit"
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
              className={CAMPO}
            >
              {UNIDADES_CATALOGO.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label htmlFor="cat-nome" className="block text-xs font-semibold text-slate-700">
              Nome do {tipo === 'produto' ? 'produto' : 'serviço'} *
            </label>
            <input
              id="cat-nome"
              name="name"
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder={
                tipo === 'produto'
                  ? 'Ex.: Tubo de Cobre Flexível 1/2" (metro)'
                  : 'Ex.: M.O Instal Ar Cond split 12.000 btus'
              }
              className={CAMPO}
            />
          </div>

          <div>
            <label htmlFor="cat-categoria" className="block text-xs font-semibold text-slate-700">
              Categoria
            </label>
            <input
              id="cat-categoria"
              name="category"
              type="text"
              list="lista-categorias-catalogo"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ex.: Elétrica"
              className={CAMPO}
            />
            <datalist id="lista-categorias-catalogo">
              {categoriasExistentes.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Preço de venda e custo (custo só visível para nível `completo`) */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label htmlFor="cat-preco-venda" className="block text-xs font-semibold text-slate-700">
              Preço de venda (R$) *
            </label>
            <input
              id="cat-preco-venda"
              name="sale_price"
              type="text"
              inputMode="decimal"
              required
              value={precoVendaTexto}
              onChange={(e) => setPrecoVendaTexto(e.target.value)}
              placeholder="Ex.: 49,90"
              className={CAMPO}
            />
          </div>

          {podeVerCusto && (
            <div>
              <label htmlFor="cat-preco-custo" className="block text-xs font-semibold text-slate-700">
                Custo (R$) <span className="font-normal text-slate-400">(só acesso completo)</span>
              </label>
              <input
                id="cat-preco-custo"
                name="cost_price"
                type="text"
                inputMode="decimal"
                value={precoCustoTexto}
                onChange={(e) => setPrecoCustoTexto(e.target.value)}
                placeholder="Ex.: 31,80"
                className={CAMPO}
              />
            </div>
          )}
        </div>

        {/* Estoque (apenas produtos) */}
        {tipo === 'produto' && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex items-center gap-2">
              <input
                id="cat-ctrl-estoque"
                type="checkbox"
                checked={controlaEstoque}
                onChange={(e) => setControlaEstoque(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="cat-ctrl-estoque" className="cursor-pointer text-xs font-semibold text-slate-800">
                Controla estoque
              </label>
            </div>

            {controlaEstoque && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cat-est-atual" className="block text-xs font-medium text-slate-700">
                    Estoque atual ({unidade})
                  </label>
                  <input
                    id="cat-est-atual"
                    type="text"
                    inputMode="decimal"
                    value={estoqueAtual}
                    onChange={(e) => setEstoqueAtual(e.target.value)}
                    className={CAMPO}
                  />
                </div>
                <div>
                  <label htmlFor="cat-est-min" className="block text-xs font-medium text-slate-700">
                    Estoque mínimo ({unidade})
                  </label>
                  <input
                    id="cat-est-min"
                    type="text"
                    inputMode="decimal"
                    value={estoqueMinimo}
                    onChange={(e) => setEstoqueMinimo(e.target.value)}
                    className={CAMPO}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Opções de uso */}
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-2">
            <input
              id="cat-frequente"
              type="checkbox"
              checked={frequente}
              onChange={(e) => setFrequente(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="cat-frequente" className="cursor-pointer text-xs font-medium text-slate-700">
              Mostrar nos itens frequentes da Nova Venda
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="cat-ativo"
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="cat-ativo" className="cursor-pointer text-xs font-medium text-slate-700">
              Ativo
            </label>
          </div>
        </div>

        {/* Seção recolhida: Dados fiscais */}
        <details className="group rounded-xl border border-slate-200 bg-slate-50/70">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-xs font-bold text-slate-800">
            <div className="flex items-center gap-2">
              <ChevronRight size={15} className="text-slate-400 transition-transform group-open:rotate-90" />
              <span>Dados fiscais</span>
              {fiscalCompleto ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <CheckCircle2 size={11} /> Completo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                  <AlertTriangle size={11} /> Fiscal incompleto
                </span>
              )}
            </div>
            <span className="text-[11px] font-normal text-slate-500">Confirme com o contador</span>
          </summary>

          <div className="space-y-3 border-t border-slate-200/80 px-4 py-3.5">
            <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] font-medium text-amber-900">
              Confirme com o contador os códigos fiscais antes de ativar a emissão real de notas. Nenhum campo abaixo é obrigatório para salvar o item.
            </p>

            {tipo === 'produto' ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="cat-ncm" className="block text-xs font-medium text-slate-700">
                    NCM (8 dígitos)
                  </label>
                  <input
                    id="cat-ncm"
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={ncm}
                    onChange={(e) => setNcm(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ex.: 74111010"
                    className={CAMPO}
                  />
                </div>

                <div>
                  <label htmlFor="cat-cfop" className="block text-xs font-medium text-slate-700">
                    CFOP (padrão 5102)
                  </label>
                  <input
                    id="cat-cfop"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={cfop}
                    onChange={(e) => setCfop(e.target.value.replace(/\D/g, ''))}
                    placeholder="5102"
                    className={CAMPO}
                  />
                </div>

                <div>
                  <label htmlFor="cat-csosn" className="block text-xs font-medium text-slate-700">
                    CSOSN Simples (padrão 102)
                  </label>
                  <input
                    id="cat-csosn"
                    type="text"
                    inputMode="numeric"
                    maxLength={3}
                    value={csosn}
                    onChange={(e) => setCsosn(e.target.value.replace(/\D/g, ''))}
                    placeholder="102"
                    className={CAMPO}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="cat-origem" className="block text-xs font-medium text-slate-700">
                    Origem da mercadoria (0 a 8)
                  </label>
                  <select
                    id="cat-origem"
                    value={origem}
                    onChange={(e) => setOrigem(Number(e.target.value) as MerchandiseOrigin)}
                    className={CAMPO}
                  >
                    {ORIGENS_MERCADORIA.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.rotulo}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="cat-un-trib" className="block text-xs font-medium text-slate-700">
                    Unidade tributável
                  </label>
                  <input
                    id="cat-un-trib"
                    type="text"
                    value={unidadeTributavel}
                    onChange={(e) => setUnidadeTributavel(e.target.value)}
                    placeholder={unidade}
                    className={CAMPO}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="cat-cod-serv" className="block text-xs font-medium text-slate-700">
                      Código de serviço nacional (NBS / LC 116)
                    </label>
                    <input
                      id="cat-cod-serv"
                      type="text"
                      value={codigoServico}
                      onChange={(e) => setCodigoServico(e.target.value)}
                      placeholder="Ex.: 14.01"
                      className={CAMPO}
                    />
                  </div>
                  <div>
                    <label htmlFor="cat-iss" className="block text-xs font-medium text-slate-700">
                      Alíquota de ISS (%)
                    </label>
                    <input
                      id="cat-iss"
                      type="text"
                      inputMode="decimal"
                      value={aliquotaIss}
                      onChange={(e) => setAliquotaIss(e.target.value)}
                      placeholder="Ex.: 2,0"
                      className={CAMPO}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="cat-desc-nota" className="block text-xs font-medium text-slate-700">
                    Descrição para a NFS-e
                  </label>
                  <textarea
                    id="cat-desc-nota"
                    rows={2}
                    value={descricaoNota}
                    onChange={(e) => setDescricaoNota(e.target.value)}
                    placeholder="Texto padrão que sairá na discriminação do serviço na nota..."
                    className={CAMPO}
                  />
                </div>
              </div>
            )}
          </div>
        </details>

        {erro && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
            {erro}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            disabled={salvando}
            onClick={onFechar}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-blue-700 disabled:opacity-50"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            {salvando ? 'Salvando...' : 'Salvar item'}
          </button>
        </div>
      </form>
    </ModalDialogoVendas>
  );
}

// ============================================================================
// Modal: Ferramenta "Revisar tipos" (conferência da importação do SicWeb)
// ============================================================================

interface RevisarTiposCatalogoModalProps {
  aberto: boolean;
  onFechar: () => void;
  onAplicado: (qtd: number) => void;
}

export function RevisarTiposCatalogoModal({
  aberto,
  onFechar,
  onAplicado,
}: RevisarTiposCatalogoModalProps) {
  const [sugestoes, setSugestoes] = useState<CatalogItem[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aplicando, setAplicando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    listarSugestoesDeServico()
      .then((lista) => {
        if (!ativo) return;
        setSugestoes(lista);
        // Pré-marcados como Serviço conforme seção 4.1 do briefing
        setSelecionados(lista.map((i) => i.id));
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [aberto]);

  const alternar = (id: string) => {
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  };

  const handleAplicar = async () => {
    if (selecionados.length === 0) return;
    setAplicando(true);
    try {
      const qtd = await marcarComoServico(selecionados);
      onAplicado(qtd);
      onFechar();
    } finally {
      setAplicando(false);
    }
  };

  return (
    <ModalDialogoVendas
      aberto={aberto}
      onFechar={onFechar}
      titulo="Revisar tipos (Produto vs Serviço)"
      subtitulo='No SicWeb, itens de mão de obra ("M.O", instalação, manutenção...) estavam cadastrados como produtos comuns.'
      larguraMax="max-w-2xl"
    >
      <div className="space-y-4">
        <p className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-3.5 py-2.5 text-xs text-indigo-950">
          Os itens abaixo ainda estão marcados como <strong>Produto</strong>, mas o nome começa com{' '}
          <strong>"M.O"</strong> ou contém <em>"mão de obra"</em>, <em>"instalação"</em>,{' '}
          <em>"desinstalação"</em>, <em>"manutenção"</em> ou <em>"visita"</em>. Eles já vêm pré-marcados
          para serem convertidos em <strong>Serviço</strong> (para saírem em NFS-e nacional).
        </p>

        {carregando ? (
          <p className="py-8 text-center text-xs text-slate-400">Buscando sugestões...</p>
        ) : sugestoes.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-xs text-emerald-900">
            <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-600" />
            <p className="font-bold">Todos os itens com cara de mão de obra já foram conferidos!</p>
          </div>
        ) : (
          <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
            {sugestoes.map((item) => {
              const marcado = selecionados.includes(item.id);
              return (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-xs transition hover:bg-slate-50"
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => alternar(item.id)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="font-mono text-[11px] text-slate-400">{item.code}</span>{' '}
                      <strong className="text-slate-800">{item.name}</strong>
                      <span className="block text-[11px] text-slate-500">
                        Categoria: {item.category || 'Sem categoria'}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 font-bold text-slate-800">
                    {formatarReais(item.sale_price_cents)}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <span className="text-xs text-slate-500">
            {selecionados.length} de {sugestoes.length} selecionado(s)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onFechar}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Fechar
            </button>
            {sugestoes.length > 0 && (
              <button
                type="button"
                disabled={aplicando || selecionados.length === 0}
                onClick={() => void handleAplicar()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {aplicando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Aplicar nos selecionados
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalDialogoVendas>
  );
}

