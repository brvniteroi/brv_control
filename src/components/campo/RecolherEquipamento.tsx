// App de campo: o técnico registra o que está levando para a oficina (fase 3 do módulo Oficina).
// O item nasce "Em trânsito", ligado à OS e à atividade, com o técnico como quem recolheu; aparece na hora
// no Kanban da Oficina. Precisa de internet (como os formulários); as fotos sobem logo depois de salvar.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, PackagePlus, Truck, X } from 'lucide-react';
import { anexarFotoItem, itensDaAtividade, recolherNoCampo } from '../../services/oficina';
import type { AtividadeCampo } from '../../services/campo';
import type { ItemOficina, NovoItemOficina, UnidadeRecolhida } from '../../types/oficina';
import { ROTULO_ETAPA, ROTULO_UNIDADE, ROTULO_UNIDADE_CURTO, TENSOES, TIPOS_EQUIPAMENTO } from '../../utils/oficina';

const CAMPO =
  'mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none';
const TEXTO = `${CAMPO} resize-none [field-sizing:content] min-h-[4.5rem]`;
const ROTULO = 'block text-xs font-semibold text-slate-600';

type Equipamento = NonNullable<NonNullable<AtividadeCampo['ordem']>['equipamentos'][number]['equipamento']>;

interface Props {
  taskId: string;
  osNumero: number | null;
  /** Equipamentos ligados à OS (para preencher tipo/marca/modelo com um toque) */
  equipamentosDaOs: Equipamento[];
  online: boolean;
  /** Pode registrar retirada (atividade a caminho, em execução ou concluída) */
  podeRecolher: boolean;
}

