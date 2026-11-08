import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Plus, Star, X } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { mediasPorTecnico } from '../../services/avaliacoes';
import { listarCargos } from '../../services/cargos';
import {
  buscarDadosPessoais,
  listarColaboradores,
  listarPerfis,
  salvarColaborador,
  salvarDadosPessoais,
  type ColaboradorComLogin,
  type DadosPessoaisInput,
  type PerfilComColaborador,
} from '../../services/equipe';
import type { Cargo } from '../../types/fsm';
import { formatarTelefone } from '../../utils/telefone';
import { documentoValido, formatarDocumento } from '../../utils/documento';
import { buscarEnderecoPorCep, formatarCep } from '../../utils/cep';

const INPUT =
  'mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';
const ROTULO = 'block text-xs font-medium text-slate-700';

interface Formulario {
  id?: string;
  name: string;
  cargo_id: string;
  phone: string;
  email: string;
  timeline_color: string;
  active: boolean;
  profile_id: string;
}

const NOVO: Formulario = {
  name: '',
  cargo_id: '',
  phone: '',
  email: '',
  timeline_color: '#2563EB',
  active: true,
  profile_id: '',
};

type Dados = { [K in keyof DadosPessoaisInput]: string };

const DADOS_VAZIOS: Dados = {
  cpf: '',
  rg: '',
  rg_orgao: '',
  data_nascimento: '',
  ctps_numero: '',
  ctps_serie: '',
  ctps_uf: '',
  pis: '',
  data_admissao: '',
  registro_profissional: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
};

/** PIS/NIS: 11 dígitos, formato 000.00000.00-0. */
const formatarPis = (v: string) =>
  v
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{5})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{5})\.(\d{2})(\d)/, '$1.$2.$3-$4');

