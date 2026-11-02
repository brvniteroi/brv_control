import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import type { Tag } from '../../types/fsm';
import { COR_PADRAO_ETIQUETA, criarEtiqueta, listarEtiquetas } from '../../services/etiquetas';
import { semAcento } from '../../services/clientes';
import EtiquetaChip from './EtiquetaChip';
import SeletorCor from './SeletorCor';

interface SeletorEtiquetasProps {
  titulo?: string;
  selecionadas: Tag[];
  onConfirmar: (etiquetas: Tag[]) => void | Promise<void>;
  onFechar: () => void;
}

/** Marca etiquetas do catálogo ou cria uma nova (digitando um nome que ainda não existe). */
export default function SeletorEtiquetas({ titulo = 'Etiquetas', selecionadas, onConfirmar, onFechar }: SeletorEtiquetasProps) {
  const [catalogo, setCatalogo] = useState<Tag[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [marcadas, setMarcadas] = useState<Set<string>>(() => new Set(selecionadas.map((t) => t.id)));
  const [termo, setTermo] = useState('');
  const [cor, setCor] = useState(COR_PADRAO_ETIQUETA);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarEtiquetas()
      .then(setCatalogo)
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar as etiquetas.'))
      .finally(() => setCarregando(false));
  }, []);

  const chave = semAcento(termo.trim());
  const filtradas = useMemo(
    () => (chave ? catalogo.filter((t) => semAcento(t.name).includes(chave)) : catalogo),
    [catalogo, chave],
  );
  const existeIgual = catalogo.some((t) => semAcento(t.name.trim()) === chave);

  const alternar = (id: string) =>
    setMarcadas((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const criar = async () => {
    setErro(null);
    try {
      const nova = await criarEtiqueta(termo, cor);
      setCatalogo((prev) => [...prev, nova].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
      setMarcadas((prev) => new Set(prev).add(nova.id));
      setTermo('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível criar a etiqueta.');
    }
  };

  const confirmar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      await onConfirmar(catalogo.filter((t) => marcadas.has(t.id)));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar as etiquetas.');
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">{titulo}</h3>
          <button type="button" onClick={onFechar} className="text-slate-400 hover:text-slate-600" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <input
          type="text"
          autoFocus
          maxLength={40}
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && termo.trim() && !existeIgual) {
              e.preventDefault();
              criar();
            }
          }}
          placeholder="Buscar ou criar (ex.: Aguardando pagamento, Pago)"
          className="mt-3 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />

        {termo.trim() && !existeIgual && (
          <div className="mt-3 rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-3">
            <SeletorCor cor={cor} onMudar={setCor} pequeno />
            <button
              type="button"
              onClick={criar}
              className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline"
            >
              <Plus size={14} /> Criar
              <EtiquetaChip etiqueta={{ name: termo.trim(), color: cor }} pequena />
            </button>
          </div>
        )}

        <div className="mt-3 min-h-24 flex-1 space-y-1 overflow-y-auto">
          {carregando ? (
            <p className="py-6 text-center text-xs text-slate-400">Carregando...</p>
          ) : filtradas.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">
              {catalogo.length === 0 ? 'Nenhuma etiqueta criada ainda. Digite um nome acima.' : 'Nenhuma etiqueta com esse nome.'}
            </p>
          ) : (
            filtradas.map((t) => {
              const marcada = marcadas.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => alternar(t.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      marcada ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                    }`}
                  >
                    {marcada && <Check size={12} />}
                  </span>
                  <EtiquetaChip etiqueta={t} />
                </button>
              );
            })
          )}
        </div>

        {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}

        <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvando}
            onClick={confirmar}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Aplicar'}
          </button>
        </div>
      </div>
    </div>
  );
}
