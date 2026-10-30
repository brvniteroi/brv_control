import { useEffect, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { listarDocumentos, type PortalDocumento } from '../../services/portal';
import { buscarFormulario } from '../../services/formularios';
import VisualizarFormulario from '../formularios/VisualizarFormulario';
import type { FormularioRespondido } from '../../types/formularios';
import { formatarData } from '../../utils/ordens';

interface Props {
  clienteNome: string;
}

export default function DocumentosTab({ clienteNome }: Props) {
  const [docs, setDocs] = useState<PortalDocumento[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [aberto, setAberto] = useState<{ form: FormularioRespondido; os: number } | null>(null);

  useEffect(() => {
    listarDocumentos()
      .then(setDocs)
      .catch((e: Error) => setErro(e.message));
  }, []);

  const abrir = async (d: PortalDocumento) => {
    setErro(null);
    setAbrindo(d.id);
    try {
      const form = await buscarFormulario(d.id);
      if (!form) throw new Error('Laudo não encontrado.');
      setAberto({ form, os: d.os_numero });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível abrir o laudo.');
    } finally {
      setAbrindo(null);
    }
  };

  if (!docs && !erro) {
    return (
      <div className="flex justify-center py-16 text-blue-600">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {erro && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      {docs?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Os laudos aparecem aqui quando o serviço é concluído.
        </div>
      )}

      {docs?.map((d) => (
        <div key={d.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <FileText size={20} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">{d.nome}</p>
              <p className="truncate text-xs text-slate-500">
                OS {d.os_numero} · {formatarData(d.filled_at)}
                {d.equipamento ? ` · ${d.equipamento}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => abrir(d)}
            disabled={abrindo === d.id}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            {abrindo === d.id && <Loader2 size={13} className="animate-spin" />}
            Abrir / PDF
          </button>
        </div>
      ))}

      {aberto && (
        <VisualizarFormulario
          formulario={aberto.form}
          clienteNome={clienteNome}
          ordemNumero={aberto.os}
          onFechar={() => setAberto(null)}
        />
      )}
    </div>
  );
}
