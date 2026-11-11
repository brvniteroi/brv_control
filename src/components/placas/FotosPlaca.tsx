import { useId, useMemo, useState } from 'react';
import { Camera, Trash2, ZoomIn } from 'lucide-react';
import type { BoardPhoto, BoardPhotoCategory } from '../../types/placas';
import { formatarDataHora } from '../../utils/ordens';
import BotoesFoto from '../comum/BotoesFoto';
import VisualizadorFotos from '../ordens/VisualizadorFotos';
import { ROTULO_CATEGORIA_FOTO } from './cores';
import { anexarFotoPlaca, excluirFotoPlaca } from './fonteDeDados';
import {
  ROTULO_ETAPA_CURTO_PLACA,
  converterFotosPlacaParaAttachment,
} from './regrasPlacas';

interface FotosPlacaProps {
  placaId: string;
  fotos: BoardPhoto[];
  somenteLeitura: boolean;
  atorNome: string;
  onFotosAlteradas: (novas: BoardPhoto[]) => void;
}

export default function FotosPlaca({
  placaId,
  fotos,
  somenteLeitura,
  atorNome,
  onFotosAlteradas,
}: FotosPlacaProps) {
  const [categoriaEnvio, setCategoriaEnvio] = useState<BoardPhotoCategory>('antes');
  const [legendaEnvio, setLegendaEnvio] = useState('');
  const [filtroCat, setFiltroCat] = useState<'todas' | BoardPhotoCategory>('todas');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [indiceAmpliada, setIndiceAmpliada] = useState<number | null>(null);
  const legendaId = useId();

  const filtradas = useMemo(
    () => (filtroCat === 'todas' ? fotos : fotos.filter((f) => f.category === filtroCat)),
    [fotos, filtroCat],
  );

  const fotosAttachment = useMemo(
    () => converterFotosPlacaParaAttachment(filtradas),
    [filtradas],
  );

  const handleSelecionarArquivos = async (arquivos: File[]) => {
    if (arquivos.length === 0) return;

    setEnviando(true);
    setErro(null);
    try {
      const adicionadas: BoardPhoto[] = [];
      for (const arq of arquivos) {
        const criada = await anexarFotoPlaca(
          arq,
          placaId,
          categoriaEnvio,
          legendaEnvio.trim() || undefined,
          atorNome,
        );
        adicionadas.push(criada);
      }
      setLegendaEnvio('');
      onFotosAlteradas([...adicionadas, ...fotos]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível anexar a(s) foto(s).');
    } finally {
      setEnviando(false);
    }
  };

  const handleExcluir = async (fotoId: string) => {
    if (!window.confirm('Deseja excluir esta foto da placa?')) return;
    try {
      await excluirFotoPlaca(fotoId);
      onFotosAlteradas(fotos.filter((f) => f.id !== fotoId));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível excluir a foto.');
    }
  };

  return (
    <div className="space-y-3">
      {/* Envio de novas fotos */}
      {!somenteLeitura && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div>
              <span className="block text-[11px] font-semibold text-slate-600">Categoria</span>
              <select
                aria-label="Categoria da foto"
                value={categoriaEnvio}
                onChange={(e) => setCategoriaEnvio(e.target.value as BoardPhotoCategory)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800"
              >
                <option value="antes">Antes (entrada)</option>
                <option value="depois">Depois (reparo/teste)</option>
                <option value="outros">Outros</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor={legendaId} className="block text-[11px] font-semibold text-slate-600">
                Legenda opcional (aplicada ao envio)
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id={legendaId}
                  type="text"
                  value={legendaEnvio}
                  onChange={(e) => setLegendaEnvio(e.target.value)}
                  placeholder="Ex.: Trilha reconstituída e envernizada"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800"
                />
                <BotoesFoto
                  className="shrink-0"
                  onArquivos={(arquivos) => void handleSelecionarArquivos(arquivos)}
                  enviando={enviando}
                  textoEnviando="Enviando…"
                />
              </div>
            </div>
          </div>
          {erro && (
            <p role="alert" className="mt-2 text-xs font-medium text-rose-700">
              {erro}
            </p>
          )}
        </div>
      )}

      {/* Filtro rápido por categoria */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            { valor: 'todas', rotulo: `Todas (${fotos.length})` },
            {
              valor: 'antes',
              rotulo: `Antes (${fotos.filter((f) => f.category === 'antes').length})`,
            },
            {
              valor: 'depois',
              rotulo: `Depois (${fotos.filter((f) => f.category === 'depois').length})`,
            },
            {
              valor: 'outros',
              rotulo: `Outros (${fotos.filter((f) => f.category === 'outros').length})`,
            },
          ] as const
        ).map((op) => (
          <button
            key={op.valor}
            type="button"
            onClick={() => setFiltroCat(op.valor)}
            aria-pressed={filtroCat === op.valor}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
              filtroCat === op.valor
                ? 'border-brv-navy bg-brv-navy text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {op.rotulo}
          </button>
        ))}
      </div>

      {/* Grade de miniaturas */}
      {filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 py-8 text-center text-xs text-slate-500">
          <Camera size={22} className="text-slate-400" aria-hidden="true" />
          <p className="mt-1.5">Nenhuma foto nesta categoria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtradas.map((foto, idx) => (
            <div
              key={foto.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs"
            >
              <button
                type="button"
                onClick={() => setIndiceAmpliada(idx)}
                aria-label={`Ampliar foto: ${foto.caption ?? foto.file_name}`}
                className="group relative block aspect-4/3 w-full overflow-hidden bg-slate-900"
              >
                <img
                  src={foto.public_url}
                  alt={foto.caption ?? `Foto ${ROTULO_CATEGORIA_FOTO[foto.category]}`}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
                <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
                  <ZoomIn size={12} aria-hidden="true" />
                  Ampliar
                </span>
              </button>

              <div className="space-y-1 p-2.5 text-[11px]">
                <div className="flex items-center justify-between gap-1">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700">
                    {ROTULO_CATEGORIA_FOTO[foto.category]}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {ROTULO_ETAPA_CURTO_PLACA[foto.stage_at_capture]}
                  </span>
                </div>
                {foto.caption && <p className="line-clamp-2 font-medium text-slate-800">{foto.caption}</p>}
                <div className="flex items-center justify-between gap-1 pt-0.5 text-[10px] text-slate-400">
                  <span>{formatarDataHora(foto.created_at)}</span>
                  {!somenteLeitura && (
                    <button
                      type="button"
                      onClick={() => void handleExcluir(foto.id)}
                      aria-label={`Excluir foto ${foto.caption ?? foto.file_name}`}
                      className="rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {indiceAmpliada !== null && (
        <VisualizadorFotos
          fotos={fotosAttachment}
          indiceInicial={indiceAmpliada}
          onFechar={() => setIndiceAmpliada(null)}
        />
      )}
    </div>
  );
}
