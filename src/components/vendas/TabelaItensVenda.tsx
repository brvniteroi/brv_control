import { useEffect, useState, type KeyboardEvent } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { AlertTriangle, GripVertical, Plus, Trash2 } from 'lucide-react';
import type { CatalogItem, CatalogItemKind } from '../../types/vendas';
import { formatarReais, type ModoDescontoLinha } from '../../utils/dinheiro';
import { useNavegacaoLista } from '../../hooks/useNavegacaoLista';
import { buscarItensParaBusca } from './fonteDeDados';

/**
 * Itens do orçamento e da venda numa tabela compacta, um item por linha (pedido do Braulio, 2026-11-24, no molde da tela de
 * orçamento do SicWeb). A última linha é a inclusão, e a QUANTIDADE vem primeiro (pedido do Braulio, 2026-11-25): digita a
 * quantidade (vazio = 1), Enter, digita código, código de barras ou nome, escolhe com ↓/↑ e Enter; o cursor volta para a
 * quantidade. O leitor de código de barras pode ler direto no campo da quantidade (6 dígitos ou mais seguidos de Enter são
 * código, não quantidade). Enter numa linha volta para a inclusão; ↓/↑ nos campos da linha andam para o item de baixo/cima.
 */

/** Linha em edição (textos como o usuário digitou). */
export interface LinhaItemVenda {
  uid: string;
  catalog_item_id: string | null;
  is_custom: boolean;
  kind: CatalogItemKind;
  code: string;
  name: string;
  unit: string;
  quantityTexto: string;
  unitPriceTexto: string;
  discountMode: ModoDescontoLinha;
  discountTexto: string;
  controlsStock?: boolean;
  stockQuantity?: number;
}

/** Linha com os valores já calculados. */
export type LinhaItemCalculada = LinhaItemVenda & {
  quantity: number;
  total_cents: number;
};

type Coluna = 'qtd' | 'unit' | 'desc';

interface TabelaItensVendaProps {
  /** Prefixo dos ids na tela (`orc`, `pdv`): dois editores abertos não se confundem. */
  idPrefixo: string;
  itens: LinhaItemCalculada[];
  somenteLeitura?: boolean;
  /** Mostra o custo na lista de busca (só nível financeiro completo). */
  podeVerCusto: boolean;
  /** Coluna própria para o código (sem ela, o código aparece antes do nome). */
  colunaCodigo?: boolean;
  focarBuscaAoAbrir?: boolean;
  placeholderBusca?: string;
  onAdicionar: (item: CatalogItem, quantidade: number) => void;
  onAtualizar: (uid: string, parcial: Partial<LinhaItemVenda>) => void;
  onRemover: (uid: string) => void;
  onItemAvulso: () => void;
  /** Se informado, a linha ganha a alça de arrastar (reordena dentro do grupo). */
  onReordenar?: (kind: CatalogItemKind, de: number, para: number) => void;
}

const CAMPO_CELULA =
  'block w-full rounded-md border border-slate-300 bg-white px-1.5 py-1 text-right text-xs text-slate-800 tabular-nums focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

const GRUPOS: { kind: CatalogItemKind; rotulo: string }[] = [
  { kind: 'produto', rotulo: 'Produtos' },
  { kind: 'servico', rotulo: 'Serviços' },
];

function estoqueInsuficiente(item: LinhaItemCalculada): boolean {
  return (
    item.kind === 'produto' && !!item.controlsStock && item.stockQuantity !== undefined && item.quantity > item.stockQuantity
  );
}

function ehCodigoExato(item: CatalogItem, termo: string): boolean {
  const t = termo.trim().toLowerCase();
  return item.code.toLowerCase() === t || (!!item.barcode && item.barcode.toLowerCase() === t);
}

