import { useState } from 'react';
import { Camera, ExternalLink, Film } from 'lucide-react';
import type { Attachment } from '../../types/fsm';
import { formatarDataHora } from '../../utils/ordens';

function ehVideo(a: Attachment): boolean {
  return /\.(mp4|mov|webm)$/i.test(a.file_name ?? a.public_url);
}

function Miniatura({ anexo }: { anexo: Attachment }) {
  const [falhou, setFalhou] = useState(false);
  const video = ehVideo(anexo);

  return (
    <a
      href={anexo.public_url}
      target="_blank"
      rel="noreferrer"
      title={anexo.caption ?? anexo.file_name ?? ''}
      className="group relative block aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
    >
      {video || falhou ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
          {video ? <Film size={22} /> : <ExternalLink size={20} />}
          <span className="px-2 text-center text-[10px]">{video ? 'Vídeo' : 'Abrir arquivo'}</span>
        </div>
      ) : (
        <img
          src={anexo.public_url}
          alt={anexo.caption ?? 'Foto da OS'}
          loading="lazy"
          onError={() => setFalhou(true)}
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
      )}
      <span className="absolute inset-x-0 bottom-0 bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
        {formatarDataHora(anexo.created_at)}
      </span>
    </a>
  );
}

export default function AnexosOS({ anexos }: { anexos: Attachment[] }) {
  const importados = anexos.filter((a) => a.storage === 'fieldcontrol').length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex items-center gap-2 text-slate-800">
        <Camera size={18} className="text-blue-600" />
        <h2 className="text-base font-bold">Fotos e anexos ({anexos.length})</h2>
      </div>

      {importados > 0 && (
        <p className="mt-1 text-[11px] text-slate-400">
          {importados} {importados === 1 ? 'arquivo ainda está' : 'arquivos ainda estão'} no Field Control e abrem pelo link original.
        </p>
      )}

      {anexos.length === 0 ? (
        <p className="mt-4 text-xs text-slate-400">Nenhuma foto nesta OS.</p>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {anexos.map((a) => (
            <Miniatura key={a.id} anexo={a} />
          ))}
        </div>
      )}
    </div>
  );
}
