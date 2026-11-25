import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  listarCategorias,
  listarContas,
  listarFornecedores,
  listarMaquininhas,
  salvarCategoria,
  salvarConta,
  salvarFornecedor,
  salvarMaquininha,
  useNivelFinanceiro,
} from '../components/financeiro/fonteDeDados';
import ModalDialogoVendas from '../components/vendas/ModalDialogoVendas';
import NavegacaoVendas from '../components/vendas/NavegacaoVendas';
import { semAcento } from '../components/vendas/regrasVendas';
import { useAuth } from '../contexts/useAuth';
import type {
  CardMachine,
  CardMachineInstallmentRate,
  FinancialAccount,
  FinancialCategory,
  Supplier,
} from '../types/financeiro';
import type { PersonType } from '../types/fsm';
import {
  centavosParaTextoInput,
  converterTextoParaCentavos,
  formatarReais,
} from '../utils/dinheiro';
import {
  documentoValido,
  formatarDocumento,
  limparDocumento,
} from '../utils/documento';
import { formatarTelefone } from '../utils/telefone';

type AbaCadastro = 'contas' | 'maquininhas' | 'categorias' | 'fornecedores';

const INPUT =
  'mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none';

const CAMPO_CELULA =
  'w-28 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-right text-xs font-semibold tabular-nums text-slate-800 focus:border-blue-500 focus:outline-none';

