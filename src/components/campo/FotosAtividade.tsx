import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { compactarImagem } from '../../services/anexos';
import { fotosDaAtividade } from '../../services/campo';
import { descartarItem, enfileirarFoto, type ItemFoto } from '../../services/filaCampo';
import { useFilaCampo, useOnline } from '../../hooks/useCampo';
import type { Attachment, AttachmentCategory } from '../../types/fsm';

const CATEGORIAS: { valor: AttachmentCategory; rotulo: string }[] = [
  { valor: 'antes', rotulo: 'Antes' },
  { valor: 'depois', rotulo: 'Depois' },
  { valor: 'placa_equipamento', rotulo: 'Placa' },
  { valor: 'outros', rotulo: 'Outros' },
];
const rotulo = (c: AttachmentCategory) => CATEGORIAS.find((x) => x.valor === c)?.rotulo ?? 'Foto';

interface FotosAtividadeProps {
  taskId: string;
  serviceOrderId: string;
}

/** Fotos da atividade: as enviadas (do servidor) e as que ainda estão na fila do aparelho. */
export default function FotosAtividade({ taskId, serviceOrderId }: FotosAtividadeProps) {
  const fila = useFilaCampo();
  const online = useOnline();
  const [enviadas, setEnviadas] = useState<Attachment[]>([]);
  const [categoria, setCategoria] = useState<AttachmentCategory>('antes');
  const [preparando, setPreparando] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  const pendentes = useMemo(
    () => fila.filter((i): i is ItemFoto => i.tipo === 'foto' && i.taskId === taskId && i.categoria !== 'assinatura'),
    [fila, taskId],
  );

  // Recarrega as enviadas quando a fila desta atividade diminui (uma foto acabou de subir)
  const qtdPendentes = pendentes.length;
  useEffect(() => {
    if (!online) return;
    fotosDaAtividade(taskId)
      .then(setEnviadas)
      .catch(() => {
        /* sem sinal: mostra só as pendentes */
      });
  }, [taskId, qtdPendentes, online]);

  const adicionar = async (arquivos: FileList | null) => {
    if (!arquivos?.length) return;
    setErro(null);
    const lista = [...arquivos];
    setPreparando((n) => n + lista.length);
    for (const arquivo of lista) {
      try {
        const compacta = await compactarImagem(arquivo);
        await enfileirarFoto(taskId, serviceOrderId, compacta, { categoria });
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível preparar a foto.');
      } finally {
        setPreparando((n) => n - 1);
      }
    }
  };

  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {CATEGORIAS.map((c) => (
          <button
            key={c.valor}
            type="button"
            onClick={() => setCategoria(c.valor)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
              categoria === c.valor ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            {c.rotulo}
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => camera.current?.click()}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white active:bg-blue-700"
        >
          <Camera size={18} /> Tirar foto
        </button>
        <button
          type="button"
          onClick={() => galeria.current?.click()}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700"
        >
          <ImagePlus size={18} /> Galeria
        </button>
      </div>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { adicionar(e.target.files); e.target.value = ''; }} />
      <input ref={galeria} type="file" accept="image/*" multiple hidden onChange={(e) => { adicionar(e.target.files); e.target.value = ''; }} />

      {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}

      {(preparando > 0 || pendentes.length > 0 || enviadas.length > 0) && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {Array.from({ length: preparando }, (_, i) => (
            <div key={`p${i}`} className="flex aspect-square items-center justify-center rounded-xl bg-slate-100">
              <Loader2 className="animate-spin text-slate-400" size={20} />
            </div>
          ))}
          {pendentes.map((p) => <MiniaturaPendente key={p.id} item={p} />)}
          {enviadas.map((f) => (
            <a key={f.id} href={f.public_url} target="_blank" rel="noreferrer" className="relative block aspect-square overflow-hidden rounded-xl bg-slate-100">
              <img src={f.public_url} alt={f.caption ?? ''} loading="lazy" className="h-full w-full object-cover" />
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">{rotulo(f.category)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniaturaPendente({ item }: { item: ItemFoto }) {
  const url = useMemo(() => URL.createObjectURL(item.arquivo), [item.arquivo]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
      <img src={url} alt="" className="h-full w-full object-cover opacity-70" />
      <span className={`absolute inset-x-1 bottom-1 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold text-white ${item.erro ? 'bg-red-600' : 'bg-amber-600'}`}>
        {item.erro ? 'Erro no envio' : 'Aguardando envio'}
      </span>
      {item.erro && (
        <button
          type="button"
          onClick={() => confirm(`Descartar esta foto?\n\n${item.erro}`) && descartarItem(item.id)}
          className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-600"
          aria-label="Descartar foto"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
