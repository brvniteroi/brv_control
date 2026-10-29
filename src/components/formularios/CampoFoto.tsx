import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, RefreshCw, Trash2, X } from 'lucide-react';
import { anexarFoto } from '../../services/anexos';
import { buscarAnexosPorIds } from '../../services/formularios';
import type { Attachment } from '../../types/fsm';

interface CampoFotoProps {
  valorIds: string[];
  taskId: string;
  serviceOrderId: string;
  desabilitado?: boolean;
  onChange: (novosIds: string[]) => void;
}

export default function CampoFoto({
  valorIds,
  taskId,
  serviceOrderId,
  desabilitado = false,
  onChange,
}: CampoFotoProps) {
  const [anexosCarregados, setAnexosCarregados] = useState<Attachment[]>([]);
  const [carregandoIniciais, setCarregandoIniciais] = useState(valorIds.length > 0);
  const [enviando, setEnviando] = useState(false);
  const [progressoTexto, setProgressoTexto] = useState('');
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [arquivosPendentes, setArquivosPendentes] = useState<File[]>([]);
  const [fotoAmpliadaUrl, setFotoAmpliadaUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Carrega anexos existentes a partir dos IDs
  useEffect(() => {
    if (valorIds.length === 0) return;

    let montado = true;

    buscarAnexosPorIds(valorIds)
      .then((lista) => {
        if (!montado) return;
        setAnexosCarregados(lista);
      })
      .catch((err) => {
        console.error('Erro ao carregar anexos:', err);
      })
      .finally(() => {
        if (montado) setCarregandoIniciais(false);
      });

    return () => {
      montado = false;
    };
  }, [valorIds]);

  const processarArquivos = async (arquivos: File[]) => {
    if (arquivos.length === 0) return;

    setEnviando(true);
    setErroEnvio(null);
    setArquivosPendentes(arquivos);

    const novosAnexos: Attachment[] = [...anexosCarregados];
    const novosIds: string[] = [...valorIds];
    let enviadas = 0;

    try {
      for (const arquivo of arquivos) {
        setProgressoTexto(`Enviando foto ${enviadas + 1} de ${arquivos.length}...`);
        const anexo = await anexarFoto(arquivo, { taskId, serviceOrderId, category: 'outros' });
        novosAnexos.push(anexo);
        novosIds.push(anexo.id);
        enviadas++;
        // Registra uma a uma: se a próxima falhar, as já enviadas não se perdem
        setAnexosCarregados([...novosAnexos]);
        onChange([...novosIds]);
      }
      setArquivosPendentes([]);
    } catch (err) {
      console.error('Erro no envio de fotos:', err);
      setArquivosPendentes(arquivos.slice(enviadas)); // "Tentar de novo" só reenvia as que faltam
      setErroEnvio(
        err instanceof Error
          ? err.message
          : 'Falha no envio de fotos. Tente novamente.',
      );
    } finally {
      setEnviando(false);
      setProgressoTexto('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processarArquivos(files);
  };

  const removerFoto = (idParaRemover: string) => {
    const atualizados = valorIds.filter((id) => id !== idParaRemover);
    setAnexosCarregados((prev) => prev.filter((a) => a.id !== idParaRemover));
    onChange(atualizados);
  };

  return (
    <div className="space-y-3">
      {/* Miniaturas das Fotos */}
      {carregandoIniciais ? (
        <div className="flex items-center gap-2 py-4 text-xs text-slate-500">
          <Loader2 size={16} className="animate-spin text-blue-600" />
          <span>Carregando fotos...</span>
        </div>
      ) : anexosCarregados.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {anexosCarregados.map((anexo) => (
            <div
              key={anexo.id}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-2xs"
            >
              <img
                src={anexo.public_url}
                alt={anexo.file_name || 'Foto anexada'}
                onClick={() => setFotoAmpliadaUrl(anexo.public_url)}
                className="h-full w-full cursor-pointer object-cover transition group-hover:scale-105"
              />
              {!desabilitado && (
                <button
                  type="button"
                  onClick={() => removerFoto(anexo.id)}
                  className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900/70 text-white backdrop-blur-xs transition hover:bg-rose-600"
                  aria-label="Remover foto"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {/* Alerta de Erro com Tentar de Novo */}
      {erroEnvio && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
          <span>{erroEnvio}</span>
          {arquivosPendentes.length > 0 && (
            <button
              type="button"
              onClick={() => processarArquivos(arquivosPendentes)}
              className="inline-flex items-center gap-1 font-semibold text-rose-800 hover:underline"
            >
              <RefreshCw size={13} />
              Tentar de novo
            </button>
          )}
        </div>
      )}

      {/* Botão de Adicionar Fotos */}
      {!desabilitado && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={handleFileChange}
            disabled={enviando}
            className="hidden"
            id={`input-foto-${taskId}`}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={enviando}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 py-4 px-4 text-sm font-semibold text-slate-700 transition hover:border-blue-400 hover:bg-blue-50/40 disabled:opacity-50"
          >
            {enviando ? (
              <>
                <Loader2 size={18} className="animate-spin text-blue-600" />
                <span className="text-blue-600">{progressoTexto || 'Enviando foto...'}</span>
              </>
            ) : (
              <>
                <Camera size={20} className="text-slate-500" />
                <span>Tirar foto ou escolher da galeria</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Modal Simples de Foto Ampliada */}
      {fotoAmpliadaUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs"
          onClick={() => setFotoAmpliadaUrl(null)}
        >
          <div className="relative max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setFotoAmpliadaUrl(null)}
              className="absolute -top-10 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40"
            >
              <X size={20} />
            </button>
            <img
              src={fotoAmpliadaUrl}
              alt="Foto ampliada"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
