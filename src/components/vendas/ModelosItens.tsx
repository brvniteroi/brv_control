import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import {
  abrirModelo,
  excluirModelo,
  listarModelos,
  salvarModelo,
  type ItemDoModelo,
  type ModeloOrcamento,
} from '../../services/modelosOrcamento';
import type { LinhaItemVenda } from './TabelaItensVenda';

const BOTAO =
  'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50';

interface ModelosItensProps {
  /** Linhas atuais, para o "Salvar como modelo". */
  linhas: LinhaItemVenda[];
  onAplicar: (itens: ItemDoModelo[]) => void;
}

/**
 * Botões dos modelos de orçamento acima da tabela de itens (pedido do Braulio, 2026-11-25): um clique inclui os itens com o
 * preço atual do catálogo e a quantidade em branco (a mão de obra vem preenchida).
 */
export default function ModelosItens({ linhas, onAplicar }: ModelosItensProps) {
  const [modelos, setModelos] = useState<ModeloOrcamento[]>([]);
  const [excluindo, setExcluindo] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(() => listarModelos().then(setModelos), []);

  useEffect(() => {
    carregar().catch(() => setAviso('Não foi possível carregar os modelos.'));
  }, [carregar]);

  const mensagem = (e: unknown, padrao: string) => (e instanceof Error ? e.message : padrao);

  const clicar = async (modelo: ModeloOrcamento) => {
    setAviso(null);
    if (excluindo) {
      if (!window.confirm(`Excluir o modelo "${modelo.name}"? Orçamentos e vendas já feitos não mudam.`)) return;
      try {
        await excluirModelo(modelo.id);
        await carregar();
        setExcluindo(false);
      } catch (e) {
        setAviso(mensagem(e, 'Não foi possível excluir o modelo.'));
      }
      return;
    }
    setOcupado(modelo.id);
    try {
      const { itens, foraDoCatalogo } = await abrirModelo(modelo);
      if (foraDoCatalogo.length > 0) setAviso(`Fora do modelo por estarem inativos: ${foraDoCatalogo.join(', ')}.`);
      onAplicar(itens);
    } catch (e) {
      setAviso(mensagem(e, 'Não foi possível abrir o modelo.'));
    } finally {
      setOcupado(null);
    }
  };

  const salvarAtual = async () => {
    setAviso(null);
    const doCatalogo = linhas.filter((l) => !l.is_custom && l.catalog_item_id);
    if (doCatalogo.length === 0) {
      setAviso('Inclua itens do catálogo antes de salvar um modelo (item avulso não entra).');
      return;
    }
    const nome = window.prompt('Nome do botão (ex.: Instalação split 12.000):', '')?.trim();
    if (!nome) return;
    const jaExiste = modelos.find((m) => m.name.trim().toLowerCase() === nome.toLowerCase());
    if (jaExiste && !window.confirm(`Já existe o modelo "${jaExiste.name}". Substituir os itens dele pelos desta tela?`)) return;
    // Produto fica sem quantidade; serviço (mão de obra) guarda a que está na tela
    const itens = doCatalogo.map((l) => {
      const qtd = Number(l.quantityTexto.trim().replace(',', '.'));
      return { catalog_item_id: l.catalog_item_id as string, quantity: l.kind === 'servico' && qtd > 0 ? qtd : null };
    });
    try {
      await salvarModelo(nome, itens, !!jaExiste);
      await carregar();
      const avulsos = linhas.length - doCatalogo.length;
      setAviso(`Modelo "${nome}" salvo.${avulsos > 0 ? ' Item avulso não entra no modelo.' : ''}`);
    } catch (e) {
      setAviso(mensagem(e, 'Não foi possível salvar o modelo.'));
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold text-slate-700">{excluindo ? 'Excluir qual modelo?' : 'Modelos:'}</span>
        {modelos.map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={ocupado !== null}
            onClick={() => void clicar(m)}
            className={`${BOTAO} ${
              excluindo
                ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            {ocupado === m.id ? (
              <Loader2 size={13} className="animate-spin" />
            ) : excluindo ? (
              <Trash2 size={13} />
            ) : (
              <Plus size={13} />
            )}
            {m.name}
          </button>
        ))}
        {modelos.length === 0 && <span className="text-xs text-slate-500">nenhum ainda</span>}

        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {excluindo ? (
            <button
              type="button"
              onClick={() => setExcluindo(false)}
              className={`${BOTAO} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
            >
              <X size={13} /> Cancelar
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void salvarAtual()}
                className={`${BOTAO} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
              >
                <Save size={13} /> Salvar como modelo
              </button>
              {modelos.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExcluindo(true)}
                  className={`${BOTAO} border-transparent text-slate-500 hover:text-red-700`}
                >
                  Excluir modelo
                </button>
              )}
            </>
          )}
        </span>
      </div>
      {aviso && <p className="text-xs font-medium text-amber-700">{aviso}</p>}
    </div>
  );
}
