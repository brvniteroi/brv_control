import { useRef, useState } from 'react';
import { Camera, ExternalLink, Film, ImagePlus, Loader2, X } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { excluirAnexo } from '../../services/anexos';
import { anexarFotoItem } from '../../services/oficina';
import type { Attachment, AttachmentCategory } from '../../types/fsm';
import type { EtapaOficina } from '../../types/oficina';
import { ROTULO_ETAPA } from '../../utils/oficina';
import { formatarDataHora } from '../../utils/ordens';
import VisualizadorFotos from '../ordens/VisualizadorFotos';
import { CORES_ETAPA } from './cores';

const ROTULO_CATEGORIA: Record<AttachmentCategory, string> = {
  antes: 'Chegada / Antes',
  depois: 'Pronto / Depois',
  placa_equipamento: 'Etiqueta do aparelho',
  documento: 'Comprovante',
  assinatura: 'Assinatura',
  outros: 'Outros',
};

function ehVideo(a: Attachment): boolean {
  return /\.(mp4|mov|webm)$/i.test(a.file_name ?? a.public_url);
}

function categoriaSugerida(etapa: EtapaOficina): AttachmentCategory {
  return etapa === 'pronto' || etapa === 'em_reparo' ? 'depois' : 'antes';
}

interface MiniaturaFotoOficinaProps {
  anexo: Attachment;
  onAbrir: () => void;
  onExcluir?: (a: Attachment) => void;
}

