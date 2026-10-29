import { useState, useEffect, useRef, type FormEvent } from 'react';
import {
  Archive,
  ArchiveRestore,
  Camera,
  Check,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  User,
  X,
} from 'lucide-react';
import {
  buscarClientePorId,
  salvarCliente,
  alternarStatusCliente,
  adicionarContato,
  removerContato,
} from '../../services/clientes';
import type { CustomerAddress, CustomerContact, PersonType } from '../../types/fsm';
import EnderecosAdicionais from './EnderecosAdicionais';
import MapaEnderecos from './MapaEnderecos';
import { geocodificar, textoEndereco } from '../../services/googleMaps';
import { documentoValido, formatarDocumento, limparDocumento } from '../../utils/documento';

interface ClienteDetalhesProps {
  clienteId: string | 'novo';
  onFechar: () => void;
  onSalvo: (id: string) => void;
}

type AbaAtiva = 'geral' | 'atendimento' | 'modelos' | 'anexos' | 'customizados' | 'historico';

interface AbaItem {
  id: AbaAtiva;
  rotulo: string;
  badge?: number;
}

const ABAS: AbaItem[] = [
  { id: 'geral', rotulo: 'Geral' },
  { id: 'atendimento', rotulo: 'Atendimento' },
  { id: 'modelos', rotulo: 'Modelos' },
  { id: 'anexos', rotulo: 'Anexos', badge: 0 },
  { id: 'customizados', rotulo: 'Campos customizados' },
  { id: 'historico', rotulo: 'Histórico' },
];