const PARCELAS_PADRAO: number[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function criarTabelaTaxasInicial(existentes?: CardMachineInstallmentRate[]): Record<number, string> {
  const mapa: Record<number, string> = {};
  for (const n of PARCELAS_PADRAO) {
    const achada = existentes?.find((r) => r.installments === n);
    mapa[n] = achada ? achada.fee_percent.toFixed(2).replace('.', ',') : (3.5 + n * 0.85).toFixed(2).replace('.', ',');
  }
  return mapa;
}

function textoTaxaParaNumero(texto: string): number {
  const n = Number(texto.trim().replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

export default function FinanceiroCadastros() {
  const { profile } = useAuth();
  const { nivel } = useNivelFinanceiro(profile);

  const [aba, setAba] = useState<AbaCadastro>('contas');
  const [busca, setBusca] = useState('');

  const [contas, setContas] = useState<FinancialAccount[]>([]);
  const [maquininhas, setMaquininhas] = useState<CardMachine[]>([]);
  const [categorias, setCategorias] = useState<FinancialCategory[]>([]);
  const [fornecedores, setFornecedores] = useState<Supplier[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Modal de Conta
  const [modalConta, setModalConta] = useState(false);
  const [contaIdEdit, setContaIdEdit] = useState<string | undefined>(undefined);
  const [contaNome, setContaNome] = useState('');
  const [contaTipo, setContaTipo] = useState<'caixa' | 'banco'>('banco');
  const [contaSaldoInicialTexto, setContaSaldoInicialTexto] = useState('0,00');
  const [contaAtiva, setContaAtiva] = useState(true);

  // Modal de Maquininha
  const [modalMaq, setModalMaq] = useState(false);
  const [maqIdEdit, setMaqIdEdit] = useState<string | undefined>(undefined);
  const [maqNome, setMaqNome] = useState('');
  const [maqContaId, setMaqContaId] = useState('conta-itau');
  const [maqPrazoDias, setMaqPrazoDias] = useState('1');
  const [maqDebitoTexto, setMaqDebitoTexto] = useState('1,39');
  const [maqCreditoVistaTexto, setMaqCreditoVistaTexto] = useState('3,19');
  const [maqTaxasParcelas, setMaqTaxasParcelas] = useState<Record<number, string>>(() =>
    criarTabelaTaxasInicial(),
  );
  const [maqAtiva, setMaqAtiva] = useState(true);

  // Modal de Categoria
  const [modalCat, setModalCat] = useState(false);
  const [catIdEdit, setCatIdEdit] = useState<string | undefined>(undefined);
  const [catNome, setCatNome] = useState('');
  const [catTipo, setCatTipo] = useState<'receita' | 'despesa'>('despesa');
  const [catAtiva, setCatAtiva] = useState(true);

  // Modal de Fornecedor
  const [modalForn, setModalForn] = useState(false);
  const [fornIdEdit, setFornIdEdit] = useState<string | undefined>(undefined);
  const [fornNome, setFornNome] = useState('');
  const [fornTipoPessoa, setFornTipoPessoa] = useState<PersonType>('PJ');
  const [fornDocumento, setFornDocumento] = useState('');
  const [fornTelefone, setFornTelefone] = useState('');
  const [fornEmail, setFornEmail] = useState('');
  const [fornAtivo, setFornAtivo] = useState(true);

  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [c, m, cat, forn] = await Promise.all([
        listarContas(),
        listarMaquininhas(),
        listarCategorias(),
        listarFornecedores(),
      ]);
      setContas(c);
      setMaquininhas(m);
      setCategorias(cat);
      setFornecedores(forn);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar os cadastros.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (nivel !== 'completo') return;
    const timer = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(timer);
  }, [carregar, nivel]);

  // Bloqueio para níveis `caixa` e `nenhum` (seção 6.5)
  if (nivel !== 'completo') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Cadastros financeiros
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Contas, maquininhas, categorias e fornecedores.
            </p>
          </div>
          <NavegacaoVendas />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-base font-bold text-slate-800">Acesso restrito</p>
          <p className="mt-1 text-xs text-slate-500">
            Os cadastros financeiros estão disponíveis apenas para o acesso financeiro completo.
          </p>
        </div>
      </div>
    );
  }

  const abrirNovaConta = () => {
    setErroModal(null);
    setContaIdEdit(undefined);
    setContaNome('');
    setContaTipo('banco');
    setContaSaldoInicialTexto('0,00');
    setContaAtiva(true);
    setModalConta(true);
  };

  const abrirEditarConta = (c: FinancialAccount) => {
    setErroModal(null);
    setContaIdEdit(c.id);
    setContaNome(c.name);
    setContaTipo(c.kind);
    setContaSaldoInicialTexto(centavosParaTextoInput(c.initial_balance_cents));
    setContaAtiva(c.active);
    setModalConta(true);
  };

  const handleSalvarConta = async (e: FormEvent) => {
    e.preventDefault();
    setErroModal(null);
    const saldoInicial = converterTextoParaCentavos(contaSaldoInicialTexto) ?? 0;
    setSalvando(true);
    try {
      await salvarConta({
        id: contaIdEdit,
        name: contaNome,
        kind: contaTipo,
        initial_balance_cents: saldoInicial,
        active: contaAtiva,
      });
      setModalConta(false);
      await carregar();
    } catch (err) {
      setErroModal(err instanceof Error ? err.message : 'Erro ao salvar conta.');
    } finally {
      setSalvando(false);
    }
  };

  const abrirNovaMaquininha = () => {
    setErroModal(null);
    setMaqIdEdit(undefined);
    setMaqNome('');
    setMaqContaId(contas[1]?.id ?? contas[0]?.id ?? 'conta-itau');
    setMaqPrazoDias('1');
    setMaqDebitoTexto('1,39');
    setMaqCreditoVistaTexto('3,19');
    setMaqTaxasParcelas(criarTabelaTaxasInicial());
    setMaqAtiva(true);
    setModalMaq(true);
  };

  const abrirEditarMaquininha = (m: CardMachine) => {
    setErroModal(null);
    setMaqIdEdit(m.id);
    setMaqNome(m.name);
    setMaqContaId(m.settlement_account_id);
    setMaqPrazoDias(String(m.settlement_business_days));
    setMaqDebitoTexto(m.debit_fee_percent.toFixed(2).replace('.', ','));
    setMaqCreditoVistaTexto(m.credit_sight_fee_percent.toFixed(2).replace('.', ','));
    setMaqTaxasParcelas(criarTabelaTaxasInicial(m.credit_installment_rates));
    setMaqAtiva(m.active);
    setModalMaq(true);
  };

  const handleSalvarMaquininha = async (e: FormEvent) => {
    e.preventDefault();
    setErroModal(null);
    const taxas: CardMachineInstallmentRate[] = PARCELAS_PADRAO.map((n) => ({
      installments: n,
      fee_percent: textoTaxaParaNumero(maqTaxasParcelas[n] ?? '0'),
    }));
    setSalvando(true);
    try {
      await salvarMaquininha({
        id: maqIdEdit,
        name: maqNome,
        settlement_account_id: maqContaId,
        settlement_business_days: Math.max(0, Number(maqPrazoDias) || 1),
        debit_fee_percent: textoTaxaParaNumero(maqDebitoTexto),
        credit_sight_fee_percent: textoTaxaParaNumero(maqCreditoVistaTexto),
        credit_installment_rates: taxas,
        active: maqAtiva,
      });
      setModalMaq(false);
      await carregar();
    } catch (err) {
      setErroModal(err instanceof Error ? err.message : 'Erro ao salvar maquininha.');
    } finally {
      setSalvando(false);
    }
  };

  const abrirNovaCategoria = () => {
    setErroModal(null);
    setCatIdEdit(undefined);
    setCatNome('');
    setCatTipo('despesa');
    setCatAtiva(true);
    setModalCat(true);
  };

  const abrirEditarCategoria = (c: FinancialCategory) => {
    setErroModal(null);
    setCatIdEdit(c.id);
    setCatNome(c.name);
    setCatTipo(c.kind);
    setCatAtiva(c.active);
    setModalCat(true);
  };

  const handleSalvarCategoria = async (e: FormEvent) => {
    e.preventDefault();
    setErroModal(null);
    setSalvando(true);
    try {
      await salvarCategoria({
        id: catIdEdit,
        name: catNome,
        kind: catTipo,
        active: catAtiva,
      });
      setModalCat(false);
      await carregar();
    } catch (err) {
      setErroModal(err instanceof Error ? err.message : 'Erro ao salvar categoria.');
    } finally {
      setSalvando(false);
    }
  };

  const abrirNovoFornecedor = () => {
    setErroModal(null);
    setFornIdEdit(undefined);
    setFornNome('');
    setFornTipoPessoa('PJ');
    setFornDocumento('');
    setFornTelefone('');
    setFornEmail('');
    setFornAtivo(true);
    setModalForn(true);
  };

  const abrirEditarFornecedor = (f: Supplier) => {
    setErroModal(null);
    setFornIdEdit(f.id);
    setFornNome(f.name);
    setFornTipoPessoa(f.person_type);
    setFornDocumento(f.document ? formatarDocumento(f.document, f.person_type) : '');
    setFornTelefone(f.phone ? formatarTelefone(f.phone) : '');
    setFornEmail(f.email ?? '');
    setFornAtivo(f.active);
    setModalForn(true);
  };

  const handleSalvarFornecedor = async (e: FormEvent) => {
    e.preventDefault();
    setErroModal(null);
    const docDigitos = limparDocumento(fornDocumento, fornTipoPessoa);
    if (docDigitos.length > 0 && !documentoValido(docDigitos, fornTipoPessoa)) {
      setErroModal(
        fornTipoPessoa === 'PF'
          ? 'CPF inválido. Verifique os dígitos informados.'
          : 'CNPJ inválido. Verifique os dígitos informados.',
      );
      return;
    }

    setSalvando(true);
    try {
      await salvarFornecedor({
        id: fornIdEdit,
        name: fornNome,
        person_type: fornTipoPessoa,
        document: docDigitos || null,
        phone: fornTelefone.trim() ? formatarTelefone(fornTelefone) : null,
        email: fornEmail.trim() || null,
        active: fornAtivo,
      });
      setModalForn(false);
      await carregar();
    } catch (err) {
      setErroModal(err instanceof Error ? err.message : 'Erro ao salvar fornecedor.');
    } finally {
      setSalvando(false);
    }
  };

  const termo = semAcento(busca);
  const contasFiltradas = contas.filter(
    (c) => !termo || semAcento(c.name).includes(termo),
  );
  const maquininhasFiltradas = maquininhas.filter(
    (m) => !termo || semAcento(`${m.name} ${m.settlement_account_name}`).includes(termo),
  );
  const categoriasFiltradas = categorias.filter(
    (c) => !termo || semAcento(`${c.name} ${c.kind}`).includes(termo),
  );
  const fornecedoresFiltrados = fornecedores.filter(
    (f) =>
      !termo ||
      semAcento(`${f.name} ${f.document ?? ''} ${f.email ?? ''}`).includes(termo),
  );

  const rotuloBotaoNovo =
    aba === 'contas'
      ? 'Nova conta'
      : aba === 'maquininhas'
        ? 'Nova maquininha'
        : aba === 'categorias'
          ? 'Nova categoria'
          : 'Novo fornecedor';

  const acaoBotaoNovo =
    aba === 'contas'
      ? abrirNovaConta
      : aba === 'maquininhas'
        ? abrirNovaMaquininha
        : aba === 'categorias'
          ? abrirNovaCategoria
          : abrirNovoFornecedor;

  return (
    <div className="space-y-6">
      {/* Cabeçalho padrão Clientes.tsx (Regra 1 do GEMINI.md) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Cadastros financeiros
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Contas, maquininhas, categorias e fornecedores.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <NavegacaoVendas />

          <button
            type="button"
            onClick={acaoBotaoNovo}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            {rotuloBotaoNovo}
          </button>
        </div>
      </div>

      {/* Barra única de filtros (Regra 2 do GEMINI.md: busca + controle segmentado sem contador) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar no cadastro selecionado..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-3.5 pl-9 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
          {(
            [
              { id: 'contas', rotulo: 'Contas' },
              { id: 'maquininhas', rotulo: 'Maquininhas' },
              { id: 'categorias', rotulo: 'Categorias' },
              { id: 'fornecedores', rotulo: 'Fornecedores' },
            ] as const
          ).map((op) => (
            <button
              key={op.id}
              type="button"
              onClick={() => setAba(op.id)}
              className={`rounded-lg px-3 py-1.5 transition ${
                aba === op.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {op.rotulo}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-slate-500">
          <Loader2 size={20} className="mr-2 animate-spin text-blue-600" />
          <span className="text-sm font-medium">Carregando cadastros...</span>
        </div>
      ) : erro ? (
        <div className="rounded-2xl border border-red-200 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-red-700">{erro}</p>
          <button
            type="button"
            onClick={() => void carregar()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={14} /> Tentar de novo
          </button>
        </div>
      ) : aba === 'contas' ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Conta</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3 text-right">Saldo inicial</th>
                  <th className="px-4 py-3 text-right">Saldo atual</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {contasFiltradas.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-semibold text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.kind === 'caixa' ? 'Caixa físico' : 'Conta bancária'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {formatarReais(c.initial_balance_cents)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900">
                      {formatarReais(c.current_balance_cents)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                          c.active
                            ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-slate-100 text-slate-500'
                        }`}
                      >
                        {c.active ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => abrirEditarConta(c)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil size={12} /> Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : aba === 'maquininhas' ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Maquininha</th>
                  <th className="px-4 py-3">Conta de liquidação</th>
                  <th className="px-4 py-3 text-center">Prazo</th>
                  <th className="px-4 py-3 text-right">Débito</th>
                  <th className="px-4 py-3 text-right">Crédito 1x</th>
                  <th className="px-4 py-3 text-right">Parcelado (2x a 12x)</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {maquininhasFiltradas.map((m) => {
                  const taxa2x = m.credit_installment_rates.find((r) => r.installments === 2);
                  const taxa12x = m.credit_installment_rates.find((r) => r.installments === 12);
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-semibold text-slate-900">{m.name}</td>
                      <td className="px-4 py-3 text-slate-700">{m.settlement_account_name}</td>
                      <td className="px-4 py-3 text-center tabular-nums">
                        {m.settlement_business_days} dia(s) útil
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {m.debit_fee_percent.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {m.credit_sight_fee_percent.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                        {taxa2x ? `${taxa2x.fee_percent.toFixed(2)}%` : '—'} a{' '}
                        {taxa12x ? `${taxa12x.fee_percent.toFixed(2)}%` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                            m.active
                              ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-100 text-slate-500'
                          }`}
                        >
                          {m.active ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => abrirEditarMaquininha(m)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil size={12} /> Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : aba === 'categorias' ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Natureza</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {categoriasFiltradas.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-semibold text-slate-900">{c.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                          c.kind === 'receita'
                            ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                            : 'border-amber-100 bg-amber-50 text-amber-700'
                        }`}
                      >
                        {c.kind === 'receita' ? 'Receita (entrada)' : 'Despesa (saída)'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                          c.active
                            ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-slate-100 text-slate-500'
                        }`}
                      >
                        {c.active ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => abrirEditarCategoria(c)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil size={12} /> Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Fornecedor</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">CPF / CNPJ</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {fornecedoresFiltrados.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-semibold text-slate-900">{f.name}</td>
                    <td className="px-4 py-3 text-slate-600">{f.person_type}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">
                      {f.document ? formatarDocumento(f.document, f.person_type) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {f.phone ? formatarTelefone(f.phone) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{f.email || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                          f.active
                            ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-slate-100 text-slate-500'
                        }`}
                      >
                        {f.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => abrirEditarFornecedor(f)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil size={12} /> Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Modal: Conta */}
      {modalConta && (
        <ModalDialogoVendas
          aberto
          onFechar={() => setModalConta(false)}
          titulo={contaIdEdit ? 'Editar conta' : 'Nova conta'}
          larguraMax="max-w-md"
        >
          <form onSubmit={(e) => void handleSalvarConta(e)} className="space-y-4">
            <div>
              <label htmlFor="cad-conta-nome" className="block text-xs font-semibold text-slate-700">
                Nome da conta *
              </label>
              <input
                id="cad-conta-nome"
                type="text"
                required
                value={contaNome}
                onChange={(e) => setContaNome(e.target.value)}
                placeholder="Ex.: Itaú / Caixa BRV (Loja)"
                className={INPUT}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="cad-conta-tipo" className="block text-xs font-semibold text-slate-700">
                  Tipo
                </label>
                <select
                  id="cad-conta-tipo"
                  value={contaTipo}
                  onChange={(e) => setContaTipo(e.target.value as 'caixa' | 'banco')}
                  className={INPUT}
                >
                  <option value="banco">Conta bancária</option>
                  <option value="caixa">Caixa físico</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="cad-conta-saldo"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Saldo inicial (R$)
                </label>
                <input
                  id="cad-conta-saldo"
                  type="text"
                  inputMode="decimal"
                  value={contaSaldoInicialTexto}
                  onChange={(e) => setContaSaldoInicialTexto(e.target.value)}
                  className={INPUT}
                />
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={contaAtiva}
                onChange={(e) => setContaAtiva(e.target.checked)}
                className="rounded border-slate-300 text-blue-600"
              />
              Conta ativa
            </label>

            {erroModal && (
              <p role="alert" className="text-xs font-medium text-red-600">
                {erroModal}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModalConta(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {salvando && <Loader2 size={13} className="animate-spin" />}
                Salvar conta
              </button>
            </div>
          </form>
        </ModalDialogoVendas>
      )}

      {/* Modal: Maquininha (com tabela compacta de taxas 2x..12x, uma linha por parcela — Regra 8 do GEMINI.md) */}
      {modalMaq && (
        <ModalDialogoVendas
          aberto
          onFechar={() => setModalMaq(false)}
          titulo={maqIdEdit ? 'Editar maquininha' : 'Nova maquininha'}
          larguraMax="max-w-2xl"
        >
          <form onSubmit={(e) => void handleSalvarMaquininha(e)} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="cad-maq-nome" className="block text-xs font-semibold text-slate-700">
                  Nome *
                </label>
                <input
                  id="cad-maq-nome"
                  type="text"
                  required
                  value={maqNome}
                  onChange={(e) => setMaqNome(e.target.value)}
                  placeholder="Ex.: Rede / InfinitePay"
                  className={INPUT}
                />
              </div>

              <div>
                <label htmlFor="cad-maq-conta" className="block text-xs font-semibold text-slate-700">
                  Conta de liquidação *
                </label>
                <select
                  id="cad-maq-conta"
                  value={maqContaId}
                  onChange={(e) => setMaqContaId(e.target.value)}
                  className={INPUT}
                >
                  {contas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="cad-maq-prazo" className="block text-xs font-semibold text-slate-700">
                  Prazo (dias úteis) *
                </label>
                <input
                  id="cad-maq-prazo"
                  type="number"
                  min={0}
                  max={60}
                  required
                  value={maqPrazoDias}
                  onChange={(e) => setMaqPrazoDias(e.target.value)}
                  className={INPUT}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="cad-maq-debito"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Taxa débito (%) *
                </label>
                <input
                  id="cad-maq-debito"
                  type="text"
                  inputMode="decimal"
                  required
                  value={maqDebitoTexto}
                  onChange={(e) => setMaqDebitoTexto(e.target.value)}
                  className={INPUT}
                />
              </div>

              <div>
                <label
                  htmlFor="cad-maq-credito1x"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Taxa crédito à vista 1x (%) *
                </label>
                <input
                  id="cad-maq-credito1x"
                  type="text"
                  inputMode="decimal"
                  required
                  value={maqCreditoVistaTexto}
                  onChange={(e) => setMaqCreditoVistaTexto(e.target.value)}
                  className={INPUT}
                />
              </div>
            </div>

            {/* Tabela compacta de taxas por parcela (2x a 12x) — uma linha por faixa, sem cartões (seção 6.0 item 4) */}
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2">Parcelas</th>
                    <th className="px-3 py-2 text-right">Taxa total cobrada (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {PARCELAS_PADRAO.map((n) => (
                    <tr key={n} className="hover:bg-slate-50/50">
                      <td className="px-3 py-1.5 font-semibold text-slate-800">
                        Crédito parcelado {n}x
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label={`Taxa de crédito em ${n}x`}
                          value={maqTaxasParcelas[n] ?? ''}
                          onChange={(e) =>
                            setMaqTaxasParcelas((at) => ({ ...at, [n]: e.target.value }))
                          }
                          className={CAMPO_CELULA}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={maqAtiva}
                onChange={(e) => setMaqAtiva(e.target.checked)}
                className="rounded border-slate-300 text-blue-600"
              />
              Maquininha ativa
            </label>

            {erroModal && (
              <p role="alert" className="text-xs font-medium text-red-600">
                {erroModal}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModalMaq(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {salvando && <Loader2 size={13} className="animate-spin" />}
                Salvar maquininha
              </button>
            </div>
          </form>
        </ModalDialogoVendas>
      )}

      {/* Modal: Categoria */}
      {modalCat && (
        <ModalDialogoVendas
          aberto
          onFechar={() => setModalCat(false)}
          titulo={catIdEdit ? 'Editar categoria' : 'Nova categoria'}
          larguraMax="max-w-md"
        >
          <form onSubmit={(e) => void handleSalvarCategoria(e)} className="space-y-4">
            <div>
              <label htmlFor="cad-cat-nome" className="block text-xs font-semibold text-slate-700">
                Nome da categoria *
              </label>
              <input
                id="cad-cat-nome"
                type="text"
                required
                value={catNome}
                onChange={(e) => setCatNome(e.target.value)}
                placeholder="Ex.: Peças e insumos / Serviço"
                className={INPUT}
              />
            </div>

            <div>
              <label htmlFor="cad-cat-tipo" className="block text-xs font-semibold text-slate-700">
                Natureza
              </label>
              <select
                id="cad-cat-tipo"
                value={catTipo}
                onChange={(e) => setCatTipo(e.target.value as 'receita' | 'despesa')}
                className={INPUT}
              >
                <option value="despesa">Despesa (saída)</option>
                <option value="receita">Receita (entrada)</option>
              </select>
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={catAtiva}
                onChange={(e) => setCatAtiva(e.target.checked)}
                className="rounded border-slate-300 text-blue-600"
              />
              Categoria ativa
            </label>

            {erroModal && (
              <p role="alert" className="text-xs font-medium text-red-600">
                {erroModal}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModalCat(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {salvando && <Loader2 size={13} className="animate-spin" />}
                Salvar categoria
              </button>
            </div>
          </form>
        </ModalDialogoVendas>
      )}

      {/* Modal: Fornecedor */}
      {modalForn && (
        <ModalDialogoVendas
          aberto
          onFechar={() => setModalForn(false)}
          titulo={fornIdEdit ? 'Editar fornecedor' : 'Novo fornecedor'}
          larguraMax="max-w-lg"
        >
          <form onSubmit={(e) => void handleSalvarFornecedor(e)} className="space-y-4">
            <div>
              <label htmlFor="cad-forn-nome" className="block text-xs font-semibold text-slate-700">
                Nome / Razão social *
              </label>
              <input
                id="cad-forn-nome"
                type="text"
                required
                value={fornNome}
                onChange={(e) => setFornNome(e.target.value)}
                placeholder="Ex.: Frigelar Niterói Peças e Refrigeração"
                className={INPUT}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="cad-forn-tipo"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Tipo de pessoa
                </label>
                <select
                  id="cad-forn-tipo"
                  value={fornTipoPessoa}
                  onChange={(e) => setFornTipoPessoa(e.target.value as PersonType)}
                  className={INPUT}
                >
                  <option value="PJ">Pessoa Jurídica (CNPJ)</option>
                  <option value="PF">Pessoa Física (CPF)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="cad-forn-doc"
                  className="block text-xs font-semibold text-slate-700"
                >
                  {fornTipoPessoa === 'PF' ? 'CPF' : 'CNPJ'}
                </label>
                <input
                  id="cad-forn-doc"
                  type="text"
                  value={fornDocumento}
                  onChange={(e) =>
                    setFornDocumento(formatarDocumento(e.target.value, fornTipoPessoa))
                  }
                  placeholder={fornTipoPessoa === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                  className={INPUT}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="cad-forn-tel"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Telefone
                </label>
                <input
                  id="cad-forn-tel"
                  type="tel"
                  value={fornTelefone}
                  onChange={(e) => setFornTelefone(formatarTelefone(e.target.value))}
                  placeholder="(21) 99999-9999"
                  className={INPUT}
                />
              </div>

              <div>
                <label
                  htmlFor="cad-forn-email"
                  className="block text-xs font-semibold text-slate-700"
                >
                  E-mail
                </label>
                <input
                  id="cad-forn-email"
                  type="email"
                  value={fornEmail}
                  onChange={(e) => setFornEmail(e.target.value)}
                  placeholder="contato@fornecedor.com.br"
                  className={INPUT}
                />
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={fornAtivo}
                onChange={(e) => setFornAtivo(e.target.checked)}
                className="rounded border-slate-300 text-blue-600"
              />
              Fornecedor ativo
            </label>

            {erroModal && (
              <p role="alert" className="text-xs font-medium text-red-600">
                {erroModal}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModalForn(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {salvando && <Loader2 size={13} className="animate-spin" />}
                Salvar fornecedor
              </button>
            </div>
          </form>
        </ModalDialogoVendas>
      )}
    </div>
  );
}
