import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, Loader2, UserPlus } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { criarAcessoPortal, gerarSenhaTemporaria, listarAcessosPortal, type AcessoPortal as Acesso } from '../../services/equipe';

interface Props {
  clienteId: string;
  clienteNome: string;
  /** Sugestão de e-mail (contato principal do cliente). */
  emailSugerido: string;
}

/** Logins do Portal do Cliente. Só administrador cria (a função de servidor exige). */
export default function AcessoPortal({ clienteId, clienteNome, emailSugerido }: Props) {
  const { profile } = useAuth();
  const ehAdmin = profile?.role === 'admin';
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [criando, setCriando] = useState(false);
  const [email, setEmail] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [entregue, setEntregue] = useState<{ email: string; senha: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(() => {
    listarAcessosPortal(clienteId).then(setAcessos).catch(() => setAcessos([]));
  }, [clienteId]);

  useEffect(carregar, [carregar]);

  const criar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    const senha = gerarSenhaTemporaria();
    try {
      await criarAcessoPortal({ customer_id: clienteId, email, nome: clienteNome, senha });
      setEntregue({ email: email.trim().toLowerCase(), senha });
      setCriando(false);
      carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível liberar o acesso.');
    } finally {
      setSalvando(false);
    }
  };

  const copiar = async () => {
    if (!entregue) return;
    await navigator.clipboard.writeText(`Portal do Cliente BRV: ${window.location.origin}/portal/login\nE-mail: ${entregue.email}\nSenha temporária: ${entregue.senha}`);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  if (!ehAdmin) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Acesso ao portal</h3>
        {!criando && (
          <button
            type="button"
            onClick={() => {
              setEmail(emailSugerido);
              setErro(null);
              setEntregue(null);
              setCriando(true);
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
          >
            <UserPlus size={13} /> Liberar acesso
          </button>
        )}
      </div>

      {acessos.length === 0 && !criando && !entregue && (
        <p className="mt-2 text-xs text-slate-500">Nenhum login liberado para este cliente.</p>
      )}
      <ul className="mt-2 space-y-1">
        {acessos.map((a) => (
          <li key={a.profile_id} className="text-xs text-slate-700">
            {a.email} {!a.active && <span className="text-red-600">(bloqueado)</span>}
          </li>
        ))}
      </ul>

      {criando && (
        <form onSubmit={criar} className="mt-3 space-y-2">
          {erro && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</div>}
          <label htmlFor="ap-email" className="block text-xs font-semibold text-slate-700">E-mail de login</label>
          <input
            id="ap-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
          <p className="text-[11px] text-slate-500">Uma senha temporária será gerada; o cliente pode trocá-la no portal.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCriando(false)} disabled={salvando} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {salvando && <Loader2 size={12} className="animate-spin" />} Criar acesso
            </button>
          </div>
        </form>
      )}

      {entregue && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <p className="font-semibold">Acesso criado. Anote: a senha não aparece de novo.</p>
          <p className="mt-1">E-mail: {entregue.email}</p>
          <p>Senha temporária: <b className="font-mono">{entregue.senha}</b></p>
          <button type="button" onClick={copiar} className="mt-2 inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline">
            {copiado ? <Check size={13} /> : <Copy size={13} />} {copiado ? 'Copiado' : 'Copiar mensagem de boas-vindas'}
          </button>
        </div>
      )}
    </div>
  );
}
