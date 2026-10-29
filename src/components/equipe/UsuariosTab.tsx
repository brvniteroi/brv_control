import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Copy, KeyRound, Plus, X } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import {
  atualizarPerfil,
  criarUsuario,
  gerarSenhaTemporaria,
  listarColaboradores,
  listarPerfis,
  redefinirSenha,
  vincularPerfil,
  type ColaboradorComLogin,
  type PerfilComColaborador,
} from '../../services/equipe';
import type { ProfileRole } from '../../types/fsm';

const PAPEIS: { valor: ProfileRole; rotulo: string; descricao: string }[] = [
  { valor: 'admin', rotulo: 'Administrador', descricao: 'Tudo, inclusive excluir e gerenciar a equipe' },
  { valor: 'escritorio', rotulo: 'Escritório', descricao: 'Cadastros, OS e linha do tempo' },
  { valor: 'tecnico', rotulo: 'Técnico', descricao: 'Só as próprias atividades' },
];

const INPUT =
  'mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

type Modal =
  | { tipo: 'novo' }
  | { tipo: 'editar'; perfil: PerfilComColaborador }
  | null;

export default function UsuariosTab() {
  const { user, refreshProfile } = useAuth();
  const [perfis, setPerfis] = useState<PerfilComColaborador[]>([]);
  const [colaboradores, setColaboradores] = useState<ColaboradorComLogin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState<ProfileRole>('escritorio');
  const [ativo, setAtivo] = useState(true);
  const [colaboradorId, setColaboradorId] = useState('');
  const [senha, setSenha] = useState('');
  const [erroModal, setErroModal] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([listarPerfis(), listarColaboradores()]);
      setPerfis(p);
      setColaboradores(c);
      setErro(null);
    } catch (e) {
      console.error('Erro ao listar usuários:', e);
      setErro('Não foi possível carregar os usuários.');
    } finally {
      setCarregando(false);
    }
  }, []);

  // Carga inicial (adiada um instante: o efeito não deve atualizar estado de forma síncrona)
  useEffect(() => {
    const timer = setTimeout(carregar, 0);
    return () => clearTimeout(timer);
  }, [carregar]);

  const abrirNovo = () => {
    setNome('');
    setEmail('');
    setPapel('escritorio');
    setAtivo(true);
    setColaboradorId('');
    setSenha(gerarSenhaTemporaria());
    setErroModal(null);
    setAviso(null);
    setModal({ tipo: 'novo' });
  };

  const abrirEdicao = (p: PerfilComColaborador) => {
    setNome(p.full_name);
    setEmail(p.email);
    setPapel(p.role);
    setAtivo(p.active);
    setColaboradorId(p.colaborador?.id ?? '');
    setSenha('');
    setErroModal(null);
    setAviso(null);
    setModal({ tipo: 'editar', perfil: p });
  };

  const copiar = (texto: string) => navigator.clipboard?.writeText(texto).catch(() => undefined);

  const handleCriar = async (e: FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return setErroModal('Informe o nome.');
    if (!email.trim()) return setErroModal('Informe o e-mail.');
    if (senha.length < 8) return setErroModal('A senha precisa ter pelo menos 8 caracteres.');
    setSalvando(true);
    setErroModal(null);
    try {
      await criarUsuario({ email, nome, papel, senha, colaborador_id: colaboradorId || null });
      await carregar();
      // A senha só aparece agora: precisa ser repassada à pessoa
      setAviso(`Usuário criado. Passe a senha temporária para ${nome.trim()}: ${senha}`);
      setModal(null);
    } catch (err) {
      console.error('Erro ao criar usuário:', err);
      setErroModal(err instanceof Error ? err.message : 'Erro ao criar o usuário.');
    } finally {
      setSalvando(false);
    }
  };

  const handleSalvarEdicao = async (e: FormEvent) => {
    e.preventDefault();
    if (modal?.tipo !== 'editar') return;
    const { perfil } = modal;
    if (!nome.trim()) return setErroModal('Informe o nome.');
    setSalvando(true);
    setErroModal(null);
    try {
      await atualizarPerfil(perfil.id, { full_name: nome, role: papel, active: ativo });
      if ((perfil.colaborador?.id ?? '') !== colaboradorId) await vincularPerfil(perfil.id, colaboradorId || null);
      if (perfil.id === user?.id) await refreshProfile();
      setModal(null);
      await carregar();
    } catch (err) {
      console.error('Erro ao salvar usuário:', err);
      setErroModal(err instanceof Error ? err.message : 'Erro ao salvar o usuário.');
    } finally {
      setSalvando(false);
    }
  };

  const handleRedefinirSenha = async () => {
    if (modal?.tipo !== 'editar') return;
    const nova = gerarSenhaTemporaria();
    if (!window.confirm(`Definir uma nova senha temporária para ${modal.perfil.full_name}? A senha atual deixa de funcionar.`)) return;
    setSalvando(true);
    setErroModal(null);
    try {
      await redefinirSenha(modal.perfil.id, nova);
      setSenha(nova);
    } catch (err) {
      console.error('Erro ao redefinir senha:', err);
      setErroModal(err instanceof Error ? err.message : 'Erro ao redefinir a senha.');
    } finally {
      setSalvando(false);
    }
  };

  const ehEu = modal?.tipo === 'editar' && modal.perfil.id === user?.id;
  // Colaboradores sem login, mais o já ligado a este usuário
  const colaboradoresLivres = colaboradores.filter(
    (c) => !c.profile_id || (modal?.tipo === 'editar' && c.profile_id === modal.perfil.id),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Quem entra no sistema e o que pode fazer. Só administradores veem esta aba.</p>
        <button
          type="button"
          onClick={abrirNovo}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700"
        >
          <Plus size={18} />
          Novo usuário
        </button>
      </div>

      {aviso && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          <span className="break-all">{aviso}</span>
          <button
            type="button"
            onClick={() => copiar(aviso.split(': ').pop() ?? '')}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 font-semibold hover:bg-emerald-100"
          >
            <Copy size={12} /> Copiar senha
          </button>
        </div>
      )}

      {erro ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{erro}</p>
      ) : carregando ? (
        <p className="py-10 text-center text-xs text-slate-400">Carregando usuários...</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Nome</th>
                  <th className="px-5 py-3.5">E-mail</th>
                  <th className="px-5 py-3.5">Papel</th>
                  <th className="px-5 py-3.5">Colaborador</th>
                  <th className="px-5 py-3.5">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {perfis.map((p) => (
                  <tr key={p.id} onClick={() => abrirEdicao(p)} className="cursor-pointer transition hover:bg-slate-50/80">
                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                      {p.full_name}
                      {p.id === user?.id && <span className="ml-2 text-[10px] font-medium text-slate-400">(você)</span>}
                    </td>
                    <td className="px-5 py-4">{p.email}</td>
                    <td className="px-5 py-4">{PAPEIS.find((x) => x.valor === p.role)?.rotulo ?? p.role}</td>
                    <td className="px-5 py-4">{p.colaborador?.name ?? <span className="text-slate-400">—</span>}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          p.active ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-700'
                        }`}
                      >
                        {p.active ? 'Ativo' : 'Bloqueado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">
                {modal.tipo === 'novo' ? 'Novo usuário' : 'Editar usuário'}
              </h3>
              <button type="button" onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={modal.tipo === 'novo' ? handleCriar : handleSalvarEdicao} className="mt-4 space-y-3.5">
              {erroModal && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erroModal}</div>
              )}

              <div>
                <label htmlFor="us-nome" className="block text-xs font-medium text-slate-700">Nome *</label>
                <input id="us-nome" type="text" value={nome} onChange={(e) => setNome(e.target.value)} className={INPUT} />
              </div>

              <div>
                <label htmlFor="us-email" className="block text-xs font-medium text-slate-700">E-mail (é o login) *</label>
                <input
                  id="us-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={modal.tipo === 'editar'}
                  className={`${INPUT} disabled:bg-slate-50 disabled:text-slate-500`}
                />
              </div>

              <div>
                <label htmlFor="us-papel" className="block text-xs font-medium text-slate-700">Papel</label>
                <select
                  id="us-papel"
                  value={papel}
                  onChange={(e) => setPapel(e.target.value as ProfileRole)}
                  disabled={ehEu}
                  className={`${INPUT} disabled:bg-slate-50`}
                >
                  {PAPEIS.map((p) => (
                    <option key={p.valor} value={p.valor}>{p.rotulo} — {p.descricao}</option>
                  ))}
                </select>
                {ehEu && <p className="mt-1 text-[11px] text-slate-400">Você não pode mudar o próprio papel.</p>}
              </div>

              <div>
                <label htmlFor="us-colab" className="block text-xs font-medium text-slate-700">Colaborador ligado a este login</label>
                <select id="us-colab" value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)} className={INPUT}>
                  <option value="">Nenhum (usuário do escritório)</option>
                  {colaboradoresLivres.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.active ? '' : ' (inativo)'}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">Para técnicos: liga o login à agenda dele.</p>
              </div>

              {modal.tipo === 'novo' ? (
                <div>
                  <label htmlFor="us-senha" className="block text-xs font-medium text-slate-700">Senha temporária *</label>
                  <div className="mt-1 flex gap-2">
                    <input
                      id="us-senha"
                      type="text"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      className="block w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setSenha(gerarSenhaTemporaria())}
                      className="shrink-0 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Gerar outra
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">Anote e passe para a pessoa: ela não será mostrada de novo.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      id="us-ativo"
                      type="checkbox"
                      checked={ativo}
                      onChange={(e) => setAtivo(e.target.checked)}
                      disabled={ehEu}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="us-ativo" className="text-xs text-slate-700">Ativo (desmarcar bloqueia a entrada no sistema)</label>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-600">Esqueceu a senha? Gere uma temporária nova.</span>
                      <button
                        type="button"
                        onClick={handleRedefinirSenha}
                        disabled={salvando}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      >
                        <KeyRound size={13} /> Redefinir senha
                      </button>
                    </div>
                    {senha && (
                      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                        <span className="font-mono text-sm text-slate-800">{senha}</span>
                        <button type="button" onClick={() => copiar(senha)} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                          <Copy size={12} /> Copiar
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setModal(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50">
                  {salvando ? 'Salvando...' : modal.tipo === 'novo' ? 'Criar usuário' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