export default function TabelaItensVenda({
  idPrefixo,
  itens,
  somenteLeitura = false,
  podeVerCusto,
  colunaCodigo = true,
  focarBuscaAoAbrir = false,
  placeholderBusca = 'Incluir item: código, código de barras ou nome...',
  onAdicionar,
  onAtualizar,
  onRemover,
  onItemAvulso,
  onReordenar,
}: TabelaItensVendaProps) {
  const idBusca = `${idPrefixo}-busca-item`;
  const idQtdNova = `${idPrefixo}-inclusao-qtd`;
  const [qtdNova, setQtdNova] = useState('');
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState(false);
  // A lista guarda para qual texto foi buscada: Enter antes de a busca voltar (leitor de código de barras) busca na hora
  const [resultado, setResultado] = useState<{ termo: string; lista: CatalogItem[] }>({ termo: '', lista: [] });
  const sugestoes = resultado.lista;

  useEffect(() => {
    if (!aberta) return;
    let ativo = true;
    const termo = busca;
    const timer = setTimeout(() => {
      buscarItensParaBusca(termo)
        .then((lista) => {
          if (ativo) setResultado({ termo, lista });
        })
        .catch(() => {});
    }, 100);
    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [busca, aberta]);

  useEffect(() => {
    if (focarBuscaAoAbrir) document.getElementById(idQtdNova)?.focus();
  }, [focarBuscaAoAbrir, idQtdNova]);

  const focarInclusao = () => document.getElementById(idQtdNova)?.focus();

  const incluir = (item: CatalogItem, quantidadeFixa?: number) => {
    const digitada = Number(qtdNova.trim().replace(',', '.'));
    onAdicionar(item, quantidadeFixa ?? (digitada > 0 ? digitada : 1));
    setQtdNova('');
    setBusca('');
    setAberta(false);
    focarInclusao();
  };

  /** Inclui direto se o texto for o código exato de um item; senão, mostra a lista na busca. */
  const procurarEIncluir = (texto: string, quantidadeFixa?: number) => {
    void buscarItensParaBusca(texto).then((lista) => {
      if (lista[0] && ehCodigoExato(lista[0], texto.trim())) incluir(lista[0], quantidadeFixa);
      else {
        setBusca(texto);
        setResultado({ termo: texto, lista });
        setAberta(true);
        document.getElementById(idBusca)?.focus();
      }
    });
  };

  const mudarQtdNova = (valor: string) => {
    // Letra no campo da quantidade = começou a digitar o nome: passa para a busca
    if (/[^\d.,\s]/.test(valor)) {
      setQtdNova('');
      setBusca(valor.trim());
      setAberta(true);
      document.getElementById(idBusca)?.focus();
      return;
    }
    setQtdNova(valor);
  };

  const teclarNaQtdNova = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault(); // Enter aqui nunca envia o formulário
    const texto = qtdNova.trim();
    if (/^\d{6,}$/.test(texto)) {
      // Leitor de código de barras: o que está no campo é o código, não a quantidade
      setQtdNova('');
      procurarEIncluir(texto, 1);
      return;
    }
    document.getElementById(idBusca)?.focus();
  };

  const listaVisivel = aberta && sugestoes.length > 0;
  const teclas = useNavegacaoLista({
    itens: sugestoes,
    aberta: listaVisivel,
    idPrefixo: `${idPrefixo}-sugestao`,
    aoEscolher: (item: CatalogItem) => incluir(item),
    aoAbrir: () => setAberta(true),
    aoFechar: () => setAberta(false),
  });

  const teclarNaBusca = (e: KeyboardEvent<HTMLInputElement>) => {
    const termo = busca.trim();
    if (e.key === 'Enter' && termo && resultado.termo !== busca) {
      // A lista ainda é de outro texto: busca agora e inclui direto se o código bater
      e.preventDefault();
      procurarEIncluir(busca);
      return;
    }
    if (!teclas.aoTeclar(e) && e.key === 'Enter') e.preventDefault(); // Enter aqui nunca envia o formulário
  };

  const ordem = GRUPOS.flatMap((g) => itens.filter((i) => i.kind === g.kind));

  /** Enter volta para a inclusão; ↓/↑ vão para o mesmo campo da linha de baixo/cima. */
  const teclarNaCelula = (e: KeyboardEvent<HTMLInputElement>, uid: string, coluna: Coluna) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      focarInclusao();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const pos = ordem.findIndex((l) => l.uid === uid);
    const alvo = ordem[pos + (e.key === 'ArrowDown' ? 1 : -1)];
    if (alvo) {
      const campo = document.getElementById(`${idPrefixo}-${coluna}-${alvo.uid}`) as HTMLInputElement | null;
      campo?.focus();
      campo?.select();
    } else if (e.key === 'ArrowDown') {
      focarInclusao();
    }
  };

  const aoSoltar = (r: DropResult) => {
    if (!onReordenar || !r.destination || r.destination.droppableId !== r.source.droppableId) return;
    if (r.destination.index === r.source.index) return;
    onReordenar(r.source.droppableId === `${idPrefixo}-produto` ? 'produto' : 'servico', r.source.index, r.destination.index);
  };

  const arrastavel = !!onReordenar && !somenteLeitura;
  const totalColunas = 6 + (colunaCodigo ? 1 : 0) + (arrastavel ? 1 : 0) + (somenteLeitura ? 0 : 1);

  const celulaCampo = (
    item: LinhaItemCalculada,
    coluna: Coluna,
    valor: string,
    aoMudar: (v: string) => void,
    placeholder?: string,
  ) =>
    somenteLeitura ? (
      <span className="block px-1.5 text-right text-xs tabular-nums">
        {!valor ? '-' : coluna === 'desc' && item.discountMode === 'percentual' ? `${valor}%` : valor}
      </span>
    ) : (
      <input
        id={`${idPrefixo}-${coluna}-${item.uid}`}
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        onKeyDown={(e) => teclarNaCelula(e, item.uid, coluna)}
        onFocus={(e) => e.target.select()}
        placeholder={placeholder}
        aria-label={`${coluna === 'qtd' ? 'Quantidade' : coluna === 'unit' ? 'Valor unitário' : 'Desconto'} de ${item.name}`}
        className={`${CAMPO_CELULA} ${coluna === 'desc' ? 'pl-6' : ''}`}
      />
    );

  const linha = (item: LinhaItemCalculada, idx: number) => (
    <Draggable key={item.uid} draggableId={item.uid} index={idx} isDragDisabled={!arrastavel}>
      {(arraste) => (
        <tr ref={arraste.innerRef} {...arraste.draggableProps} className="border-t border-slate-200 bg-white">
          {arrastavel && (
            <td className="pl-1.5">
              <span {...arraste.dragHandleProps} title="Arraste para reordenar" className="flex cursor-grab text-slate-500 hover:text-slate-600">
                <GripVertical size={14} />
              </span>
            </td>
          )}
          <td className="px-1 py-1">
            <div className="flex items-center gap-1">
              {estoqueInsuficiente(item) && (
                <span title={`Estoque insuficiente (saldo: ${item.stockQuantity} ${item.unit})`} className="shrink-0 text-amber-500">
                  <AlertTriangle size={13} />
                </span>
              )}
              {celulaCampo(item, 'qtd', item.quantityTexto, (v) => onAtualizar(item.uid, { quantityTexto: v }))}
            </div>
          </td>
          <td className="px-1 py-1 text-xs text-slate-700">{item.unit}</td>
          {colunaCodigo && <td className="truncate px-1 py-1 font-mono text-[11px] text-slate-700">{item.code}</td>}
          <td className="px-1 py-1 text-xs leading-snug break-words text-slate-900">
            {!colunaCodigo && <span className="mr-1.5 font-mono text-[11px] text-slate-600">{item.code}</span>}
            {item.name}
          </td>
          <td className="px-1 py-1">
            {celulaCampo(item, 'unit', item.unitPriceTexto, (v) => onAtualizar(item.uid, { unitPriceTexto: v }))}
          </td>
          <td className="px-1 py-1">
            <div className="relative">
              {celulaCampo(
                item,
                'desc',
                item.discountTexto,
                (v) => onAtualizar(item.uid, { discountTexto: v }),
                item.discountMode === 'valor' ? '0,00' : '0%',
              )}
              {!somenteLeitura && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() =>
                    onAtualizar(item.uid, {
                      discountMode: item.discountMode === 'valor' ? 'percentual' : 'valor',
                      discountTexto: '',
                    })
                  }
                  title={item.discountMode === 'valor' ? 'Desconto em R$ (clique para usar %)' : 'Desconto em % (clique para usar R$)'}
                  className="absolute inset-y-0 left-0 px-1.5 text-[10px] font-semibold text-blue-600 hover:underline"
                >
                  {item.discountMode === 'valor' ? 'R$' : '%'}
                </button>
              )}
            </div>
          </td>
          <td className="px-1.5 py-1 text-right text-xs font-semibold text-slate-900 tabular-nums">{formatarReais(item.total_cents)}</td>
          {!somenteLeitura && (
            <td className="pr-1.5 text-right">
              <button
                type="button"
                tabIndex={-1}
                onClick={() => onRemover(item.uid)}
                aria-label={`Remover ${item.name}`}
                className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={13} />
              </button>
            </td>
          )}
        </tr>
      )}
    </Draggable>
  );

  return (
    <div className="rounded-xl border border-slate-300">
      <div className="overflow-x-auto">
        <DragDropContext onDragEnd={aoSoltar}>
          <table className={`w-full table-fixed border-collapse ${colunaCodigo ? 'min-w-[620px]' : 'min-w-[520px]'}`}>
            <colgroup>
              {arrastavel && <col className="w-6" />}
              <col className="w-24" />
              <col className="w-10" />
              {colunaCodigo && <col className="w-28" />}
              <col />
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-24" />
              {!somenteLeitura && <col className="w-8" />}
            </colgroup>
            <thead className="bg-slate-200/70 text-[11px] font-semibold text-slate-700">
              <tr>
                {arrastavel && <th />}
                <th className="px-1 py-2 text-right font-semibold">Qtd.</th>
                <th className="px-1 py-2 text-left font-semibold">Un.</th>
                {colunaCodigo && <th className="px-1 py-2 text-left font-semibold">Código</th>}
                <th className="px-1 py-2 text-left font-semibold">Descrição</th>
                <th className="px-1 py-2 text-right font-semibold">Unitário</th>
                <th className="px-1 py-2 text-right font-semibold">Desconto</th>
                <th className="px-1.5 py-2 text-right font-semibold">Total</th>
                {!somenteLeitura && <th />}
              </tr>
            </thead>
            {itens.length === 0 && (
              <tbody>
                <tr>
                  <td colSpan={totalColunas} className="border-t border-slate-200 px-3 py-4 text-center text-xs text-slate-600">
                    Nenhum item incluído.
                  </td>
                </tr>
              </tbody>
            )}
            {GRUPOS.map((g) => {
              const doGrupo = itens.filter((i) => i.kind === g.kind);
              if (doGrupo.length === 0) return null;
              const subtotal = doGrupo.reduce((s, i) => s + i.total_cents, 0);
              return (
                <Droppable key={g.kind} droppableId={`${idPrefixo}-${g.kind}`}>
                  {(soltar) => (
                    <tbody ref={soltar.innerRef} {...soltar.droppableProps}>
                      <tr className="border-t border-slate-300 bg-slate-100">
                        <td colSpan={totalColunas - (somenteLeitura ? 1 : 2)} className="px-2 py-1 text-[11px] font-bold text-slate-700">
                          {g.rotulo} ({doGrupo.length})
                        </td>
                        <td className="px-1.5 py-1 text-right text-[11px] font-bold text-slate-700 tabular-nums">
                          {formatarReais(subtotal)}
                        </td>
                        {!somenteLeitura && <td />}
                      </tr>
                      {doGrupo.map((item, idx) => linha(item, idx))}
                      {soltar.placeholder}
                    </tbody>
                  )}
                </Droppable>
              );
            })}
          </table>
        </DragDropContext>
      </div>

      {!somenteLeitura && (
        <div className="relative flex items-center gap-2 border-t border-dashed border-slate-300 px-2 py-1.5">
          <Plus size={14} className="shrink-0 text-slate-600" />
          <input
            id={idQtdNova}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={qtdNova}
            onChange={(e) => mudarQtdNova(e.target.value)}
            onKeyDown={teclarNaQtdNova}
            onFocus={(e) => e.target.select()}
            placeholder="Qtd. 1"
            aria-label="Quantidade do item a incluir (vazio = 1)"
            className="w-20 shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-right text-sm text-slate-800 tabular-nums placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
          <input
            id={idBusca}
            type="text"
            autoCorrect="off"
            spellCheck={false}
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setAberta(true);
            }}
            onFocus={() => setAberta(true)}
            onBlur={() => setTimeout(() => setAberta(false), 180)}
            onKeyDown={teclarNaBusca}
            role="combobox"
            aria-expanded={listaVisivel}
            aria-controls={`${idPrefixo}-sugestoes`}
            aria-activedescendant={listaVisivel ? `${idPrefixo}-sugestao-${teclas.ativo}` : undefined}
            placeholder={placeholderBusca}
            className="min-w-0 flex-1 rounded-md border border-transparent px-1.5 py-1 text-sm text-slate-800 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={onItemAvulso}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Item avulso
          </button>

          {listaVisivel && (
            <div className="absolute top-full right-0 left-0 z-30 mt-1 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
              <div
                className={`grid gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700 ${
                  podeVerCusto ? 'grid-cols-[7rem_1fr_4.5rem_5rem_5.5rem_2.5rem]' : 'grid-cols-[7rem_1fr_4.5rem_5.5rem_2.5rem]'
                }`}
              >
                <span>Código</span>
                <span>Descrição</span>
                <span className="text-right">Estoque</span>
                {podeVerCusto && <span className="text-right">Custo</span>}
                <span className="text-right">Valor</span>
                <span>Un.</span>
              </div>
              <ul id={`${idPrefixo}-sugestoes`} role="listbox" className="max-h-72 overflow-y-auto">
                {sugestoes.map((item, idx) => (
                  <li key={item.id} id={`${idPrefixo}-sugestao-${idx}`} role="option" aria-selected={idx === teclas.ativo}>
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(e) => {
                        e.preventDefault(); // o clique não pode tirar o cursor do campo da quantidade
                        incluir(item);
                      }}
                      onMouseEnter={() => teclas.setAtivo(idx)}
                      className={`grid w-full items-center gap-2 px-3 py-1.5 text-left text-xs ${
                        podeVerCusto ? 'grid-cols-[7rem_1fr_4.5rem_5rem_5.5rem_2.5rem]' : 'grid-cols-[7rem_1fr_4.5rem_5.5rem_2.5rem]'
                      } ${idx === teclas.ativo ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                    >
                      <span className="truncate font-mono text-[11px] text-slate-700">{item.code}</span>
                      <span className="truncate text-slate-900">
                        {item.name}
                        {item.kind === 'servico' && <span className="ml-1.5 text-[10px] text-slate-600">Serviço</span>}
                      </span>
                      <span className="text-right text-slate-700 tabular-nums">
                        {item.kind === 'produto' && item.controls_stock ? String(item.stock_quantity).replace('.', ',') : '-'}
                      </span>
                      {podeVerCusto && (
                        <span className="text-right text-slate-700 tabular-nums">
                          {item.cost_price_cents != null ? formatarReais(item.cost_price_cents) : '-'}
                        </span>
                      )}
                      <span className="text-right font-semibold text-slate-900 tabular-nums">{formatarReais(item.sale_price_cents)}</span>
                      <span className="text-slate-700">{item.unit}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