export default function RecolherEquipamento({ taskId, osNumero, equipamentosDaOs, online, podeRecolher }: Props) {
  const [itens, setItens] = useState<ItemOficina[]>([]);
  const [abrindo, setAbrindo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(() => {
    if (!online) return;
    itensDaAtividade(taskId).then(setItens).catch(() => {
      /* sem sinal: mantém a lista anterior */
    });
  }, [taskId, online]);

  useEffect(carregar, [carregar]);

  return (
    <div>
      {itens.length > 0 && (
        <ul className="mb-3 space-y-2">
          {itens.map((i) => (
            <li key={i.id} className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-2.5">
              <Truck size={16} className="mt-0.5 shrink-0 text-blue-600" />
              <div className="min-w-0 text-xs">
                <div className="font-semibold text-slate-800">
                  {osNumero ? `OS ${osNumero}${itens.length > 1 ? ` · item ${i.item_number}` : ''}` : `Item ${i.item_number}`}
                  {' · '}
                  {ROTULO_UNIDADE_CURTO[i.units_collected]}
                </div>
                <div className="text-slate-500">{[i.equipment_type, i.brand, i.model].filter(Boolean).join(' ')}</div>
                <div className="mt-0.5 font-medium text-slate-600">
                  {i.status === 'em_transito' ? 'A caminho da loja' : `Na oficina: ${ROTULO_ETAPA[i.status]}`}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {aviso && <p className="mb-2 rounded-lg bg-green-50 px-2.5 py-2 text-xs font-medium text-green-800">{aviso}</p>}

      {!podeRecolher ? (
        <p className="text-xs text-slate-500">Inicie o atendimento para registrar um equipamento levado para a oficina.</p>
      ) : !online ? (
        <p className="text-xs text-slate-500">Registrar a retirada precisa de internet. Registre quando tiver sinal.</p>
      ) : (
        <button
          type="button"
          onClick={() => {
            setAviso(null);
            setAbrindo(true);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 py-3.5 text-sm font-bold text-blue-700 active:bg-blue-100"
        >
          <PackagePlus size={18} /> Recolher equipamento
        </button>
      )}

      {abrindo && (
        <FormularioRetirada
          taskId={taskId}
          equipamentosDaOs={equipamentosDaOs}
          onFechar={() => setAbrindo(false)}
          onSalvo={(msg) => {
            setAbrindo(false);
            setAviso(msg);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function FormularioRetirada({
  taskId,
  equipamentosDaOs,
  onFechar,
  onSalvo,
}: {
  taskId: string;
  equipamentosDaOs: Equipamento[];
  onFechar: () => void;
  onSalvo: (mensagem: string) => void;
}) {
  const [tipo, setTipo] = useState('');
  const [unidade, setUnidade] = useState<UnidadeRecolhida | ''>('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [tensao, setTensao] = useState('');
  const [acessorios, setAcessorios] = useState('');
  const [defeito, setDefeito] = useState('');
  const [relato, setRelato] = useState('');
  const [equipamentoId, setEquipamentoId] = useState<string | null>(null);
  const [fotos, setFotos] = useState<File[]>([]);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  const escolherEquipamento = (eq: Equipamento) => {
    setEquipamentoId(eq.id);
    setTipo(eq.category);
    setMarca(eq.brand ?? '');
    setModelo(eq.model ?? '');
  };

  const salvar = async () => {
    setErro(null);
    if (!tipo.trim()) return setErro('Informe o tipo de equipamento.');
    if (!unidade) return setErro('Escolha o que está levando.');
    if (!defeito.trim()) return setErro('Descreva o defeito.');

    const dados: NovoItemOficina = {
      equipment_type: tipo.trim(),
      units_collected: unidade,
      brand: marca.trim() || null,
      model: modelo.trim() || null,
      voltage: tensao || null,
      accessories: acessorios.trim() || null,
      reported_defect: defeito.trim(),
      field_report: relato.trim() || null,
      equipment_id: equipamentoId,
    };

    setSalvando('Registrando...');
    let id: string;
    try {
      id = await recolherNoCampo(taskId, dados);
    } catch (e) {
      setSalvando(null);
      setErro(e instanceof Error ? e.message : 'Não foi possível registrar. Tente de novo.');
      return;
    }

    // O item já está salvo: fotos que falharem não desfazem o registro
    let falhas = 0;
    for (let i = 0; i < fotos.length; i++) {
      setSalvando(`Enviando fotos (${i + 1} de ${fotos.length})...`);
      try {
        await anexarFotoItem(fotos[i], id, 'antes', 'Foto da retirada no cliente');
      } catch {
        falhas++;
      }
    }
    setSalvando(null);
    onSalvo(
      falhas > 0
        ? `Retirada registrada, mas ${falhas} foto(s) não subiram. A oficina tira de novo na chegada.`
        : 'Retirada registrada. A oficina já está vendo.',
    );
  };

  const preenchido = Boolean(tipo || unidade || marca || modelo || defeito || relato || acessorios || fotos.length);
  const fechar = () => {
    if (salvando) return;
    if (preenchido && !window.confirm('Descartar o que foi preenchido?')) return;
    onFechar();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50" role="dialog" aria-modal="true" aria-labelledby="recolher-titulo">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3">
        <button type="button" onClick={fechar} className="rounded-lg p-1.5 text-slate-600" aria-label="Fechar">
          <X size={22} />
        </button>
        <h2 id="recolher-titulo" className="text-base font-bold text-slate-900">Recolher equipamento</h2>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {equipamentosDaOs.length > 0 && (
          <div>
            <span className={ROTULO}>Equipamento desta OS (toque para preencher)</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {equipamentosDaOs.map((eq) => (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => escolherEquipamento(eq)}
                  className={`rounded-xl border px-3 py-2 text-left text-xs ${
                    equipamentoId === eq.id ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <b>{eq.category}</b>
                  {[eq.brand, eq.model].some(Boolean) && <span> · {[eq.brand, eq.model].filter(Boolean).join(' ')}</span>}
                  {eq.location && <span className="block text-slate-500">{eq.location}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <span className={ROTULO}>O que está levando *</span>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {(Object.keys(ROTULO_UNIDADE) as UnidadeRecolhida[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnidade(u)}
                className={`rounded-xl border px-2 py-3 text-sm font-semibold ${
                  unidade === u ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700'
                } ${u === 'aparelho' ? 'col-span-2' : ''}`}
              >
                {ROTULO_UNIDADE[u]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="rec-tipo" className={ROTULO}>Tipo de equipamento *</label>
          <input id="rec-tipo" list="rec-tipos" value={tipo} onChange={(e) => setTipo(e.target.value)} className={CAMPO} placeholder="Ex.: Split Hi-Wall" />
          <datalist id="rec-tipos">
            {TIPOS_EQUIPAMENTO.map((t) => <option key={t} value={t} />)}
          </datalist>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="rec-marca" className={ROTULO}>Marca</label>
            <input id="rec-marca" value={marca} onChange={(e) => setMarca(e.target.value)} className={CAMPO} />
          </div>
          <div>
            <label htmlFor="rec-modelo" className={ROTULO}>Modelo</label>
            <input id="rec-modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} className={CAMPO} />
          </div>
        </div>

        <div>
          <span className={ROTULO}>Tensão</span>
          <div className="mt-1.5 flex gap-2">
            {TENSOES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTensao(tensao === t ? '' : t)}
                className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold ${
                  tensao === t ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="rec-defeito" className={ROTULO}>Defeito *</label>
          <textarea id="rec-defeito" rows={2} value={defeito} onChange={(e) => setDefeito(e.target.value)} className={TEXTO}
            placeholder="Ex.: Não gela, erro E1, barulho no motor..." />
        </div>

        <div>
          <label htmlFor="rec-acessorios" className={ROTULO}>Acessórios que foram junto</label>
          <input id="rec-acessorios" value={acessorios} onChange={(e) => setAcessorios(e.target.value)} className={CAMPO}
            placeholder="Ex.: controle remoto, suporte" />
        </div>

        <div>
          <label htmlFor="rec-relato" className={ROTULO}>Observações para a oficina</label>
          <textarea id="rec-relato" rows={3} value={relato} onChange={(e) => setRelato(e.target.value)} className={TEXTO}
            placeholder="O que já testou, o que suspeita... (vazio: usa as observações da atividade)" />
        </div>

        <div>
          <span className={ROTULO}>Fotos (opcional)</span>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => camera.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white active:bg-slate-900">
              <Camera size={18} /> Tirar foto
            </button>
            <button type="button" onClick={() => galeria.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700">
              <ImagePlus size={18} /> Galeria
            </button>
          </div>
          <input ref={camera} type="file" accept="image/*" capture="environment" hidden
            onChange={(e) => { const f = e.target.files; if (f?.length) setFotos((a) => [...a, ...f]); e.target.value = ''; }} />
          <input ref={galeria} type="file" accept="image/*" multiple hidden
            onChange={(e) => { const f = e.target.files; if (f?.length) setFotos((a) => [...a, ...f]); e.target.value = ''; }} />
          {fotos.length > 0 && (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {fotos.map((f, i) => (
                <Miniatura key={`${f.name}-${i}`} arquivo={f} onRemover={() => setFotos((a) => a.filter((_, j) => j !== i))} />
              ))}
            </div>
          )}
        </div>

        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{erro}</p>}
      </div>

      <div className="border-t border-slate-200 bg-white p-3">
        <button
          type="button"
          onClick={salvar}
          disabled={!!salvando}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white active:bg-blue-700 disabled:opacity-60"
        >
          {salvando ? <Loader2 size={18} className="animate-spin" /> : <Truck size={18} />}
          {salvando ?? 'Registrar retirada'}
        </button>
      </div>
    </div>
  );
}

function Miniatura({ arquivo, onRemover }: { arquivo: File; onRemover: () => void }) {
  const [url] = useState(() => URL.createObjectURL(arquivo));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
      <img src={url} alt="" className="h-full w-full object-cover" />
      <button type="button" onClick={onRemover} className="absolute right-0.5 top-0.5 rounded-full bg-white/90 p-0.5 text-slate-700" aria-label="Remover foto">
        <X size={14} />
      </button>
    </div>
  );
}