export default function ClienteDetalhes({ clienteId, onFechar, onSalvo }: ClienteDetalhesProps) {
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('geral');
  const [carregando, setCarregando] = useState(clienteId !== 'novo');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  // Dados do formulário
  const [nome, setNome] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [tipoPessoa, setTipoPessoa] = useState<PersonType>('PF');
  const [documento, setDocumento] = useState('');
  // Documento como veio do banco: só é revalidado se o usuário alterar
  const [documentoOriginal, setDocumentoOriginal] = useState('');
  const [inscricaoEstadual, setInscricaoEstadual] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [criadoEm, setCriadoEm] = useState<string | null>(null);

  // Endereço
  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('Niterói');
  const [estado, setEstado] = useState('RJ');
  const [referencia, setReferencia] = useState('');
  // Demais endereços de atendimento do cliente (o principal é o formulário acima)
  const [enderecosExtras, setEnderecosExtras] = useState<CustomerAddress[]>([]);
  const [todosEnderecos, setTodosEnderecos] = useState<CustomerAddress[]>([]);
  const enderecoPrincipalId = useRef<string | null>(null);
  // Texto do endereço principal como está salvo: indica se ele mudou (coordenadas antigas deixam de valer)
  const enderecoPrincipalTexto = useRef<string | null>(null);

  const preencherEndereco = (endereco: CustomerAddress) => {
    enderecoPrincipalId.current = endereco.id;
    enderecoPrincipalTexto.current = textoEndereco(endereco);
    setCep(endereco.zip_code || '');
    setRua(endereco.street || '');
    setNumero(endereco.number || '');
    setComplemento(endereco.complement || '');
    setBairro(endereco.district || '');
    setCidade(endereco.city || 'Niterói');
    setEstado(endereco.state || 'RJ');
    setReferencia(endereco.reference || '');
  };

  // Contatos
  const [contatos, setContatos] = useState<CustomerContact[]>([]);
  const [modalContatoAberto, setModalContatoAberto] = useState(false);
  const [contatoNome, setContatoNome] = useState('');
  const [contatoFuncao, setContatoFuncao] = useState('Celular');
  const [contatoTelefone, setContatoTelefone] = useState('');
  const [contatoEmail, setContatoEmail] = useState('');
  const [contatoWhatsapp, setContatoWhatsapp] = useState(true);
  const [contatoPrincipal, setContatoPrincipal] = useState(false);

  // Etiquetas
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [modalEtiquetaAberto, setModalEtiquetaAberto] = useState(false);
  const [novaEtiqueta, setNovaEtiqueta] = useState('');

  useEffect(() => {
    if (clienteId === 'novo') {
      return;
    }

    let ativo = true;

    buscarClientePorId(clienteId)
      .then((cliente) => {
        if (!ativo || !cliente) return;
        setNome(cliente.name || '');
        setNomeFantasia(cliente.trade_name || '');
        const tipo = cliente.person_type || 'PF';
        setTipoPessoa(tipo);
        setDocumento(formatarDocumento(cliente.document || '', tipo));
        setDocumentoOriginal(limparDocumento(cliente.document || '', tipo));
        setInscricaoEstadual(cliente.state_registration || '');
        setObservacoes(cliente.notes || '');
        setAtivo(cliente.active);
        setCriadoEm(cliente.created_at);
        setContatos(cliente.contacts || []);

        const enderecos = cliente.addresses || [];
        const principal = enderecos.find((e) => e.is_primary);
        if (principal) preencherEndereco(principal);
        setEnderecosExtras(enderecos.filter((e) => !e.is_primary));
        setTodosEnderecos(enderecos);
      })
      .catch((err: unknown) => {
        if (ativo) {
          console.error('Erro ao buscar cliente:', err);
          setErro('Não foi possível carregar as informações do cliente.');
        }
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [clienteId]);

  // Depois de alterar endereços: atualiza a lista e, se o principal mudou
  // (ex.: "Tornar principal"), o formulário. Edições não salvas do principal são mantidas.
  const recarregarEnderecos = async () => {
    if (clienteId === 'novo') return;
    const cliente = await buscarClientePorId(clienteId);
    if (!cliente) return;
    const principal = cliente.addresses.find((e) => e.is_primary);
    if (principal && principal.id !== enderecoPrincipalId.current) preencherEndereco(principal);
    setEnderecosExtras(cliente.addresses.filter((e) => !e.is_primary));
    setTodosEnderecos(cliente.addresses);
  };

  // Formatação amigável da data de criação
  const formatarDataCriacao = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    const horas = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `Criado ${dia}/${mes}/${ano} ${horas}:${min}`;
  };

  const handleDocumentoChange = (v: string) => {
    setDocumento(formatarDocumento(v, tipoPessoa));
  };

  // Trocar PF/PJ reaplica a máscara (PF = CPF, PJ = CNPJ, inclusive alfanumérico)
  const handleTipoPessoaChange = (tipo: PersonType) => {
    setTipoPessoa(tipo);
    setDocumento(formatarDocumento(documento, tipo));
  };

  // Busca CEP automático via ViaCEP
  const buscarCep = async (cepEntrada: string) => {
    const apenasDigitos = cepEntrada.replace(/\D/g, '');
    setCep(apenasDigitos.replace(/^(\d{5})(\d{3})$/, '$1-$2'));
    if (apenasDigitos.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${apenasDigitos}/json/`);
        const dados = await res.json();
        if (!dados.erro) {
          setRua(dados.logradouro || '');
          setBairro(dados.bairro || '');
          setCidade(dados.localidade || 'Niterói');
          setEstado(dados.uf || 'RJ');
        }
      } catch (e) {
        console.error('Falha ao consultar CEP', e);
      }
    }
  };

  const handleSalvar = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setErro(null);

    if (!nome.trim()) {
      setErro('O campo Nome é obrigatório.');
      return;
    }

    // Documento herdado do banco (ex.: importado) só é conferido se for alterado
    const documentoLimpo = limparDocumento(documento, tipoPessoa);
    if (documentoLimpo !== documentoOriginal && !documentoValido(documento, tipoPessoa)) {
      setErro(
        tipoPessoa === 'PF'
          ? 'CPF inválido. Confira os 11 dígitos.'
          : 'CNPJ inválido. Confira os 14 caracteres.',
      );
      return;
    }

    setSalvando(true);
    try {
      // Coordenadas do endereço principal para o mapa. Se o endereço mudou e não foi
      // possível localizá-lo, as antigas são apagadas (apontariam para o lugar errado).
      let coordenadas: { latitude: number | null; longitude: number | null } | undefined;
      if (rua.trim()) {
        const dadosEndereco = { street: rua, number: numero, district: bairro, city: cidade, state: estado, zip_code: cep };
        const achadas = await geocodificar(dadosEndereco);
        if (achadas) coordenadas = achadas;
        else if (textoEndereco(dadosEndereco) !== enderecoPrincipalTexto.current) {
          coordenadas = { latitude: null, longitude: null };
        }
      }

      const id = await salvarCliente({
        id: clienteId === 'novo' ? undefined : clienteId,
        name: nome.trim(),
        trade_name: nomeFantasia.trim() || null,
        person_type: tipoPessoa,
        document: documentoLimpo || null,
        state_registration: inscricaoEstadual,
        notes: observacoes,
        active: ativo,
        // Contatos adicionados antes do primeiro "Salvar" (ids temporários)
        contacts: contatos.map((c) => ({
          name: c.name,
          role: c.role,
          phone: c.phone,
          email: c.email,
          is_whatsapp: c.is_whatsapp,
          is_primary: c.is_primary,
        })),
        address: rua.trim()
          ? {
              label: 'Principal',
              zip_code: cep,
              street: rua.trim(),
              number: numero.trim() || null,
              complement: complemento.trim() || null,
              district: bairro.trim() || null,
              city: cidade.trim() || 'Niterói',
              state: estado.trim() || 'RJ',
              reference: referencia.trim() || null,
              ...coordenadas,
            }
          : null,
      });

      setDocumentoOriginal(documentoLimpo);
      if (clienteId !== 'novo') await recarregarEnderecos();
      setSucesso(true);
      setTimeout(() => setSucesso(false), 2500);
      onSalvo(id);
    } catch (err: unknown) {
      console.error('Erro ao salvar cliente:', err);
      const msg = err instanceof Error ? err.message : 'Erro ao salvar alterações no cliente.';
      setErro(msg);
    } finally {
      setSalvando(false);
    }
  };

  const handleAlternarArquivo = async () => {
    if (clienteId === 'novo') return;
    try {
      await alternarStatusCliente(clienteId, !ativo);
      setAtivo(!ativo);
      onSalvo(clienteId);
    } catch (err: unknown) {
      console.error('Erro ao arquivar/reativar:', err);
      setErro('Não foi possível alterar o status de arquivamento.');
    }
  };

  const fecharModalContato = () => {
    setContatoNome('');
    setContatoTelefone('');
    setContatoEmail('');
    setContatoFuncao('Celular');
    setContatoWhatsapp(true);
    setContatoPrincipal(false);
    setModalContatoAberto(false);
  };

  const handleAdicionarContato = async (e: FormEvent) => {
    e.preventDefault();
    if (!contatoTelefone.trim() && !contatoEmail.trim()) {
      return;
    }

    const dadosContato = {
      name: contatoNome.trim() || nome.trim() || 'Contato',
      role: contatoFuncao.trim() || 'Telefone',
      phone: contatoTelefone.trim() || null,
      email: contatoEmail.trim() || null,
      is_whatsapp: contatoWhatsapp,
      is_primary: contatos.length === 0 || contatoPrincipal,
    };

    if (clienteId === 'novo') {
      const novo: CustomerContact = {
        ...dadosContato,
        id: `temp-${crypto.randomUUID()}`,
        customer_id: '',
        created_at: '',
      };
      // Só um principal: o novo substitui o anterior
      setContatos((prev) => [
        ...(novo.is_primary ? prev.map((c) => ({ ...c, is_primary: false })) : prev),
        novo,
      ]);
      fecharModalContato();
      return;
    }

    try {
      await adicionarContato(clienteId, dadosContato);
      await recarregarContatos(clienteId);
      fecharModalContato();
    } catch (err: unknown) {
      console.error('Erro ao cadastrar contato:', err);
      setErro('Erro ao adicionar contato.');
    }
  };

  // O banco rebaixa/promove o contato principal; recarregar traz o estado real
  const recarregarContatos = async (id: string) => {
    const cliente = await buscarClientePorId(id);
    if (cliente) setContatos(cliente.contacts);
  };

  const handleRemoverContato = async (id: string) => {
    if (clienteId === 'novo') {
      setContatos((prev) => {
        const restantes = prev.filter((c) => c.id !== id);
        // Removeu o principal: o primeiro que sobrar assume
        if (restantes.length > 0 && !restantes.some((c) => c.is_primary)) {
          restantes[0] = { ...restantes[0], is_primary: true };
        }
        return restantes;
      });
      return;
    }

    try {
      await removerContato(id);
      await recarregarContatos(clienteId);
    } catch (err) {
      console.error('Erro ao excluir contato:', err);
      setErro('Não foi possível excluir o contato.');
    }
  };

  const handleAdicionarEtiqueta = () => {
    if (novaEtiqueta.trim() && !etiquetas.includes(novaEtiqueta.trim())) {
      setEtiquetas([...etiquetas, novaEtiqueta.trim()]);
      setNovaEtiqueta('');
      setModalEtiquetaAberto(false);
    }
  };

  const handleRemoverEtiqueta = (tag: string) => {
    setEtiquetas(etiquetas.filter((t) => t !== tag));
  };

  if (carregando) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          <span className="text-sm font-medium">Carregando dados do cliente...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16">
      {/* 1. Barra de Cabeçalho Superior - Idêntica ao Field Control */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Pencil size={18} />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {nome || (clienteId === 'novo' ? 'Novo Cliente' : 'Cliente sem nome')}
              </h1>
              {criadoEm && (
                <span className="text-xs italic text-slate-500 font-normal">
                  {formatarDataCriacao(criadoEm)}
                </span>
              )}
            </div>
            {!ativo && (
              <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                Arquivado
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sucesso && (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
              <Check size={14} /> Salvo com sucesso!
            </span>
          )}

          <button
            type="button"
            onClick={() => handleSalvar()}
            disabled={salvando}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50"
          >
            {salvando ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                <span>Salvando...</span>
              </>
            ) : (
              'Salvar'
            )}
          </button>

          {clienteId !== 'novo' && (
            <button
              type="button"
              onClick={handleAlternarArquivo}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              title={ativo ? 'Arquivar cliente' : 'Reativar cliente'}
            >
              {ativo ? <Archive size={16} /> : <ArchiveRestore size={16} />}
              <span>{ativo ? 'Arquivar' : 'Reativar'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onFechar}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 2. Barra de Abas - Geral, Atendimento, Modelos, Anexos, Campos customizados, Histórico */}
      <div className="border-b border-slate-200 bg-white px-6">
        <nav className="flex space-x-8">
          {ABAS.map((aba) => {
            const ativa = abaAtiva === aba.id;
            return (
              <button
                key={aba.id}
                type="button"
                onClick={() => setAbaAtiva(aba.id)}
                className={`relative py-3.5 text-sm font-medium transition-colors ${
                  ativa ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {aba.rotulo}
                  {aba.badge !== undefined && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                      {aba.badge}
                    </span>
                  )}
                </span>
                {ativa && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-blue-600" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Feedback de erro */}
      {erro && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {erro}
        </div>
      )}

      {/* 3. Conteúdo Principal da Aba Geral */}
      {abaAtiva === 'geral' && (
        <div className="mt-6 px-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Coluna Esquerda: Dados do Cliente (8 cols) */}
            <div className="space-y-6 lg:col-span-8">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <h2 className="text-base font-bold text-slate-800">Dados do cliente</h2>

                {/* Avatar e botão de imagem */}
                <div className="mt-5 flex items-center gap-5">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-blue-50/70 text-blue-500">
                    <User size={44} />
                  </div>
                  <div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-3.5 py-2 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                    >
                      <Camera size={14} />
                      Adicionar imagem
                    </button>
                    <p className="mt-1.5 text-xs text-slate-400">
                      Imagens de no máximo 2 MB de tamanho.
                    </p>
                  </div>
                </div>

                {/* Etiquetas */}
                <div className="mt-6">
                  <span className="block text-xs font-semibold text-slate-600">Etiquetas</span>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {etiquetas.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 border border-blue-200"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoverEtiqueta(tag)}
                          className="hover:text-red-500"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => setModalEtiquetaAberto(true)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-blue-400 bg-white px-3.5 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                    >
                      <Plus size={14} />
                      Adicionar etiquetas
                    </button>
                  </div>
                </div>

                {/* Formulário de Campos */}
                <form onSubmit={handleSalvar} className="mt-6 space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Nome */}
                    <div>
                      <div className="flex justify-between text-xs font-medium text-slate-700">
                        <label htmlFor="cli-nome">Nome *</label>
                        <span className="text-slate-400">{nome.length} / 150</span>
                      </div>
                      <input
                        id="cli-nome"
                        type="text"
                        required
                        maxLength={150}
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        placeholder="Nome completo ou Razão Social"
                        className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                      <span className="mt-1 block text-[11px] text-slate-400">
                        Não mais que 150 caracteres
                      </span>
                    </div>

                    {/* CPF/CNPJ */}
                    <div>
                      <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                        <label htmlFor="cli-doc">{tipoPessoa === 'PF' ? 'CPF' : 'CNPJ'}</label>
                        <div className="flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Tipo de pessoa">
                          {(['PF', 'PJ'] as const).map((tipo) => (
                            <button
                              key={tipo}
                              type="button"
                              onClick={() => handleTipoPessoaChange(tipo)}
                              aria-pressed={tipoPessoa === tipo}
                              className={`rounded-md px-2.5 py-0.5 text-[11px] font-semibold transition ${
                                tipoPessoa === tipo
                                  ? 'bg-white text-blue-600 shadow-2xs'
                                  : 'text-slate-500 hover:text-slate-700'
                              }`}
                            >
                              {tipo === 'PF' ? 'Pessoa física' : 'Pessoa jurídica'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        id="cli-doc"
                        type="text"
                        maxLength={18}
                        value={documento}
                        onChange={(e) => handleDocumentoChange(e.target.value)}
                        placeholder={tipoPessoa === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                        className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Nome Fantasia (opcional) */}
                    <div>
                      <label htmlFor="cli-fantasia" className="block text-xs font-medium text-slate-700">
                        Nome Fantasia (se PJ)
                      </label>
                      <input
                        id="cli-fantasia"
                        type="text"
                        value={nomeFantasia}
                        onChange={(e) => setNomeFantasia(e.target.value)}
                        placeholder="Nome fantasia comercial"
                        className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    {/* Inscrição Estadual (opcional) */}
                    <div>
                      <label htmlFor="cli-ie" className="block text-xs font-medium text-slate-700">
                        Inscrição Estadual
                      </label>
                      <input
                        id="cli-ie"
                        type="text"
                        value={inscricaoEstadual}
                        onChange={(e) => setInscricaoEstadual(e.target.value)}
                        placeholder="Isento ou número da IE"
                        className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Observações */}
                  <div>
                    <label htmlFor="cli-obs" className="block text-xs font-medium text-slate-700">
                      Observações
                    </label>
                    <textarea
                      id="cli-obs"
                      rows={3}
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      placeholder="Digite aqui"
                      className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </form>
              </div>

              {/* Card de Endereço Principal */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <div className="flex items-center gap-2 text-slate-800">
                  <MapPin size={18} className="text-blue-600" />
                  <h2 className="text-base font-bold">Endereço Principal do Cliente</h2>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="cli-cep" className="block text-xs font-medium text-slate-700">
                      CEP
                    </label>
                    <input
                      id="cli-cep"
                      type="text"
                      maxLength={9}
                      value={cep}
                      onChange={(e) => buscarCep(e.target.value)}
                      placeholder="24000-000"
                      className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="cli-rua" className="block text-xs font-medium text-slate-700">
                      Logradouro (Rua, Av...) *
                    </label>
                    <input
                      id="cli-rua"
                      type="text"
                      value={rua}
                      onChange={(e) => setRua(e.target.value)}
                      placeholder="Ex: Rua Coronel Moreira César"
                      className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <div>
                    <label htmlFor="cli-num" className="block text-xs font-medium text-slate-700">
                      Número
                    </label>
                    <input
                      id="cli-num"
                      type="text"
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      placeholder="123"
                      className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="cli-comp" className="block text-xs font-medium text-slate-700">
                      Complemento
                    </label>
                    <input
                      id="cli-comp"
                      type="text"
                      value={complemento}
                      onChange={(e) => setComplemento(e.target.value)}
                      placeholder="Apto 402, Bloco B"
                      className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="cli-bairro" className="block text-xs font-medium text-slate-700">
                      Bairro
                    </label>
                    <input
                      id="cli-bairro"
                      type="text"
                      value={bairro}
                      onChange={(e) => setBairro(e.target.value)}
                      placeholder="Icaraí"
                      className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="cli-cidade" className="block text-xs font-medium text-slate-700">
                      Cidade / UF
                    </label>
                    <div className="mt-1.5 flex gap-1">
                      <input
                        id="cli-cidade"
                        type="text"
                        value={cidade}
                        onChange={(e) => setCidade(e.target.value)}
                        placeholder="Niterói"
                        className="block w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                      <input
                        id="cli-uf"
                        type="text"
                        maxLength={2}
                        value={estado}
                        onChange={(e) => setEstado(e.target.value.toUpperCase())}
                        className="block w-14 rounded-lg border border-slate-200 px-2 py-2 text-center text-sm font-semibold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <label htmlFor="cli-ref" className="block text-xs font-medium text-slate-700">
                    Ponto de Referência para o Técnico
                  </label>
                  <input
                    id="cli-ref"
                    type="text"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder="Ex: Próximo à padaria, interfone 301"
                    className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <EnderecosAdicionais
                clienteId={clienteId === 'novo' ? null : clienteId}
                enderecos={enderecosExtras}
                onAlterado={recarregarEnderecos}
              />

              <MapaEnderecos enderecos={todosEnderecos} />
            </div>

            {/* Coluna Direita: Contatos (4 cols) - Idêntico ao Field Control */}
            <div className="space-y-4 lg:col-span-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">
                  Contatos ({contatos.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setModalContatoAberto(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-400 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 shadow-2xs transition hover:bg-blue-50"
                >
                  Adicionar contato
                  <span className="text-[10px]">▼</span>
                </button>
              </div>

              {contatos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
                  Nenhum contato cadastrado ainda.
                  <button
                    type="button"
                    onClick={() => setModalContatoAberto(true)}
                    className="mt-2 block w-full font-semibold text-blue-600 hover:underline"
                  >
                    + Clique para adicionar
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-500">
                    Telefone ({contatos.length})
                  </div>

                  {contatos.map((contato) => (
                    <div
                      key={contato.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
                    >
                      {/* Cabeçalho do Card de Contato */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                            <Phone size={15} />
                          </div>
                          <span className="text-xs font-semibold text-slate-800">
                            Telefone{' '}
                            {contato.is_primary && (
                              <span className="italic font-normal text-slate-400">
                                (Principal)
                              </span>
                            )}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleRemoverContato(contato.id)}
                            className="rounded-md p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                            title="Remover contato"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Conteúdo do Contato */}
                      <div className="pt-3">
                        <div className="text-[11px] font-medium text-slate-400">
                          {contato.role || 'Telefone'}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
                          <span>🇧🇷</span>
                          <span>{contato.phone || 'Sem número'}</span>
                        </div>
                        {contato.name && contato.name !== nome && (
                          <div className="mt-1 text-xs text-slate-500">
                            {contato.name}
                          </div>
                        )}
                        {contato.email && (
                          <div className="mt-0.5 text-xs text-blue-600">
                            {contato.email}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo das outras abas */}
      {abaAtiva === 'atendimento' && (
        <div className="mx-6 mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h3 className="text-base font-bold text-slate-800">Histórico de Atendimentos</h3>
          <p className="mt-2 text-xs text-slate-500">
            Ordens de serviço e atividades vinculadas a este cliente aparecerão aqui.
          </p>
        </div>
      )}

      {abaAtiva === 'modelos' && (
        <div className="mx-6 mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h3 className="text-base font-bold text-slate-800">Equipamentos Instalados</h3>
          <p className="mt-2 text-xs text-slate-500">
            Aparelhos de ar-condicionado e ativos cadastrados neste cliente.
          </p>
        </div>
      )}

      {abaAtiva === 'anexos' && (
        <div className="mx-6 mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h3 className="text-base font-bold text-slate-800">Anexos e Documentos</h3>
          <p className="mt-2 text-xs text-slate-500">
            Fotos de campo e documentos armazenados com segurança.
          </p>
        </div>
      )}

      {abaAtiva === 'customizados' && (
        <div className="mx-6 mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h3 className="text-base font-bold text-slate-800">Campos Customizados</h3>
          <p className="mt-2 text-xs text-slate-500">
            Campos personalizados e configurações específicas.
          </p>
        </div>
      )}

      {abaAtiva === 'historico' && (
        <div className="mx-6 mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h3 className="text-base font-bold text-slate-800">Registro de Atividades</h3>
          <p className="mt-2 text-xs text-slate-500">
            Log de alterações e auditoria de ações realizadas neste cliente.
          </p>
        </div>
      )}

      {/* Modal Adicionar Contato */}
      {modalContatoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">Adicionar Contato</h3>
              <button
                type="button"
                onClick={fecharModalContato}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAdicionarContato} className="mt-4 space-y-3.5">
              <div>
                <label htmlFor="ct-nome" className="block text-xs font-medium text-slate-700">
                  Nome do Contato
                </label>
                <input
                  id="ct-nome"
                  type="text"
                  value={contatoNome}
                  onChange={(e) => setContatoNome(e.target.value)}
                  placeholder="Ex: Karina (Zeladora, Síndico, etc.)"
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="ct-tipo" className="block text-xs font-medium text-slate-700">
                  Tipo / Rótulo
                </label>
                <select
                  id="ct-tipo"
                  value={contatoFuncao}
                  onChange={(e) => setContatoFuncao(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="Celular">Celular</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Casa">Casa</option>
                  <option value="Comercial">Comercial</option>
                  <option value="Financeiro">Financeiro</option>
                  <option value="Síndico(a)">Síndico(a)</option>
                </select>
              </div>

              <div>
                <label htmlFor="ct-tel" className="block text-xs font-medium text-slate-700">
                  Telefone / WhatsApp *
                </label>
                <input
                  id="ct-tel"
                  type="text"
                  required
                  value={contatoTelefone}
                  onChange={(e) => setContatoTelefone(e.target.value)}
                  placeholder="(21) 99999-9999"
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="ct-email" className="block text-xs font-medium text-slate-700">
                  E-mail (opcional)
                </label>
                <input
                  id="ct-email"
                  type="email"
                  value={contatoEmail}
                  onChange={(e) => setContatoEmail(e.target.value)}
                  placeholder="contato@email.com"
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  id="ct-princ"
                  type="checkbox"
                  checked={contatoPrincipal}
                  onChange={(e) => setContatoPrincipal(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="ct-princ" className="text-xs text-slate-700">
                  Definir como contato principal
                </label>
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={fecharModalContato}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Adicionar Etiqueta */}
      {modalEtiquetaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-bold text-slate-800">Nova Etiqueta</h3>
            <input
              type="text"
              autoFocus
              value={novaEtiqueta}
              onChange={(e) => setNovaEtiqueta(e.target.value)}
              placeholder="Ex: Contrato PMOC, VIP, Residencial"
              className="mt-3 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalEtiquetaAberto(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAdicionarEtiqueta}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