/** Funcionários: cadastro, cargo, login e (só admin) dados pessoais. */
export default function ColaboradoresTab() {
  const { profile } = useAuth();
  const ehAdmin = profile?.role === 'admin';

  const [lista, setLista] = useState<ColaboradorComLogin[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [perfis, setPerfis] = useState<PerfilComColaborador[]>([]);
  const [medias, setMedias] = useState<Map<string, { media: number; quantidade: number }>>(new Map());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'ativos' | 'inativos' | 'todos'>('ativos');
  const [form, setForm] = useState<Formulario | null>(null);
  const [dados, setDados] = useState<Dados>(DADOS_VAZIOS);
  const [carregandoDados, setCarregandoDados] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [c, cg, p, m] = await Promise.all([
        listarColaboradores(),
        listarCargos(),
        listarPerfis().catch(() => []),
        // Sem as avaliações a lista aparece mesmo assim
        mediasPorTecnico().catch(() => new Map<string, { media: number; quantidade: number }>()),
      ]);
      setLista(c);
      setCargos(cg);
      setPerfis(p);
      setMedias(m);
      setErro(null);
    } catch (e) {
      console.error('Erro ao listar funcionários:', e);
      setErro('Não foi possível carregar os funcionários.');
    } finally {
      setCarregando(false);
    }
  }, []);

  // Carga inicial (adiada um instante: o efeito não deve atualizar estado de forma síncrona)
  useEffect(() => {
    const timer = setTimeout(carregar, 0);
    return () => clearTimeout(timer);
  }, [carregar]);

  const campo = <K extends keyof Formulario>(chave: K, valor: Formulario[K]) =>
    setForm((f) => (f ? { ...f, [chave]: valor } : f));
  const dado = (chave: keyof Dados, valor: string) => setDados((d) => ({ ...d, [chave]: valor }));

  const abrirNovo = () => {
    setErroForm(null);
    setDados(DADOS_VAZIOS);
    // Novo funcionário já vem com o primeiro cargo de quem atende em campo
    const padrao = cargos.find((c) => c.ativo && c.categoria === 'tecnico') ?? cargos.find((c) => c.ativo);
    setForm({ ...NOVO, cargo_id: padrao?.id ?? '' });
  };

  const abrirEdicao = async (c: ColaboradorComLogin) => {
    setErroForm(null);
    setDados(DADOS_VAZIOS);
    setForm({
      id: c.id,
      name: c.name,
      cargo_id: c.cargo_id ?? '',
      phone: formatarTelefone(c.phone),
      email: c.email ?? '',
      timeline_color: c.timeline_color,
      active: c.active,
      profile_id: c.profile_id ?? '',
    });
    if (!ehAdmin) return;
    setCarregandoDados(true);
    try {
      const d = await buscarDadosPessoais(c.id);
      if (d) {
        setDados(
          Object.fromEntries(Object.keys(DADOS_VAZIOS).map((k) => [k, (d[k as keyof Dados] as string | null) ?? ''])) as Dados,
        );
      }
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : 'Não foi possível carregar os dados pessoais.');
    } finally {
      setCarregandoDados(false);
    }
  };

  const aoMudarCep = async (valor: string) => {
    const cep = formatarCep(valor);
    dado('cep', cep);
    const end = await buscarEnderecoPorCep(cep);
    if (end) {
      setDados((d) => ({
        ...d,
        logradouro: end.logradouro || d.logradouro,
        bairro: end.bairro || d.bairro,
        cidade: end.cidade || d.cidade,
        uf: end.uf || d.uf,
      }));
    }
  };

  const handleSalvar = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.name.trim()) return setErroForm('Informe o nome.');
    if (!form.cargo_id) return setErroForm('Escolha o cargo.');
    if (ehAdmin && dados.cpf && !documentoValido(dados.cpf, 'PF')) return setErroForm('CPF inválido. Confira os números.');
    if (ehAdmin && dados.pis && dados.pis.replace(/\D/g, '').length !== 11) return setErroForm('O PIS/NIS tem 11 dígitos.');
    setSalvando(true);
    setErroForm(null);
    try {
      const id = await salvarColaborador({ ...form, profile_id: form.profile_id || null });
      if (ehAdmin) {
        await salvarDadosPessoais(id, {
          ...dados,
          cpf: dados.cpf.replace(/\D/g, ''),
          pis: dados.pis.replace(/\D/g, ''),
          cep: dados.cep.replace(/\D/g, ''),
          ctps_uf: dados.ctps_uf.toUpperCase(),
          uf: dados.uf.toUpperCase(),
          data_nascimento: dados.data_nascimento || null,
          data_admissao: dados.data_admissao || null,
        });
      }
      setForm(null);
      await carregar();
    } catch (err) {
      console.error('Erro ao salvar funcionário:', err);
      setErroForm(err instanceof Error ? err.message : 'Erro ao salvar o funcionário.');
    } finally {
      setSalvando(false);
    }
  };

  const nomeCargo = (id: string | null) => cargos.find((c) => c.id === id)?.nome;
  const visiveis = lista.filter((c) => (filtro === 'todos' ? true : filtro === 'ativos' ? c.active : !c.active));
  // Logins ainda livres, mais o do próprio funcionário em edição
  const loginsDisponiveis = perfis.filter((p) => !p.colaborador || p.colaborador.id === form?.id);
  // Cargos ativos, mais o atual (se foi desativado)
  const cargosDisponiveis = cargos.filter((c) => c.ativo || c.id === form?.cargo_id);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-xl bg-slate-100 p-1">
          {(['ativos', 'inativos', 'todos'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                filtro === f ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={abrirNovo}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700"
        >
          <Plus size={18} />
          Novo funcionário
        </button>
      </div>

      {erro ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{erro}</p>
      ) : carregando ? (
        <p className="py-10 text-center text-xs text-slate-400">Carregando funcionários...</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Funcionário</th>
                  <th className="px-5 py-3.5">Cargo</th>
                  <th className="px-5 py-3.5">Avaliação</th>
                  <th className="px-5 py-3.5">Contato</th>
                  <th className="px-5 py-3.5">Login</th>
                  <th className="px-5 py-3.5">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {visiveis.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">Nenhum funcionário neste filtro.</td>
                  </tr>
                )}
                {visiveis.map((c) => (
                  <tr key={c.id} onClick={() => abrirEdicao(c)} className="cursor-pointer transition hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.timeline_color }} />
                        <span className="text-sm font-semibold text-slate-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">{nomeCargo(c.cargo_id) ?? <span className="text-slate-400">Sem cargo</span>}</td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {medias.get(c.id) ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Star size={13} className="fill-amber-400 text-amber-400" />
                          <b className="text-slate-800">{medias.get(c.id)!.media.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</b>
                          <span className="text-[11px] text-slate-400">({medias.get(c.id)!.quantidade})</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div>{c.phone ? formatarTelefone(c.phone) : <span className="text-slate-400">—</span>}</div>
                      {c.email && <div className="text-[11px] text-slate-400">{c.email}</div>}
                    </td>
                    <td className="px-5 py-4">
                      {c.profile ? c.profile.email : <span className="text-slate-400">Sem login</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          c.active ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                      >
                        {c.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-xl ${ehAdmin ? 'max-w-2xl' : 'max-w-lg'}`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">{form.id ? 'Editar funcionário' : 'Novo funcionário'}</h3>
              <button type="button" onClick={() => setForm(null)} className="text-slate-400 hover:text-slate-600" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSalvar} className="mt-4 space-y-3.5">
              {erroForm && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erroForm}</div>
              )}

              <div>
                <label htmlFor="co-nome" className={ROTULO}>Nome completo *</label>
                <input id="co-nome" type="text" value={form.name} onChange={(e) => campo('name', e.target.value)} className={INPUT} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="co-cargo" className={ROTULO}>Cargo *</label>
                  <select id="co-cargo" value={form.cargo_id} onChange={(e) => campo('cargo_id', e.target.value)} className={INPUT}>
                    <option value="">Escolha...</option>
                    {cargosDisponiveis.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}{c.ativo ? '' : ' (inativo)'}</option>
                    ))}
                  </select>
                  <Link to="/cargos" className="mt-1 inline-block text-[11px] font-semibold text-blue-600 hover:underline">
                    Cadastrar ou editar cargos
                  </Link>
                </div>
                <div>
                  <label htmlFor="co-cor" className={ROTULO}>Cor na linha do tempo</label>
                  <input
                    id="co-cor"
                    type="color"
                    value={form.timeline_color}
                    onChange={(e) => campo('timeline_color', e.target.value.toUpperCase())}
                    className="mt-1 block h-[38px] w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="co-tel" className={ROTULO}>Telefone</label>
                  <input id="co-tel" type="text" value={form.phone} onChange={(e) => campo('phone', formatarTelefone(e.target.value))} placeholder="(21) 99999-9999" className={INPUT} />
                </div>
                <div>
                  <label htmlFor="co-email" className={ROTULO}>E-mail</label>
                  <input id="co-email" type="email" value={form.email} onChange={(e) => campo('email', e.target.value)} className={INPUT} />
                </div>
              </div>

              <div>
                <label htmlFor="co-login" className={ROTULO}>Login de acesso ao app</label>
                <select id="co-login" value={form.profile_id} onChange={(e) => campo('profile_id', e.target.value)} className={INPUT}>
                  <option value="">Sem login (só cadastro)</option>
                  {loginsDisponiveis.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name} — {p.email}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Para criar um login novo, use a aba Usuários. Com o login ligado, o técnico vê só as próprias atividades.
                </p>
              </div>

              {ehAdmin && (
                <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4" disabled={carregandoDados}>
                  <legend className="flex items-center gap-1.5 px-1 text-xs font-bold text-slate-800">
                    <Lock size={13} className="text-amber-600" /> Dados pessoais {carregandoDados && '(carregando...)'}
                  </legend>
                  <p className="-mt-1 text-[11px] text-slate-500">Só o administrador vê estes dados (LGPD). Todos opcionais.</p>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div>
                      <label htmlFor="fd-cpf" className={ROTULO}>CPF</label>
                      <input id="fd-cpf" inputMode="numeric" value={dados.cpf} onChange={(e) => dado('cpf', formatarDocumento(e.target.value, 'PF'))} placeholder="000.000.000-00" className={INPUT} />
                    </div>
                    <div>
                      <label htmlFor="fd-rg" className={ROTULO}>RG</label>
                      <input id="fd-rg" value={dados.rg} onChange={(e) => dado('rg', e.target.value)} className={INPUT} />
                    </div>
                    <div>
                      <label htmlFor="fd-rg-orgao" className={ROTULO}>Órgão emissor / UF</label>
                      <input id="fd-rg-orgao" value={dados.rg_orgao} onChange={(e) => dado('rg_orgao', e.target.value)} placeholder="Detran/RJ" className={INPUT} />
                    </div>
                    <div>
                      <label htmlFor="fd-nasc" className={ROTULO}>Data de nascimento</label>
                      <input id="fd-nasc" type="date" value={dados.data_nascimento} onChange={(e) => dado('data_nascimento', e.target.value)} className={INPUT} />
                    </div>
                    <div>
                      <label htmlFor="fd-adm" className={ROTULO}>Data de admissão</label>
                      <input id="fd-adm" type="date" value={dados.data_admissao} onChange={(e) => dado('data_admissao', e.target.value)} className={INPUT} />
                    </div>
                    <div>
                      <label htmlFor="fd-pis" className={ROTULO}>PIS/NIS</label>
                      <input id="fd-pis" inputMode="numeric" value={dados.pis} onChange={(e) => dado('pis', formatarPis(e.target.value))} placeholder="000.00000.00-0" className={INPUT} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="fd-ctps" className={ROTULO}>Carteira de trabalho (nº)</label>
                      <input id="fd-ctps" value={dados.ctps_numero} onChange={(e) => dado('ctps_numero', e.target.value)} className={INPUT} />
                    </div>
                    <div>
                      <label htmlFor="fd-ctps-serie" className={ROTULO}>Série</label>
                      <input id="fd-ctps-serie" value={dados.ctps_serie} onChange={(e) => dado('ctps_serie', e.target.value)} className={INPUT} />
                    </div>
                    <div>
                      <label htmlFor="fd-ctps-uf" className={ROTULO}>UF</label>
                      <input id="fd-ctps-uf" maxLength={2} value={dados.ctps_uf} onChange={(e) => dado('ctps_uf', e.target.value.toUpperCase())} placeholder="RJ" className={INPUT} />
                    </div>
                  </div>
                  <p className="-mt-1 text-[11px] text-slate-500">
                    Carteira digital (desde 2019): o número é o próprio CPF; deixe número e série em branco.
                  </p>

                  <div>
                    <label htmlFor="fd-registro" className={ROTULO}>Registro profissional</label>
                    <input id="fd-registro" value={dados.registro_profissional} onChange={(e) => dado('registro_profissional', e.target.value)} placeholder="Ex.: CFT 123456789" className={INPUT} />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="fd-cep" className={ROTULO}>CEP</label>
                      <input id="fd-cep" inputMode="numeric" value={dados.cep} onChange={(e) => aoMudarCep(e.target.value)} placeholder="24000-000" className={INPUT} />
                    </div>
                    <div className="col-span-2">
                      <label htmlFor="fd-rua" className={ROTULO}>Rua</label>
                      <input id="fd-rua" value={dados.logradouro} onChange={(e) => dado('logradouro', e.target.value)} className={INPUT} />
                    </div>
                    <div>
                      <label htmlFor="fd-num" className={ROTULO}>Número</label>
                      <input id="fd-num" value={dados.numero} onChange={(e) => dado('numero', e.target.value)} className={INPUT} />
                    </div>
                    <div className="col-span-2">
                      <label htmlFor="fd-compl" className={ROTULO}>Complemento</label>
                      <input id="fd-compl" value={dados.complemento} onChange={(e) => dado('complemento', e.target.value)} className={INPUT} />
                    </div>
                    <div>
                      <label htmlFor="fd-bairro" className={ROTULO}>Bairro</label>
                      <input id="fd-bairro" value={dados.bairro} onChange={(e) => dado('bairro', e.target.value)} className={INPUT} />
                    </div>
                    <div>
                      <label htmlFor="fd-cidade" className={ROTULO}>Cidade</label>
                      <input id="fd-cidade" value={dados.cidade} onChange={(e) => dado('cidade', e.target.value)} className={INPUT} />
                    </div>
                    <div>
                      <label htmlFor="fd-uf" className={ROTULO}>UF</label>
                      <input id="fd-uf" maxLength={2} value={dados.uf} onChange={(e) => dado('uf', e.target.value.toUpperCase())} className={INPUT} />
                    </div>
                  </div>
                </fieldset>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="co-ativo"
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => campo('active', e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="co-ativo" className="text-xs text-slate-700">
                  Ativo (quem atende em campo aparece na linha do tempo e na escolha do técnico)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setForm(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando || carregandoDados} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
