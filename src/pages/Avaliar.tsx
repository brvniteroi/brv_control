import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Star } from 'lucide-react';
import { enviarAvaliacao, verAvaliacao, type DadosAvaliacao } from '../services/avaliacoes';

const ROTULOS = ['', 'Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente'];

/** Página pública (sem login) em que o cliente avalia o atendimento: /avaliar/<token>. */
export default function Avaliar() {
  const { token = '' } = useParams();
  const [dados, setDados] = useState<DadosAvaliacao | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [estrelas, setEstrelas] = useState(0);
  const [sobre, setSobre] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);

  useEffect(() => {
    let ativo = true;
    verAvaliacao(token)
      .then((d) => ativo && setDados(d))
      .catch((e: unknown) => {
        if (!ativo) return;
        setDados(null);
        setErro(e instanceof Error ? e.message : 'Não foi possível abrir a avaliação.');
      });
    return () => {
      ativo = false;
    };
  }, [token]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!estrelas) return setErro('Toque nas estrelas para dar sua nota.');
    setErro(null);
    setEnviando(true);
    try {
      await enviarAvaliacao(token, estrelas, comentario);
      setEnviada(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível enviar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  const data = dados?.data ? new Date(dados.data).toLocaleDateString('pt-BR') : null;
  const mostrada = sobre || estrelas;

  let corpo;
  if (dados === undefined) {
    corpo = (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-slate-400" />
      </div>
    );
  } else if (dados === null) {
    corpo = (
      <p className="py-6 text-center text-sm text-slate-600">
        {erro ?? 'Este link de avaliação não é válido. Confira se ele foi copiado inteiro.'}
      </p>
    );
  } else if (enviada || dados.avaliada) {
    corpo = (
      <div className="py-6 text-center">
        <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
        <h2 className="mt-3 text-lg font-bold text-slate-900">Obrigado pela avaliação!</h2>
        <p className="mt-1 text-sm text-slate-600">Sua opinião ajuda a BRV a atender cada vez melhor.</p>
      </div>
    );
  } else {
    corpo = (
      <form onSubmit={enviar}>
        <h2 className="text-center text-lg font-bold text-slate-900">Como foi o nosso atendimento?</h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          OS {dados.numero}
          {dados.servico ? ` · ${dados.servico}` : ''}
          {data ? ` · ${data}` : ''}
          {dados.tecnico ? ` · técnico ${dados.tecnico}` : ''}
        </p>

        <div className="mt-6 flex justify-center gap-1.5" onMouseLeave={() => setSobre(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setEstrelas(i)}
              onMouseEnter={() => setSobre(i)}
              aria-label={`${i} ${i === 1 ? 'estrela' : 'estrelas'}`}
              className="p-1 transition active:scale-90"
            >
              <Star size={40} className={i <= mostrada ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-300'} />
            </button>
          ))}
        </div>
        <p className="mt-1 h-5 text-center text-sm font-semibold text-amber-600">{ROTULOS[mostrada]}</p>

        <label htmlFor="av-comentario" className="mt-5 block text-xs font-medium text-slate-700">
          Quer deixar um comentário? (opcional)
        </label>
        <textarea
          id="av-comentario"
          value={comentario}
          onChange={(e) => setComentario(e.target.value.slice(0, 1000))}
          rows={4}
          placeholder="Conte como foi o atendimento"
          className="mt-1.5 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />

        {erro && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-60"
        >
          {enviando && <Loader2 size={16} className="animate-spin" />} Enviar avaliação
        </button>
      </form>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F4F6F8] p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center justify-center gap-3">
          <img src="/logobrvcontrol.png" alt="BRV Niterói" className="h-12 w-12 object-contain" />
          <div>
            <div className="text-base font-bold text-slate-900">BRV Niterói</div>
            <div className="text-xs text-slate-500">Climatização e elétrica</div>
          </div>
        </div>
        {corpo}
      </div>
    </div>
  );
}
