import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Archive,
  Check,
  Cpu,
  Power,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import {
  buscarEquipamento,
  definirEquipamentoAtivo,
  listarEnderecosDoCliente,
  salvarEquipamento,
  type EquipamentoInput,
} from '../../services/equipamentos';
import SeletorClienteEquipamento from './SeletorClienteEquipamento';

interface EnderecoCliente {
  id: string;
  label: string | null;
  street: string;
  number: string | null;
  city: string | null;
}

interface EquipamentoDetalhesProps {
  equipamentoId: string | 'novo';
  onFechar: () => void;
  onSalvo: (id: string) => void;
}

const CATEGORIAS_SUGERIDAS = [
  'Split Hi-Wall',
  'Split Piso Teto',
  'Cassete',
  'VRF',
  'Chiller',
  'Quadro Elétrico',
];

const TENSOES = ['127V', '220V', '380V'];

const REFRIGERANTES = ['R-410A', 'R-32', 'R-22'];

const INPUT_CLASSES =
  'mt-1.5 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

export default function EquipamentoDetalhes({
  equipamentoId,
  onFechar,
  onSalvo,
}: EquipamentoDetalhesProps) {
  const nova = equipamentoId === 'novo';
  const { profile } = useAuth();
  const podeDesativar = profile?.role === 'admin' || profile?.role === 'escritorio';

  const [carregando, setCarregando] = useState(!nova);
  const [salvando, setSalvando] = useState(false);
  const [mudandoStatus, setMudandoStatus] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Campos do formulário
  const [cliente, setCliente] = useState<{ id: string; name: string } | null>(null);
  const [enderecos, setEnderecos] = useState<EnderecoCliente[]>([]);
  const [enderecoId, setEnderecoId] = useState('');
  const [categoria, setCategoria] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [numeroSerie, setNumeroSerie] = useState('');
  const [capacidadeBtu, setCapacidadeBtu] = useState('');
  const [tensao, setTensao] = useState('');
  const [refrigerante, setRefrigerante] = useState('');
  const [localImovel, setLocalImovel] = useState('');
  const [instaladoEm, setInstaladoEm] = useState('');
  const [garantiaAte, setGarantiaAte] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [ativo, setAtivo] = useState(true);

  // Carrega equipamento existente
  useEffect(() => {
    if (nova) return;
    let montado = true;

    buscarEquipamento(equipamentoId)
      .then((eq) => {
        if (!montado) return;
        if (!eq) {
          setErro('Equipamento não encontrado ou sem permissão para visualizá-lo.');
          return;
        }

        setCliente(eq.customer ? { id: eq.customer.id, name: eq.customer.name } : null);
        setEnderecoId(eq.address_id ?? '');
        setCategoria(eq.category || '');
        setMarca(eq.brand || '');
        setModelo(eq.model || '');
        setNumeroSerie(eq.serial_number || '');
        setCapacidadeBtu(eq.capacity_btu ? String(eq.capacity_btu) : '');
        setTensao(eq.voltage || '');
        setRefrigerante(eq.refrigerant || '');
        setLocalImovel(eq.location || '');
        setInstaladoEm(eq.installed_at ? eq.installed_at.slice(0, 10) : '');
        setGarantiaAte(eq.warranty_until ? eq.warranty_until.slice(0, 10) : '');
        setQrCode(eq.qr_code || '');
        setObservacoes(eq.notes || '');
        setAtivo(eq.active);
      })
      .catch((err) => {
        console.error('Erro ao carregar equipamento:', err);
        if (montado) {
          setErro('Não foi possível carregar as informações do equipamento.');
        }
      })
      .finally(() => {
        if (montado) setCarregando(false);
      });

    return () => {
      montado = false;
    };
  }, [equipamentoId, nova]);

  // Carrega lista de endereços quando o cliente for selecionado
  const clienteId = cliente?.id;
  useEffect(() => {
    if (!clienteId) return;

    let montado = true;
    listarEnderecosDoCliente(clienteId)
      .then((lista) => {
        if (!montado) return;
        setEnderecos(lista);
      })
      .catch((err) => {
        console.error('Erro ao listar endereços do cliente:', err);
      });

    return () => {
      montado = false;
    };
  }, [clienteId]);

  const ehQuadroEletrico = categoria.trim().toLowerCase() === 'quadro elétrico';

  const formatarErroServidor = (err: unknown): string => {
    const msg = err instanceof Error ? err.message : String(err);
    const msgLower = msg.toLowerCase();

    if (
      msgLower.includes('qr_code') ||
      msgLower.includes('unique constraint') ||
      msgLower.includes('duplicate key') ||
      msg.includes('23505')
    ) {
      return 'Esta etiqueta já está em uso.';
    }

    if (
      msgLower.includes('permission denied') ||
      msgLower.includes('row-level security') ||
      msgLower.includes('violates row-level') ||
      msg.includes('42501')
    ) {
      return 'Você não tem permissão para esta ação.';
    }

    return 'Não foi possível salvar o equipamento. Verifique as informações e tente novamente.';
  };

  const handleSalvar = async (e?: FormEvent) => {
    e?.preventDefault();
    setErro(null);

    // Validações
    if (!cliente?.id) {
      setErro('Selecione o cliente do equipamento.');
      return;
    }

    if (!categoria.trim()) {
      setErro('Informe a categoria do equipamento.');
      return;
    }

    let btuValido: number | null = null;
    if (!ehQuadroEletrico && capacidadeBtu.trim()) {
      const btuNum = Number(capacidadeBtu);
      if (Number.isNaN(btuNum) || !Number.isInteger(btuNum) || btuNum <= 0) {
        setErro('A capacidade em BTU deve ser um número inteiro maior que zero.');
        return;
      }
      btuValido = btuNum;
    }

    setSalvando(true);
    try {
      const payload: EquipamentoInput = {
        customer_id: cliente.id,
        address_id: enderecoId || null,
        category: categoria.trim(),
        brand: marca.trim() || null,
        model: modelo.trim() || null,
        serial_number: numeroSerie.trim() || null,
        capacity_btu: ehQuadroEletrico ? null : btuValido,
        voltage: ehQuadroEletrico ? null : (tensao || null),
        refrigerant: ehQuadroEletrico ? null : (refrigerante || null),
        location: localImovel.trim() || null,
        installed_at: instaladoEm || null,
        warranty_until: garantiaAte || null,
        qr_code: qrCode.trim() || null,
        notes: observacoes.trim() || null,
      };

      const salvo = await salvarEquipamento(payload, nova ? undefined : equipamentoId);

      setSucesso('Equipamento salvo com sucesso!');
      setTimeout(() => setSucesso(null), 3000);
      onSalvo(salvo.id);
    } catch (err) {
      console.error('Erro ao salvar equipamento:', err);
      setErro(formatarErroServidor(err));
    } finally {
      setSalvando(false);
    }
  };

  const handleAlternarAtivo = async () => {
    if (nova || !podeDesativar) return;

    const proximoStatus = !ativo;
    const confirmacao = window.confirm(
      proximoStatus
        ? 'Deseja reativar este equipamento?'
        : 'Deseja desativar este equipamento? Ele não será mais exibido nas listas ativas nem em novas OS.',
    );

    if (!confirmacao) return;

    setMudandoStatus(true);
    setErro(null);
    try {
      await definirEquipamentoAtivo(equipamentoId, proximoStatus);
      setAtivo(proximoStatus);
      setSucesso(
        proximoStatus
          ? 'Equipamento reativado com sucesso!'
          : 'Equipamento desativado com sucesso!',
      );
      setTimeout(() => setSucesso(null), 3000);
      onSalvo(equipamentoId);
    } catch (err) {
      console.error('Erro ao alterar status do equipamento:', err);
      setErro(formatarErroServidor(err));
    } finally {
      setMudandoStatus(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          <span className="text-sm font-medium">Carregando dados do equipamento...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16">
      {/* Barra de Ações Superior */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3.5 shadow-xs sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Cpu size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                {nova ? 'Novo equipamento' : categoria || 'Equipamento'}
              </h1>
              {!nova && (
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    ativo
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {ativo ? 'Ativo' : 'Inativo'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {nova
                ? 'Cadastre um ativo instalado em um cliente'
                : [cliente?.name, qrCode ? `Etiqueta: ${qrCode}` : null]
                    .filter(Boolean)
                    .join(' · ')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sucesso && (
            <span className="flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">
              <Check size={14} /> {sucesso}
            </span>
          )}

          {!nova && podeDesativar && (
            <button
              type="button"
              onClick={handleAlternarAtivo}
              disabled={mudandoStatus || salvando}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                ativo
                  ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              } disabled:opacity-50`}
            >
              {ativo ? <Power size={14} /> : <RotateCcw size={14} />}
              {ativo ? 'Desativar' : 'Reativar'}
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSalvar()}
            disabled={salvando || mudandoStatus}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>

          <button
            type="button"
            onClick={onFechar}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {erro && (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700 sm:mx-6">
          <AlertCircle size={16} className="shrink-0 text-red-600" />
          <span>{erro}</span>
        </div>
      )}

      {/* Formulário Principal */}
      <div className="mx-auto mt-6 max-w-4xl px-4 sm:px-6">
        <form
          onSubmit={handleSalvar}
          className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-7"
        >
          {/* Seção 1: Cliente e Localização */}
          <div>
            <h2 className="text-sm font-bold text-slate-900">Local de Instalação</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Cliente onde o ativo está alocado e endereço específico.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <span className="block text-xs font-semibold text-slate-700">Cliente *</span>
                <SeletorClienteEquipamento
                  valor={cliente}
                  onChange={(c) => {
                    setCliente(c);
                    setEnderecoId('');
                    setEnderecos([]);
                  }}
                  desabilitado={!nova}
                />
              </div>

              {cliente && (
                <div>
                  <label htmlFor="campo-endereco" className="block text-xs font-semibold text-slate-700">
                    Endereço de instalação (opcional)
                  </label>
                  <select
                    id="campo-endereco"
                    value={enderecoId}
                    onChange={(e) => setEnderecoId(e.target.value)}
                    className={INPUT_CLASSES}
                  >
                    <option value="">Nenhum endereço específico (usar padrão do cliente)</option>
                    {enderecos.map((end) => {
                      const prefixo = end.label ? `${end.label} — ` : '';
                      const via = [end.street, end.number].filter(Boolean).join(', ');
                      const cidadeStr = end.city ? ` (${end.city})` : '';
                      return (
                        <option key={end.id} value={end.id}>
                          {prefixo}
                          {via}
                          {cidadeStr}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div className={cliente ? 'sm:col-span-2' : ''}>
                <label htmlFor="campo-local" className="block text-xs font-semibold text-slate-700">
                  Local no imóvel
                </label>
                <input
                  id="campo-local"
                  type="text"
                  value={localImovel}
                  onChange={(e) => setLocalImovel(e.target.value)}
                  placeholder='Ex.: Sala de reunião - 2º andar, Copa, Recepção'
                  className={INPUT_CLASSES}
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Seção 2: Identificação do Equipamento */}
          <div>
            <h2 className="text-sm font-bold text-slate-900">Identificação do Ativo</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Categoria, marca, modelo e números de rastreabilidade.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="campo-categoria" className="block text-xs font-semibold text-slate-700">
                  Categoria *
                </label>
                <input
                  id="campo-categoria"
                  type="text"
                  list="sugestoes-categoria"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  placeholder="Ex.: Split Hi-Wall, Cassete, VRF, Quadro Elétrico..."
                  className={INPUT_CLASSES}
                />
                <datalist id="sugestoes-categoria">
                  {CATEGORIAS_SUGERIDAS.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>

                {/* Chips de atalho rápido */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Sparkles size={12} /> Sugestões:
                  </span>
                  {CATEGORIAS_SUGERIDAS.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoria(cat)}
                      className={`rounded-lg px-2 py-0.5 text-[11px] font-medium transition ${
                        categoria === cat
                          ? 'bg-blue-100 text-blue-700 font-semibold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="campo-marca" className="block text-xs font-semibold text-slate-700">
                    Marca
                  </label>
                  <input
                    id="campo-marca"
                    type="text"
                    value={marca}
                    onChange={(e) => setMarca(e.target.value)}
                    placeholder="Ex.: Daikin, Carrier, Elgin, LG"
                    className={INPUT_CLASSES}
                  />
                </div>

                <div>
                  <label htmlFor="campo-modelo" className="block text-xs font-semibold text-slate-700">
                    Modelo
                  </label>
                  <input
                    id="campo-modelo"
                    type="text"
                    value={modelo}
                    onChange={(e) => setModelo(e.target.value)}
                    placeholder="Ex.: Eco Inverter 12k"
                    className={INPUT_CLASSES}
                  />
                </div>

                <div>
                  <label htmlFor="campo-serie" className="block text-xs font-semibold text-slate-700">
                    Nº de série
                  </label>
                  <input
                    id="campo-serie"
                    type="text"
                    value={numeroSerie}
                    onChange={(e) => setNumeroSerie(e.target.value)}
                    placeholder="Ex.: SN-987654321"
                    className={INPUT_CLASSES}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="campo-qrcode" className="block text-xs font-semibold text-slate-700">
                  Etiqueta / QR Code (Patrimônio / PMOC)
                </label>
                <input
                  id="campo-qrcode"
                  type="text"
                  value={qrCode}
                  onChange={(e) => setQrCode(e.target.value)}
                  placeholder="Código da etiqueta patrimonial física colada no aparelho"
                  className={INPUT_CLASSES}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Identificador único impresso na etiqueta do equipamento.
                </p>
              </div>
            </div>
          </div>

          {/* Seção 3: Especificações Técnicas (condicional para ar-condicionado) */}
          {!ehQuadroEletrico && (
            <>
              <hr className="border-slate-100" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">Especificações Técnicas</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Capacidade térmica, alimentação elétrica e gás refrigerante.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="campo-btu" className="block text-xs font-semibold text-slate-700">
                      Capacidade (BTU)
                    </label>
                    <input
                      id="campo-btu"
                      type="number"
                      min="1"
                      step="1"
                      value={capacidadeBtu}
                      onChange={(e) => setCapacidadeBtu(e.target.value)}
                      placeholder="Ex.: 9000, 12000, 18000"
                      className={INPUT_CLASSES}
                    />
                  </div>

                  <div>
                    <label htmlFor="campo-tensao" className="block text-xs font-semibold text-slate-700">
                      Tensão
                    </label>
                    <select
                      id="campo-tensao"
                      value={tensao}
                      onChange={(e) => setTensao(e.target.value)}
                      className={INPUT_CLASSES}
                    >
                      <option value="">Não informada</option>
                      {TENSOES.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="campo-refrigerante" className="block text-xs font-semibold text-slate-700">
                      Gás refrigerante
                    </label>
                    <select
                      id="campo-refrigerante"
                      value={refrigerante}
                      onChange={(e) => setRefrigerante(e.target.value)}
                      className={INPUT_CLASSES}
                    >
                      <option value="">Não informado</option>
                      {REFRIGERANTES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}

          <hr className="border-slate-100" />

          {/* Seção 4: Datas e Garantia */}
          <div>
            <h2 className="text-sm font-bold text-slate-900">Instalação e Garantia</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Controle de datas para manutenções preventivas e cobertura de garantia.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="campo-instalacao" className="block text-xs font-semibold text-slate-700">
                  Data de instalação
                </label>
                <input
                  id="campo-instalacao"
                  type="date"
                  value={instaladoEm}
                  onChange={(e) => setInstaladoEm(e.target.value)}
                  className={INPUT_CLASSES}
                />
              </div>

              <div>
                <label htmlFor="campo-garantia" className="block text-xs font-semibold text-slate-700">
                  Garantia até
                </label>
                <input
                  id="campo-garantia"
                  type="date"
                  value={garantiaAte}
                  onChange={(e) => setGarantiaAte(e.target.value)}
                  className={INPUT_CLASSES}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Equipamentos com data igual ou futura serão destacados como &quot;Em garantia&quot;.
                </p>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Seção 5: Observações */}
          <div>
            <label htmlFor="campo-obs" className="block text-xs font-semibold text-slate-700">
              Observações gerais
            </label>
            <textarea
              id="campo-obs"
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Anotações adicionais, particularidades de acesso, histórico prévio..."
              className={INPUT_CLASSES}
            />
          </div>

          {/* Botões do Rodapé */}
          <div className="flex flex-col-reverse gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100">
            <div>
              {!nova && podeDesativar && (
                <button
                  type="button"
                  onClick={handleAlternarAtivo}
                  disabled={mudandoStatus || salvando}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-50"
                >
                  <Archive size={14} />
                  {ativo ? 'Desativar este equipamento' : 'Reativar este equipamento'}
                </button>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onFechar}
                disabled={salvando}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando || mudandoStatus}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : nova ? 'Cadastrar equipamento' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
