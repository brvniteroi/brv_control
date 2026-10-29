import { useState, type FormEvent } from 'react';
import { Building, MapPin, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import {
  alternarEnderecoAtivo,
  definirEnderecoPrincipal,
  removerEndereco,
  salvarEnderecoCliente,
} from '../../services/clientes';
import { geocodificar, textoEndereco } from '../../services/googleMaps';
import type { CustomerAddress } from '../../types/fsm';

interface EnderecosAdicionaisProps {
  /** Cliente já salvo; null enquanto o cadastro é novo. */
  clienteId: string | null;
  /** Endereços que não são o principal (ativos e inativos). */
  enderecos: CustomerAddress[];
  /** Chamado depois de qualquer alteração, para a tela recarregar o cliente. */
  onAlterado: () => Promise<void>;
}

interface FormEndereco {
  label: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  referencia: string;
  principal: boolean;
}

const FORM_VAZIO: FormEndereco = {
  label: '',
  cep: '',
  rua: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: 'Niterói',
  estado: 'RJ',
  referencia: '',
  principal: false,
};

const INPUT =
  'mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

// "Principal" é o apelido que o endereço recebe ao ser criado como principal; ao deixar
// de ser o principal ele não deve continuar com esse nome.
function apelido(e: CustomerAddress): string {
  return e.label && e.label !== 'Principal' ? e.label : '';
}

function linhaEndereco(e: CustomerAddress): string {
  const via = [e.street, e.number].filter(Boolean).join(', ');
  const resto = [e.complement, e.district, `${e.city}/${e.state}`].filter(Boolean).join(' · ');
  return [via, resto].filter(Boolean).join(' — ');
}

export default function EnderecosAdicionais({ clienteId, enderecos, onAlterado }: EnderecosAdicionaisProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormEndereco>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const campo = (chave: keyof FormEndereco, valor: string | boolean) =>
    setForm((f) => ({ ...f, [chave]: valor }));

  const abrirNovo = () => {
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setErro(null);
    setModalAberto(true);
  };

  const abrirEdicao = (e: CustomerAddress) => {
    setEditandoId(e.id);
    setForm({
      label: apelido(e),
      cep: e.zip_code ?? '',
      rua: e.street,
      numero: e.number ?? '',
      complemento: e.complement ?? '',
      bairro: e.district ?? '',
      cidade: e.city,
      estado: e.state,
      referencia: e.reference ?? '',
      principal: false,
    });
    setErro(null);
    setModalAberto(true);
  };

  const buscarCep = async (entrada: string) => {
    const digitos = entrada.replace(/\D/g, '').slice(0, 8);
    campo('cep', digitos.replace(/^(\d{5})(\d{1,3})$/, '$1-$2'));
    if (digitos.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      const dados = await res.json();
      if (dados.erro) return;
      setForm((f) => ({
        ...f,
        rua: dados.logradouro || f.rua,
        bairro: dados.bairro || f.bairro,
        cidade: dados.localidade || f.cidade,
        estado: dados.uf || f.estado,
      }));
    } catch (e) {
      console.error('Falha ao consultar CEP', e);
    }
  };

  const executar = async (acao: () => Promise<string | void>) => {
    setAviso(null);
    try {
      const mensagem = await acao();
      if (mensagem) setAviso(mensagem);
      await onAlterado();
    } catch (e) {
      console.error('Erro ao alterar endereço:', e);
      setAviso(e instanceof Error ? e.message : 'Não foi possível concluir a operação.');
    }
  };

  const handleSalvar = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!clienteId) return;
    if (!form.rua.trim()) {
      setErro('Informe o logradouro.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const dados = {
        street: form.rua.trim(),
        number: form.numero.trim() || null,
        district: form.bairro.trim() || null,
        city: form.cidade.trim() || 'Niterói',
        state: form.estado.trim() || 'RJ',
        zip_code: form.cep,
      };
      // Coordenadas para o mapa; se o endereço mudou e não foi localizado, as antigas são apagadas
      const original = enderecos.find((e) => e.id === editandoId);
      const achadas = await geocodificar(dados);
      const coordenadas =
        achadas ?? (!original || textoEndereco(dados) !== textoEndereco(original) ? { latitude: null, longitude: null } : {});

      await salvarEnderecoCliente(
        clienteId,
        {
          ...coordenadas,
          label: form.label.trim() || null,
          zip_code: form.cep,
          street: form.rua.trim(),
          number: form.numero.trim() || null,
          complement: form.complemento.trim() || null,
          district: form.bairro.trim() || null,
          city: form.cidade.trim() || 'Niterói',
          state: form.estado.trim() || 'RJ',
          reference: form.referencia.trim() || null,
        },
        { id: editandoId ?? undefined, principal: form.principal },
      );
      setModalAberto(false);
      await onAlterado();
    } catch (e) {
      console.error('Erro ao salvar endereço:', e);
      setErro(e instanceof Error ? e.message : 'Erro ao salvar o endereço.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = (e: CustomerAddress) => {
    const nome = apelido(e) || e.street;
    if (!window.confirm(`Excluir o endereço "${nome}"?\n\nSe já foi usado em OS ou equipamentos, ele será apenas desativado.`)) {
      return;
    }
    executar(async () => {
      const resultado = await removerEndereco(e.id);
      return resultado === 'desativado'
        ? 'Este endereço já tem histórico (OS ou equipamentos) e foi desativado em vez de excluído.'
        : undefined;
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-800">
          <Building size={18} className="text-blue-600" />
          <h2 className="text-base font-bold">Outros endereços de atendimento</h2>
        </div>
        <button
          type="button"
          onClick={abrirNovo}
          disabled={!clienteId}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={14} />
          Adicionar endereço
        </button>
      </div>

      <p className="mt-1 text-xs text-slate-500">
        Filiais, obras ou outros locais do mesmo cliente. Na hora de criar a OS você escolhe qual usar.
      </p>

      {!clienteId && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Salve o cliente primeiro para cadastrar outros endereços.
        </p>
      )}

      {aviso && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {aviso}
        </p>
      )}

      {clienteId && enderecos.length === 0 && (
        <p className="mt-4 text-xs text-slate-400">Nenhum outro endereço cadastrado.</p>
      )}

      <ul className="mt-4 space-y-2">
        {enderecos.map((e) => (
          <li
            key={e.id}
            className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-3 ${
              e.active ? 'border-slate-200' : 'border-slate-100 bg-slate-50 opacity-70'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <MapPin size={14} className="shrink-0 text-blue-500" />
                <span className="truncate">{apelido(e) || 'Sem apelido'}</span>
                {!e.active && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    Inativo
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">{linhaEndereco(e)}</div>
              {e.reference && <div className="mt-0.5 text-[11px] text-slate-400">Ref.: {e.reference}</div>}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => abrirEdicao(e)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50"
              >
                <Pencil size={12} /> Editar
              </button>
              <button
                type="button"
                onClick={() => executar(() => definirEnderecoPrincipal(e.id))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50"
                title="Passa a ser o endereço principal do cliente"
              >
                <Star size={12} /> Tornar principal
              </button>
              <button
                type="button"
                onClick={() => executar(() => alternarEnderecoAtivo(e.id, !e.active))}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50"
              >
                {e.active ? 'Desativar' : 'Reativar'}
              </button>
              <button
                type="button"
                onClick={() => handleExcluir(e)}
                className="inline-flex items-center rounded-lg border border-red-100 p-1.5 text-red-500 hover:bg-red-50"
                aria-label="Excluir endereço"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">
                {editandoId ? 'Editar endereço' : 'Adicionar endereço'}
              </h3>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSalvar} className="mt-4 space-y-3.5">
              {erro && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {erro}
                </div>
              )}

              <div>
                <label htmlFor="end-label" className="block text-xs font-medium text-slate-700">
                  Apelido do local
                </label>
                <input
                  id="end-label"
                  type="text"
                  value={form.label}
                  onChange={(e) => campo('label', e.target.value)}
                  placeholder="Ex: Loja Icaraí, Obra Rua X, Filial Centro"
                  className={INPUT}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="end-cep" className="block text-xs font-medium text-slate-700">
                    CEP
                  </label>
                  <input
                    id="end-cep"
                    type="text"
                    maxLength={9}
                    value={form.cep}
                    onChange={(e) => buscarCep(e.target.value)}
                    placeholder="24000-000"
                    className={INPUT}
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="end-rua" className="block text-xs font-medium text-slate-700">
                    Logradouro *
                  </label>
                  <input
                    id="end-rua"
                    type="text"
                    value={form.rua}
                    onChange={(e) => campo('rua', e.target.value)}
                    className={INPUT}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="end-num" className="block text-xs font-medium text-slate-700">
                    Número
                  </label>
                  <input
                    id="end-num"
                    type="text"
                    value={form.numero}
                    onChange={(e) => campo('numero', e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="end-comp" className="block text-xs font-medium text-slate-700">
                    Complemento
                  </label>
                  <input
                    id="end-comp"
                    type="text"
                    value={form.complemento}
                    onChange={(e) => campo('complemento', e.target.value)}
                    className={INPUT}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label htmlFor="end-bairro" className="block text-xs font-medium text-slate-700">
                    Bairro
                  </label>
                  <input
                    id="end-bairro"
                    type="text"
                    value={form.bairro}
                    onChange={(e) => campo('bairro', e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label htmlFor="end-cidade" className="block text-xs font-medium text-slate-700">
                    Cidade / UF
                  </label>
                  <div className="mt-1 flex gap-1">
                    <input
                      id="end-cidade"
                      type="text"
                      value={form.cidade}
                      onChange={(e) => campo('cidade', e.target.value)}
                      className="block w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      maxLength={2}
                      aria-label="UF"
                      value={form.estado}
                      onChange={(e) => campo('estado', e.target.value.toUpperCase())}
                      className="block w-12 rounded-lg border border-slate-200 px-1 py-2 text-center text-sm font-semibold focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="end-ref" className="block text-xs font-medium text-slate-700">
                  Ponto de referência para o técnico
                </label>
                <input
                  id="end-ref"
                  type="text"
                  value={form.referencia}
                  onChange={(e) => campo('referencia', e.target.value)}
                  className={INPUT}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="end-princ"
                  type="checkbox"
                  checked={form.principal}
                  onChange={(e) => campo('principal', e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="end-princ" className="text-xs text-slate-700">
                  Definir como endereço principal do cliente
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Salvar endereço'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
