import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { abrirChamado, buscarOpcoesChamado, type PortalOpcoes } from '../../services/portal';

interface Props {
  aoAbrir: () => void;
}

const CAMPO =
  'mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

export default function NovoChamadoTab({ aoAbrir }: Props) {
  const [opcoes, setOpcoes] = useState<PortalOpcoes | null>(null);
  const [tipo, setTipo] = useState('');
  const [endereco, setEndereco] = useState('');
  const [equipamento, setEquipamento] = useState('');
  const [descricao, setDescricao] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [numero, setNumero] = useState<number | null>(null);

  useEffect(() => {
    buscarOpcoesChamado()
      .then(setOpcoes)
      .catch((e: Error) => setErro(e.message));
  }, []);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!tipo) return setErro('Escolha o tipo de serviço.');
    if (descricao.trim().length < 5) return setErro('Descreva o que precisa ser feito.');
    setEnviando(true);
    try {
      setNumero(await abrirChamado({ tipo, descricao, endereco: endereco || null, equipamento: equipamento || null, urgente }));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível abrir o chamado.');
    } finally {
      setEnviando(false);
    }
  };

  if (numero !== null) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-xs">
        <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
        <h2 className="mt-3 text-lg font-bold text-slate-900">Chamado enviado!</h2>
        <p className="mt-1 text-sm text-slate-600">
          Anotamos como <b>OS {numero}</b>. Nossa equipe vai entrar em contato para agendar.
        </p>
        <button
          type="button"
          onClick={aoAbrir}
          className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Acompanhar meus chamados
        </button>
      </div>
    );
  }

  if (!opcoes && !erro) {
    return (
      <div className="flex justify-center py-16 text-blue-600">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div>
        <h2 className="text-base font-bold text-slate-900">Abrir novo chamado</h2>
        <p className="text-xs text-slate-500">Conte o que precisa e a equipe da BRV agenda a visita.</p>
      </div>

      {erro && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</div>}

      {opcoes && (
        <>
          <div>
            <label htmlFor="pc-tipo" className="block text-xs font-semibold text-slate-700">Tipo de serviço *</label>
            <select id="pc-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={CAMPO}>
              <option value="">Selecione</option>
              {opcoes.tipos.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {opcoes.enderecos.length > 0 && (
            <div>
              <label htmlFor="pc-end" className="block text-xs font-semibold text-slate-700">Local do atendimento</label>
              <select id="pc-end" value={endereco} onChange={(e) => setEndereco(e.target.value)} className={CAMPO}>
                <option value="">Não sei / outro local (informo na descrição)</option>
                {opcoes.enderecos.map((a) => (
                  <option key={a.id} value={a.id}>{a.nome}</option>
                ))}
              </select>
            </div>
          )}

          {opcoes.equipamentos.length > 0 && (
            <div>
              <label htmlFor="pc-eq" className="block text-xs font-semibold text-slate-700">Equipamento</label>
              <select id="pc-eq" value={equipamento} onChange={(e) => setEquipamento(e.target.value)} className={CAMPO}>
                <option value="">Nenhum em especial</option>
                {opcoes.equipamentos.map((q) => (
                  <option key={q.id} value={q.id}>{q.nome}{q.local ? ` — ${q.local}` : ''}</option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      <div>
        <label htmlFor="pc-desc" className="block text-xs font-semibold text-slate-700">O que está acontecendo? *</label>
        <textarea
          id="pc-desc"
          rows={5}
          maxLength={2000}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex.: o ar da sala de reunião está pingando água e não gela."
          className={CAMPO}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
        É urgente (equipamento parado ou risco)
      </label>

      <button
        type="submit"
        disabled={enviando || !opcoes}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {enviando && <Loader2 size={15} className="animate-spin" />}
        Enviar chamado
      </button>
    </form>
  );
}