function MiniaturaFotoOficina({ anexo, onAbrir, onExcluir }: MiniaturaFotoOficinaProps) {
  const [falhou, setFalhou] = useState(false);
  const video = ehVideo(anexo);
  const etapaFoto = anexo.workshop_status as EtapaOficina | null | undefined;
  const rotuloEtapa = etapaFoto ? (ROTULO_ETAPA[etapaFoto] ?? etapaFoto) : null;
  const corEtapa = etapaFoto && etapaFoto in CORES_ETAPA ? CORES_ETAPA[etapaFoto].selo : 'border-slate-200 bg-white/90 text-slate-700';
  const titulo = anexo.caption ?? anexo.file_name ?? 'Foto do item';
  const classes =
    'group relative block aspect-square w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50';

  const conteudo = (
    <>
      {video || falhou ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
          {video ? <Film size={22} /> : <ExternalLink size={20} />}
          <span className="px-2 text-center text-[10px]">{video ? 'Vídeo' : 'Abrir arquivo'}</span>
        </div>
      ) : (
        <img
          src={anexo.public_url}
          alt={anexo.caption ?? 'Foto da oficina'}
          loading="lazy"
          onError={() => setFalhou(true)}
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
      )}

      {rotuloEtapa && (
        <span
          className={`absolute top-1.5 left-1.5 max-w-[calc(100%-2.25rem)] truncate rounded-full border px-2 py-0.5 text-[10px] font-bold shadow-2xs ${corEtapa}`}
        >
          {rotuloEtapa}
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/45 to-transparent px-2 pt-4 pb-1.5 text-left text-white">
        {anexo.caption && <p className="truncate text-[11px] font-semibold">{anexo.caption}</p>}
        <p className="truncate text-[10px] text-white/85">
          {ROTULO_CATEGORIA[anexo.category] ?? anexo.category} · {formatarDataHora(anexo.created_at)}
        </p>
      </div>
    </>
  );

  return (
    <div className="relative">
      {video || falhou ? (
        <a href={anexo.public_url} target="_blank" rel="noreferrer" title={titulo} className={classes}>
          {conteudo}
        </a>
      ) : (
        <button type="button" onClick={onAbrir} title={titulo} className={`${classes} cursor-zoom-in`}>
          {conteudo}
        </button>
      )}

      {onExcluir && (
        <button
          type="button"
          onClick={() => onExcluir(anexo)}
          title="Excluir foto"
          aria-label="Excluir foto"
          className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow hover:bg-red-700"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

interface FotosItemProps {
  itemId: string;
  etapaAtual: EtapaOficina;
  fotos: Attachment[];
  somenteLeitura: boolean;
  onAlterado: () => Promise<void> | void;
}

export default function FotosItem({
  itemId,
  etapaAtual,
  fotos,
  somenteLeitura,
  onAlterado,
}: FotosItemProps) {
  const { profile } = useAuth();
  const ehAdmin = profile?.role === 'admin';
  const inputRef = useRef<HTMLInputElement>(null);

  const [categoriaManual, setCategoriaManual] = useState<AttachmentCategory | null>(null);
  const [legenda, setLegenda] = useState('');
  const [enviando, setEnviando] = useState<{ feitas: number; total: number } | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [indiceAberto, setIndiceAberto] = useState<number | null>(null);

  const categoriaEfetiva = categoriaManual ?? categoriaSugerida(etapaAtual);
  const fotosAmpliaveis = fotos.filter((f) => !ehVideo(f));

  const enviarArquivos = async (arquivos: File[]) => {
    if (arquivos.length === 0) return;
    setErroEnvio(null);
    const falhas: string[] = [];
    const legendaLimpa = legenda.trim() || undefined;

    for (let i = 0; i < arquivos.length; i++) {
      setEnviando({ feitas: i, total: arquivos.length });
      try {
        await anexarFotoItem(arquivos[i], itemId, categoriaEfetiva, legendaLimpa);
      } catch (e) {
        falhas.push(`${arquivos[i].name}: ${e instanceof Error ? e.message : 'erro no envio'}`);
      }
    }

    setEnviando(null);
    if (falhas.length === 0) setLegenda('');
    else setErroEnvio(falhas.join(' | '));
    await onAlterado();
  };

  const handleExcluir = async (anexo: Attachment) => {
    if (!window.confirm('Excluir esta foto do item? Não é possível desfazer.')) return;
    setErroEnvio(null);
    try {
      await excluirAnexo(anexo.id);
      await onAlterado();
    } catch (e) {
      setErroEnvio(e instanceof Error ? e.message : 'Não foi possível excluir a foto.');
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-800">
          <Camera size={18} className="text-blue-600" />
          <h2 className="text-base font-bold">Fotos ({fotos.length})</h2>
        </div>

        {!somenteLeitura && (
          <button
            type="button"
            disabled={!!enviando}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-blue-700 disabled:opacity-60"
          >
            {enviando ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
            {enviando ? `Enviando ${enviando.feitas + 1} de ${enviando.total}...` : 'Adicionar fotos'}
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const selecionados = Array.from(e.target.files ?? []);
            e.target.value = '';
            void enviarArquivos(selecionados);
          }}
        />
      </div>

      {!somenteLeitura && (
        <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:grid-cols-3">
          <div>
            <label htmlFor="foto-oficina-cat" className="block text-[11px] font-semibold text-slate-600">
              Categoria das próximas fotos
            </label>
            <select
              id="foto-oficina-cat"
              value={categoriaEfetiva}
              onChange={(e) => setCategoriaManual(e.target.value as AttachmentCategory)}
              disabled={!!enviando}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
            >
              <option value="antes">Chegada / Diagnóstico (Antes)</option>
              <option value="depois">Pronto / Consertado (Depois)</option>
              <option value="placa_equipamento">Etiqueta / Placa do aparelho</option>
              <option value="documento">Comprovante / Documento</option>
              <option value="outros">Outros</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="foto-oficina-legenda" className="block text-[11px] font-semibold text-slate-600">
              Legenda (opcional, aplicada ao lote enviado)
            </label>
            <input
              id="foto-oficina-legenda"
              type="text"
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              disabled={!!enviando}
              placeholder="Ex.: Serpentina oxidada na chegada, teste de pressão..."
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {erroEnvio && (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {erroEnvio}
        </p>
      )}

      {fotos.length === 0 ? (
        <p className="mt-4 text-xs text-slate-400">Nenhuma foto registrada neste item.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {fotos.map((foto) => (
            <MiniaturaFotoOficina
              key={foto.id}
              anexo={foto}
              onAbrir={() => setIndiceAberto(fotosAmpliaveis.findIndex((f) => f.id === foto.id))}
              onExcluir={ehAdmin && !somenteLeitura ? handleExcluir : undefined}
            />
          ))}
        </div>
      )}

      {indiceAberto !== null && indiceAberto >= 0 && (
        <VisualizadorFotos
          fotos={fotosAmpliaveis}
          indiceInicial={indiceAberto}
          onFechar={() => setIndiceAberto(null)}
        />
      )}
    </section>
  );
}

