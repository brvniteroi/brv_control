import { useState, type FormEvent } from 'react';
import { Check, X } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../services/supabase';

const INPUT =
  'mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

export default function AlterarSenhaModal({ onFechar }: { onFechar: () => void }) {
  const { user } = useAuth();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  const handleSalvar = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.email) return setErro('Sessão inválida. Entre novamente.');
    if (nova.length < 8) return setErro('A nova senha precisa ter pelo menos 8 caracteres.');
    if (nova !== confirmacao) return setErro('A confirmação não é igual à nova senha.');
    if (nova === atual) return setErro('A nova senha deve ser diferente da atual.');

    setSalvando(true);
    setErro(null);
    try {
      // Confere a senha atual: quem usa um aparelho emprestado não consegue trocar a senha
      const { error: erroLogin } = await supabase.auth.signInWithPassword({ email: user.email, password: atual });
      if (erroLogin) {
        setErro('A senha atual está incorreta.');
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: nova });
      if (error) {
        setErro(error.message);
        return;
      }
      setConcluido(true);
      setTimeout(onFechar, 1800);
    } catch (err) {
      console.error('Erro ao alterar senha:', err);
      setErro('Não foi possível alterar a senha. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-800">Alterar minha senha</h3>
          <button type="button" onClick={onFechar} className="text-slate-400 hover:text-slate-600" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {concluido ? (
          <div className="mt-6 flex flex-col items-center gap-2 pb-2 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Check size={20} />
            </div>
            <p className="text-sm font-semibold text-slate-800">Senha alterada com sucesso.</p>
          </div>
        ) : (
          <form onSubmit={handleSalvar} className="mt-4 space-y-3.5">
            {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</div>}

            <div>
              <label htmlFor="sn-atual" className="block text-xs font-medium text-slate-700">Senha atual</label>
              <input id="sn-atual" type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label htmlFor="sn-nova" className="block text-xs font-medium text-slate-700">Nova senha (mínimo 8 caracteres)</label>
              <input id="sn-nova" type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label htmlFor="sn-conf" className="block text-xs font-medium text-slate-700">Repita a nova senha</label>
              <input id="sn-conf" type="password" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} className={INPUT} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onFechar} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button type="submit" disabled={salvando} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50">
                {salvando ? 'Salvando...' : 'Alterar senha'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
