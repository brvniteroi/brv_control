import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { comentarOS, comentariosDaOS, excluirComentario, type ComentarioOS } from '../../services/comentarios';
import { useAuth } from '../../contexts/useAuth';
import { formatarDataHora } from '../../utils/ordens';

/** Comentários internos da OS (o técnico não vê). Os do Field Control vêm com o nome de quem escreveu. */
export default function ComentariosOS({ ordemId }: { ordemId: string }) {
  const { user, profile } = useAuth();
  const [comentarios, setComentarios] = useState<ComentarioOS[] | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    comentariosDaOS(ordemId)
      .then((lista) => {
        setComentarios(lista);
        setErro(null);
      })
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar os comentários.'));
  }, [ordemId]);
  useEffect(carregar, [carregar]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    setErro(null);
    try {
      await comentarOS(ordemId, texto);
      setTexto('');
      carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar o comentário.');
    } finally {
      setEnviando(false);
    }
  };

  const excluir = async (c: ComentarioOS) => {
    if (!window.confirm('Excluir este comentário?')) return;
    setErro(null);
    try {
      await excluirComentario(c.id);
      carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível excluir o comentário.');
    }
  };

  const podeExcluir = (c: ComentarioOS) => profile?.role === 'admin' || (!!user && c.author_id === user.id);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex items-center gap-2 text-slate-800">
        <MessageSquare size={18} className="text-blue-600" />
        <h2 className="text-base font-bold">Comentários{comentarios?.length ? ` (${comentarios.length})` : ''}</h2>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">Só o escritório vê. O técnico não recebe estes comentários.</p>

      {erro && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}

      {comentarios === null ? (
        !erro && <p className="mt-4 text-xs text-slate-400">Carregando...</p>
      ) : comentarios.length === 0 ? (
        <p className="mt-4 text-xs text-slate-400">Nenhum comentário nesta OS.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {comentarios.map((c) => (
            <li key={c.id} className="group rounded-xl bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">{c.author_name ?? 'Sem autor'}</span>
                <span>{formatarDataHora(c.created_at)}</span>
                {c.field_control_id && <span>· Field Control</span>}
                {podeExcluir(c) && (
                  <button
                    type="button"
                    onClick={() => excluir(c)}
                    className="ml-auto rounded p-1 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                    aria-label="Excluir comentário"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{c.message}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={enviar} className="mt-4 flex items-end gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={4000}
          rows={2}
          placeholder="Escreva um comentário para a equipe do escritório..."
          className="min-h-[2.75rem] flex-1 resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        <button
          type="submit"
          disabled={enviando || !texto.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50"
        >
          <Send size={15} /> Comentar
        </button>
      </form>
    </div>
  );
}
