// Camada de dados de demonstração do módulo Financeiro (seções 6, 7 e 8 de docs/gemini/vendas-financeiro-briefing.md).
// Todas as funções são assíncronas e operam sobre cópias em memória clonadas de `dadosDemo.ts`.
// TODO(Claude): quando as migrations do Financeiro (`financial_accounts`, `card_machines`, `financial_categories`,
// `suppliers`, `financial_movements`, `field_receipts`, `cash_sessions`) e `src/services/financeiro.ts` estiverem prontos,
// trocar `FONTE_DADOS_FINANCEIRO_DEMO` para `false` e ligar os corpos destas funções ao Supabase.

import { useSyncExternalStore } from 'react';
import type {
  CardMachine,
  CashSession,
  CashSessionEntry,
  CloseCashSessionInput,
  ConfirmFieldReceiptInput,
  CreateCashEntryInput,
  CreateManualMovementInput,
  CreateTransferInput,
  DailyReceivedPoint,
  FieldReceipt,
  FinancialAccessLevel,
  FinancialAccount,
  FinancialCategory,
  FinancialMovement,
  FinancialMovementFilter,
  FinancialMovementListResult,
  FinancialOverviewSummary,
  FinancialPaymentMethod,
  OpenSaleReceivableSummary,
  PendingCardMachineBalance,
  RegistrarRecebimentoInput,
  SaveCardMachineInput,
  SaveFinancialAccountInput,
  SaveFinancialCategoryInput,
  SaveSupplierInput,
  Supplier,
  TechnicianCashHolding,
} from '../../types/financeiro';
import type { Profile } from '../../types/fsm';
import { somarCentavos, subtrairCentavos } from '../../utils/dinheiro';
import { listarVendas, receberSaldoVenda } from '../vendas/fonteDeDados';
import { ROTULO_FORMA_PAGAMENTO_CURTO } from '../vendas/cores';
import { semAcento, situacaoVenda } from '../vendas/regrasVendas';
import {
  CAIXA_ABERTO_INICIAL_DEMO,
  CATEGORIAS_INICIAIS_DEMO,
  CONTAS_INICIAIS_DEMO,
  FECHAMENTOS_CAIXA_INICIAIS_DEMO,
  FORNECEDORES_INICIAIS_DEMO,
  MAQUININHAS_INICIAIS_DEMO,
  MOVIMENTOS_INICIAIS_DEMO,
  RECEBIMENTOS_TECNICOS_INICIAIS_DEMO,
} from './dadosDemo';
import {
  ITENS_FINANCEIRO_POR_PAGINA,
  calcularDiferencaCaixa,
  calcularLiquidacaoCartao,
  calcularSaldoEsperadoCaixa,
  deslocarDiaLocal,
  diaLocalFinanceiro,
  extrairDiaLocal,
  gerarCsvMovimentos,
  somarDiasUteisLocal,
} from './regrasFinanceiro';

export const FONTE_DADOS_FINANCEIRO_DEMO = true;

function clonar<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

const atraso = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ============================================================================
// 1. NÍVEL DE ACESSO FINANCEIRO (`completo` | `caixa` | `nenhum`)
// ============================================================================

let nivelDemoSobrescrito: FinancialAccessLevel | null = null;
const ouvintesNivel = new Set<() => void>();

export function definirNivelFinanceiroDemo(nivel: FinancialAccessLevel | null): void {
  nivelDemoSobrescrito = nivel;
  for (const fn of ouvintesNivel) fn();
}

export function obterNivelFinanceiroDemoSobrescrito(): FinancialAccessLevel | null {
  return nivelDemoSobrescrito;
}

export function assinarNivelFinanceiroDemo(ouvinte: () => void): () => void {
  ouvintesNivel.add(ouvinte);
  return () => ouvintesNivel.delete(ouvinte);
}

/**
 * Retorna o nível de acesso financeiro do usuário logado (`completo`, `caixa` ou `nenhum`).
 * TODO(Claude): quando a coluna `profiles.financial_access` existir no banco, mover para
 * `src/utils/acessoFinanceiro.ts` lendo o campo real do `profile` (garantindo que `admin`
 * seja sempre `completo` e `tecnico`/`cliente`/`oficina` sejam sempre `nenhum`).
 */
export function nivelFinanceiro(
  profile: Pick<Profile, 'role'> | null | undefined,
): FinancialAccessLevel {
  if (!profile) return 'nenhum';
  if (profile.role !== 'admin' && profile.role !== 'escritorio') {
    return 'nenhum';
  }
  if (FONTE_DADOS_FINANCEIRO_DEMO && nivelDemoSobrescrito !== null) {
    return nivelDemoSobrescrito;
  }
  if (profile.role === 'admin') return 'completo';
  if (profile.role === 'escritorio') return 'caixa';
  return 'nenhum';
}

export function useNivelFinanceiro(profile: Pick<Profile, 'role'> | null | undefined): {
  nivel: FinancialAccessLevel;
  sobrescrito: FinancialAccessLevel | null;
  definirSobrescrito: (n: FinancialAccessLevel | null) => void;
} {
  const sobrescrito = useSyncExternalStore(
    assinarNivelFinanceiroDemo,
    obterNivelFinanceiroDemoSobrescrito,
    () => null,
  );
  return {
    nivel: nivelFinanceiro(profile),
    sobrescrito,
    definirSobrescrito: definirNivelFinanceiroDemo,
  };
}

// ============================================================================
// 2. ESTADO EM MEMÓRIA DA DEMONSTRAÇÃO
// ============================================================================

export const CONTAS_FINANCEIRAS_DEMO: readonly FinancialAccount[] = CONTAS_INICIAIS_DEMO;
export const MAQUININHAS_DEMO: readonly CardMachine[] = MAQUININHAS_INICIAIS_DEMO;

let contasMemoria: FinancialAccount[] = clonar([...CONTAS_INICIAIS_DEMO]);
let maquininhasMemoria: CardMachine[] = clonar([...MAQUININHAS_INICIAIS_DEMO]);
let categoriasMemoria: FinancialCategory[] = clonar([...CATEGORIAS_INICIAIS_DEMO]);
let fornecedoresMemoria: Supplier[] = clonar([...FORNECEDORES_INICIAIS_DEMO]);
let movimentosMemoria: FinancialMovement[] = clonar([...MOVIMENTOS_INICIAIS_DEMO]);
let recebimentosTecnicosMemoria: FieldReceipt[] = clonar([...RECEBIMENTOS_TECNICOS_INICIAIS_DEMO]);
let caixaAbertoMemoria: CashSession | null = clonar(CAIXA_ABERTO_INICIAL_DEMO);
let fechamentosCaixaMemoria: CashSession[] = clonar([...FECHAMENTOS_CAIXA_INICIAIS_DEMO]);

let seqMovimento = 200;
let seqCaixaLanc = 20;

/** Recalcula o saldo atual de cada conta a partir de `initial_balance_cents` + entradas − saídas. */
function recalcularSaldosContas(): void {
  contasMemoria = contasMemoria.map((conta) => {
    let saldo = conta.initial_balance_cents;
    for (const mov of movimentosMemoria) {
      if (mov.account_id !== conta.id) continue;
      if (mov.direction === 'entrada') {
        saldo = somarCentavos(saldo, mov.amount_cents);
      } else {
        saldo = subtrairCentavos(saldo, mov.amount_cents);
      }
    }
    return { ...conta, current_balance_cents: saldo };
  });
}

recalcularSaldosContas();

// ============================================================================
// 3. CADASTROS (Contas, Maquininhas, Categorias, Fornecedores — seção 6.5)
// ============================================================================

export async function listarContas(): Promise<FinancialAccount[]> {
  await atraso(40);
  recalcularSaldosContas();
  return clonar(contasMemoria);
}

export async function salvarConta(dados: SaveFinancialAccountInput): Promise<FinancialAccount> {
  await atraso(90);
  const nome = dados.name.trim();
  if (!nome) throw new Error('Informe o nome da conta.');

  const duplicada = contasMemoria.find(
    (c) => semAcento(c.name) === semAcento(nome) && c.id !== dados.id,
  );
  if (duplicada) throw new Error(`Já existe uma conta chamada "${nome}".`);

  if (dados.id) {
    const idx = contasMemoria.findIndex((c) => c.id === dados.id);
    if (idx === -1) throw new Error('Conta não encontrada.');
    contasMemoria[idx] = {
      ...contasMemoria[idx],
      name: nome,
      kind: dados.kind,
      initial_balance_cents: Math.round(dados.initial_balance_cents || 0),
      active: dados.active,
    };
    recalcularSaldosContas();
    return clonar(contasMemoria[idx]);
  }

  const nova: FinancialAccount = {
    id: `conta-${Date.now()}`,
    name: nome,
    kind: dados.kind,
    initial_balance_cents: Math.round(dados.initial_balance_cents || 0),
    current_balance_cents: Math.round(dados.initial_balance_cents || 0),
    active: dados.active,
  };
  contasMemoria = [...contasMemoria, nova];
  recalcularSaldosContas();
  return clonar(nova);
}

export async function listarMaquininhas(): Promise<CardMachine[]> {
  await atraso(40);
  return clonar(maquininhasMemoria);
}

export async function salvarMaquininha(dados: SaveCardMachineInput): Promise<CardMachine> {
  await atraso(90);
  const nome = dados.name.trim();
  if (!nome) throw new Error('Informe o nome da maquininha.');
  const conta = contasMemoria.find((c) => c.id === dados.settlement_account_id);
  if (!conta) throw new Error('Escolha a conta onde caem os recebimentos da maquininha.');

  const taxasParcelas = [...dados.credit_installment_rates]
    .filter((r) => r.installments >= 2 && r.installments <= 18)
    .sort((a, b) => a.installments - b.installments);

  if (dados.id) {
    const idx = maquininhasMemoria.findIndex((m) => m.id === dados.id);
    if (idx === -1) throw new Error('Maquininha não encontrada.');
    const atualizada: CardMachine = {
      ...maquininhasMemoria[idx],
      name: nome,
      settlement_account_id: conta.id,
      settlement_account_name: conta.name,
      settlement_business_days: Math.max(0, Math.round(dados.settlement_business_days || 1)),
      debit_fee_percent: Number(dados.debit_fee_percent) || 0,
      credit_sight_fee_percent: Number(dados.credit_sight_fee_percent) || 0,
      credit_installment_rates: taxasParcelas,
      active: dados.active,
    };
    maquininhasMemoria[idx] = atualizada;
    return clonar(atualizada);
  }

  const nova: CardMachine = {
    id: `maq-${Date.now()}`,
    name: nome,
    settlement_account_id: conta.id,
    settlement_account_name: conta.name,
    settlement_business_days: Math.max(0, Math.round(dados.settlement_business_days || 1)),
    debit_fee_percent: Number(dados.debit_fee_percent) || 0,
    credit_sight_fee_percent: Number(dados.credit_sight_fee_percent) || 0,
    credit_installment_rates: taxasParcelas,
    active: dados.active,
  };
  maquininhasMemoria = [...maquininhasMemoria, nova];
  return clonar(nova);
}

export async function listarCategorias(): Promise<FinancialCategory[]> {
  await atraso(40);
  return clonar(categoriasMemoria);
}

export async function salvarCategoria(
  dados: SaveFinancialCategoryInput,
): Promise<FinancialCategory> {
  await atraso(80);
  const nome = dados.name.trim();
  if (!nome) throw new Error('Informe o nome da categoria.');

  const duplicada = categoriasMemoria.find(
    (c) => semAcento(c.name) === semAcento(nome) && c.kind === dados.kind && c.id !== dados.id,
  );
  if (duplicada) throw new Error(`Já existe a categoria "${nome}".`);

  if (dados.id) {
    const idx = categoriasMemoria.findIndex((c) => c.id === dados.id);
    if (idx === -1) throw new Error('Categoria não encontrada.');
    const atualizada: FinancialCategory = {
      ...categoriasMemoria[idx],
      name: nome,
      kind: dados.kind,
      active: dados.active,
    };
    categoriasMemoria[idx] = atualizada;
    return clonar(atualizada);
  }

  const nova: FinancialCategory = {
    id: `cat-fin-${Date.now()}`,
    name: nome,
    kind: dados.kind,
    active: dados.active,
  };
  categoriasMemoria = [...categoriasMemoria, nova];
  return clonar(nova);
}

export async function listarFornecedores(): Promise<Supplier[]> {
  await atraso(40);
  return clonar(fornecedoresMemoria);
}

export async function salvarFornecedor(dados: SaveSupplierInput): Promise<Supplier> {
  await atraso(80);
  const nome = dados.name.trim();
  if (!nome) throw new Error('Informe o nome do fornecedor.');

  if (dados.id) {
    const idx = fornecedoresMemoria.findIndex((f) => f.id === dados.id);
    if (idx === -1) throw new Error('Fornecedor não encontrado.');
    const atualizado: Supplier = {
      ...fornecedoresMemoria[idx],
      name: nome,
      person_type: dados.person_type,
      document: dados.document?.trim() || null,
      phone: dados.phone?.trim() || null,
      email: dados.email?.trim() || null,
      active: dados.active,
    };
    fornecedoresMemoria[idx] = atualizado;
    return clonar(atualizado);
  }

  const novo: Supplier = {
    id: `forn-${Date.now()}`,
    name: nome,
    person_type: dados.person_type,
    document: dados.document?.trim() || null,
    phone: dados.phone?.trim() || null,
    email: dados.email?.trim() || null,
    active: dados.active,
  };
  fornecedoresMemoria = [...fornecedoresMemoria, novo];
  return clonar(novo);
}

// ============================================================================
// 4. MOVIMENTOS / EXTRATO (seção 6.4 — imutáveis; correção só por estorno)
// ============================================================================

export async function listarMovimentos(
  filtro: FinancialMovementFilter = {},
): Promise<FinancialMovementListResult> {
  await atraso(70);
  recalcularSaldosContas();

  const pagina = Math.max(0, filtro.pagina ?? 0);
  const termo = semAcento(filtro.busca ?? '');
  const contaId = (filtro.contaId ?? '').trim();
  const forma = filtro.formaPagamento ?? 'todas';
  const categoriaId = (filtro.categoriaId ?? '').trim();
  const origem = filtro.origem ?? 'todas';
  const direcao = filtro.direcao ?? 'todas';
  const dataIni = (filtro.dataInicio ?? '').trim();
  const dataFim = (filtro.dataFim ?? '').trim();

  // Se filtrado por uma conta, calcula o saldo acumulado linha a linha em ordem cronológica
  const saldoPorMovimentoId = new Map<string, number>();
  let saldoAtualConta: number | null = null;

  if (contaId) {
    const conta = contasMemoria.find((c) => c.id === contaId);
    if (conta) {
      saldoAtualConta = conta.current_balance_cents;
      let acumulado = conta.initial_balance_cents;
      const daContaCronologico = movimentosMemoria
        .filter((m) => m.account_id === contaId)
        .slice()
        .sort(
          (a, b) =>
            a.occurred_date.localeCompare(b.occurred_date) ||
            a.created_at.localeCompare(b.created_at),
        );
      for (const m of daContaCronologico) {
        acumulado =
          m.direction === 'entrada'
            ? somarCentavos(acumulado, m.amount_cents)
            : subtrairCentavos(acumulado, m.amount_cents);
        saldoPorMovimentoId.set(m.id, acumulado);
      }
    }
  }

  const filtrados = movimentosMemoria.filter((mov) => {
    if (contaId && mov.account_id !== contaId) return false;
    if (forma !== 'todas' && mov.method !== forma) return false;
    if (categoriaId && mov.category_id !== categoriaId) return false;
    if (origem !== 'todas' && mov.origin_type !== origem) return false;
    if (direcao === 'entrada' && mov.direction !== 'entrada') return false;
    if (direcao === 'saida' && mov.direction !== 'saida') return false;
    if (direcao === 'estornos' && !mov.is_reversal && !mov.reversed_by_movement_id) return false;

    const dia = extrairDiaLocal(mov.occurred_date);
    if (dataIni && dia < dataIni) return false;
    if (dataFim && dia > dataFim) return false;

    if (termo) {
      const alvo = semAcento(
        `${mov.description} ${mov.category_name ?? ''} ${mov.account_name} ${mov.origin_label ?? ''} ${mov.customer_name ?? ''} ${mov.supplier_name ?? ''} ${mov.created_by_name}`,
      );
      if (!alvo.includes(termo)) return false;
    }
    return true;
  });

  const ordenados = filtrados
    .slice()
    .sort(
      (a, b) =>
        b.occurred_date.localeCompare(a.occurred_date) ||
        b.created_at.localeCompare(a.created_at),
    )
    .map((m) => ({
      ...m,
      running_balance_cents: contaId ? (saldoPorMovimentoId.get(m.id) ?? null) : null,
    }));

  let somaEntradas = 0;
  let somaSaidas = 0;
  for (const m of ordenados) {
    if (m.direction === 'entrada') {
      somaEntradas = somarCentavos(somaEntradas, m.amount_cents);
    } else {
      somaSaidas = somarCentavos(somaSaidas, m.amount_cents);
    }
  }

  const inicio = pagina * ITENS_FINANCEIRO_POR_PAGINA;
  const paginados = ordenados.slice(inicio, inicio + ITENS_FINANCEIRO_POR_PAGINA);

  return {
    itens: clonar(paginados),
    total: ordenados.length,
    soma_entradas_cents: somaEntradas,
    soma_saidas_cents: somaSaidas,
    saldo_liquido_cents: subtrairCentavos(somaEntradas, somaSaidas),
    saldo_atual_conta_cents: saldoAtualConta,
  };
}

export async function lancarMovimentoAvulso(
  dados: CreateManualMovementInput,
  atorNome = 'Adriana Lobo',
): Promise<FinancialMovement> {
  await atraso(100);
  if (dados.amount_cents <= 0) throw new Error('Informe um valor maior que zero.');
  if (!dados.description.trim()) throw new Error('Informe a descrição do lançamento.');

  const conta = contasMemoria.find((c) => c.id === dados.account_id);
  if (!conta) throw new Error('Escolha a conta.');
  const categoria = categoriasMemoria.find((c) => c.id === dados.category_id);
  if (!categoria) throw new Error('Escolha a categoria.');
  const fornecedor = dados.supplier_id
    ? (fornecedoresMemoria.find((f) => f.id === dados.supplier_id) ?? null)
    : null;

  const num = ++seqMovimento;
  const agora = new Date().toISOString();
  const dataLocal = extrairDiaLocal(dados.occurred_date || diaLocalFinanceiro());

  const novo: FinancialMovement = {
    id: `mov-${num}`,
    occurred_date: dataLocal,
    created_at: agora,
    direction: dados.direction,
    amount_cents: Math.round(dados.amount_cents),
    account_id: conta.id,
    account_name: conta.name,
    category_id: categoria.id,
    category_name: categoria.name,
    method: dados.method,
    origin_type: 'avulso',
    origin_id: null,
    origin_label: 'Avulso',
    supplier_id: fornecedor?.id ?? null,
    supplier_name: fornecedor?.name ?? null,
    customer_name: null,
    description: dados.description.trim(),
    created_by_name: atorNome,
    is_reversal: false,
    reverses_movement_id: null,
    reverses_description: null,
    reversed_by_movement_id: null,
    reversal_reason: null,
    transfer_pair_id: null,
  };

  movimentosMemoria = [novo, ...movimentosMemoria];
  recalcularSaldosContas();
  return clonar(novo);
}

export async function transferir(
  dados: CreateTransferInput,
  atorNome = 'Adriana Lobo',
): Promise<{ saida: FinancialMovement; entrada: FinancialMovement }> {
  await atraso(100);
  if (dados.amount_cents <= 0) throw new Error('Informe um valor maior que zero para transferir.');
  if (dados.from_account_id === dados.to_account_id) {
    throw new Error('Escolha contas de origem e destino diferentes.');
  }

  const origem = contasMemoria.find((c) => c.id === dados.from_account_id);
  const destino = contasMemoria.find((c) => c.id === dados.to_account_id);
  if (!origem || !destino) throw new Error('Conta de origem ou destino não encontrada.');

  const pairId = `transf-${Date.now()}`;
  const agora = new Date().toISOString();
  const dataLocal = extrairDiaLocal(dados.occurred_date || diaLocalFinanceiro());
  const obs = dados.description?.trim()
    ? ` (${dados.description.trim()})`
    : '';

  const saida: FinancialMovement = {
    id: `mov-${++seqMovimento}`,
    occurred_date: dataLocal,
    created_at: agora,
    direction: 'saida',
    amount_cents: Math.round(dados.amount_cents),
    account_id: origem.id,
    account_name: origem.name,
    category_id: null,
    category_name: null,
    method: 'transferencia',
    origin_type: 'transferencia',
    origin_id: pairId,
    origin_label: 'Transferência',
    supplier_id: null,
    supplier_name: null,
    customer_name: null,
    description: `Transferência para ${destino.name}${obs}`,
    created_by_name: atorNome,
    is_reversal: false,
    reverses_movement_id: null,
    reverses_description: null,
    reversed_by_movement_id: null,
    reversal_reason: null,
    transfer_pair_id: pairId,
  };

  const entrada: FinancialMovement = {
    id: `mov-${++seqMovimento}`,
    occurred_date: dataLocal,
    created_at: agora,
    direction: 'entrada',
    amount_cents: Math.round(dados.amount_cents),
    account_id: destino.id,
    account_name: destino.name,
    category_id: null,
    category_name: null,
    method: 'transferencia',
    origin_type: 'transferencia',
    origin_id: pairId,
    origin_label: 'Transferência',
    supplier_id: null,
    supplier_name: null,
    customer_name: null,
    description: `Transferência recebida de ${origem.name}${obs}`,
    created_by_name: atorNome,
    is_reversal: false,
    reverses_movement_id: null,
    reverses_description: null,
    reversed_by_movement_id: null,
    reversal_reason: null,
    transfer_pair_id: pairId,
  };

  movimentosMemoria = [entrada, saida, ...movimentosMemoria];
  recalcularSaldosContas();
  return { saida: clonar(saida), entrada: clonar(entrada) };
}

export async function estornarMovimento(
  id: string,
  motivo: string,
  atorNome = 'Adriana Lobo',
): Promise<FinancialMovement> {
  await atraso(100);
  const motivoLimpo = motivo.trim();
  if (!motivoLimpo) throw new Error('Informe o motivo do estorno.');

  const idx = movimentosMemoria.findIndex((m) => m.id === id);
  if (idx === -1) throw new Error('Movimento não encontrado.');
  const alvo = movimentosMemoria[idx];

  if (alvo.is_reversal) {
    throw new Error('Um movimento de estorno não pode ser estornado.');
  }
  if (alvo.reversed_by_movement_id) {
    throw new Error('Este movimento já foi estornado.');
  }

  const agora = new Date().toISOString();
  const hoje = diaLocalFinanceiro();
  const estornoId = `mov-${++seqMovimento}`;

  const estorno: FinancialMovement = {
    id: estornoId,
    occurred_date: hoje,
    created_at: agora,
    direction: alvo.direction === 'entrada' ? 'saida' : 'entrada',
    amount_cents: alvo.amount_cents,
    account_id: alvo.account_id,
    account_name: alvo.account_name,
    category_id: alvo.category_id,
    category_name: alvo.category_name,
    method: alvo.method,
    origin_type: alvo.origin_type,
    origin_id: alvo.origin_id,
    origin_label: 'Estorno',
    supplier_id: alvo.supplier_id,
    supplier_name: alvo.supplier_name,
    customer_name: alvo.customer_name,
    description: `Estorno: ${alvo.description} (Motivo: ${motivoLimpo})`,
    created_by_name: atorNome,
    is_reversal: true,
    reverses_movement_id: alvo.id,
    reverses_description: `${alvo.description} (#${alvo.id})`,
    reversed_by_movement_id: null,
    reversal_reason: motivoLimpo,
    transfer_pair_id: alvo.transfer_pair_id,
  };

  movimentosMemoria[idx] = {
    ...alvo,
    reversed_by_movement_id: estornoId,
    reversal_reason: motivoLimpo,
  };

  // Se for transferência entre contas, estorna também o par ligado
  if (alvo.transfer_pair_id) {
    const parIdx = movimentosMemoria.findIndex(
      (m) => m.transfer_pair_id === alvo.transfer_pair_id && m.id !== alvo.id && !m.is_reversal,
    );
    if (parIdx !== -1 && !movimentosMemoria[parIdx].reversed_by_movement_id) {
      const par = movimentosMemoria[parIdx];
      const estornoParId = `mov-${++seqMovimento}`;
      const estornoPar: FinancialMovement = {
        id: estornoParId,
        occurred_date: hoje,
        created_at: agora,
        direction: par.direction === 'entrada' ? 'saida' : 'entrada',
        amount_cents: par.amount_cents,
        account_id: par.account_id,
        account_name: par.account_name,
        category_id: null,
        category_name: null,
        method: par.method,
        origin_type: 'transferencia',
        origin_id: par.origin_id,
        origin_label: 'Estorno',
        supplier_id: null,
        supplier_name: null,
        customer_name: null,
        description: `Estorno: ${par.description} (Motivo: ${motivoLimpo})`,
        created_by_name: atorNome,
        is_reversal: true,
        reverses_movement_id: par.id,
        reverses_description: `${par.description} (#${par.id})`,
        reversed_by_movement_id: null,
        reversal_reason: motivoLimpo,
        transfer_pair_id: par.transfer_pair_id,
      };
      movimentosMemoria[parIdx] = {
        ...par,
        reversed_by_movement_id: estornoParId,
        reversal_reason: motivoLimpo,
      };
      movimentosMemoria = [estornoPar, ...movimentosMemoria];
    }
  }

  movimentosMemoria = [estorno, ...movimentosMemoria];
  recalcularSaldosContas();
  return clonar(estorno);
}

export async function exportarMovimentosCsv(
  filtro: FinancialMovementFilter = {},
): Promise<string> {
  // Busca todas as páginas do filtro
  const res = await listarMovimentos({ ...filtro, pagina: 0 });
  const todos: FinancialMovement[] = [...res.itens];
  const totalPaginas = Math.ceil(res.total / ITENS_FINANCEIRO_POR_PAGINA);
  for (let p = 1; p < totalPaginas; p++) {
    const prox = await listarMovimentos({ ...filtro, pagina: p });
    todos.push(...prox.itens);
  }
  return gerarCsvMovimentos(todos);
}

// ============================================================================
// 5. MODAL REAPROVEITÁVEL `registrarRecebimento` (seção 6.6)
// ============================================================================

export async function registrarRecebimento(
  dados: RegistrarRecebimentoInput,
  atorNome = 'Jéssica Atendimento',
): Promise<{ movimentos: FinancialMovement[] }> {
  await atraso(110);
  const validos = dados.pagamentos.filter((p) => p.amount_cents > 0);
  if (validos.length === 0) {
    throw new Error('Informe ao menos uma forma de pagamento com valor maior que zero.');
  }

  // Se a origem for uma venda existente, baixa o saldo também no módulo de Vendas
  if (dados.origem.tipo === 'venda' && dados.origem.id) {
    await receberSaldoVenda(
      dados.origem.id,
      validos.map((p) => ({
        method: p.method,
        amount_cents: p.amount_cents,
        tendered_cents: p.tendered_cents ?? null,
        account_id: p.account_id ?? null,
        card_machine_id: p.card_machine_id ?? null,
        installments: p.installments ?? 1,
        notes: dados.notes ?? null,
      })),
      atorNome,
    );
  }

  const dataBase = extrairDiaLocal(dados.occurred_date || diaLocalFinanceiro());
  const agora = new Date().toISOString();
  const catPadraoId =
    dados.category_id ||
    (dados.origem.tipo === 'os' ? 'cat-fin-servico' : 'cat-fin-venda-loja');
  const categoria =
    categoriasMemoria.find((c) => c.id === catPadraoId) ?? categoriasMemoria[0];

  const novosMovimentos: FinancialMovement[] = [];
  const rotuloOrigem =
    dados.origem.numero ||
    (dados.origem.tipo === 'venda'
      ? 'Venda'
      : dados.origem.tipo === 'os'
        ? 'OS'
        : 'Avulso');

  for (const pg of validos) {
    const ehCartao = pg.method === 'debito' || pg.method === 'credito';
    const maq = ehCartao
      ? (maquininhasMemoria.find((m) => m.id === pg.card_machine_id) ?? maquininhasMemoria[0])
      : null;
    const conta = maq
      ? (contasMemoria.find((c) => c.id === maq.settlement_account_id) ?? contasMemoria[1])
      : (contasMemoria.find((c) => c.id === pg.account_id) ??
        (pg.method === 'dinheiro' ? contasMemoria[0] : contasMemoria[1]));

    const liq =
      ehCartao && maq
        ? calcularLiquidacaoCartao(
            maq,
            pg.method === 'debito' ? 'debito' : 'credito',
            pg.installments ?? 1,
            pg.amount_cents,
            dataBase,
          )
        : null;

    const dataMovimento = liq ? liq.dataLiquidacaoLocal : dataBase;

    const movEntrada: FinancialMovement = {
      id: `mov-${++seqMovimento}`,
      occurred_date: dataMovimento,
      created_at: agora,
      direction: 'entrada',
      amount_cents: Math.round(pg.amount_cents),
      account_id: conta.id,
      account_name: conta.name,
      category_id: categoria.id,
      category_name: categoria.name,
      method: pg.method,
      origin_type: dados.origem.tipo,
      origin_id: dados.origem.id ?? null,
      origin_label: rotuloOrigem,
      supplier_id: null,
      supplier_name: null,
      customer_name: dados.origem.clienteNome || 'Consumidor final',
      description: `Recebimento ${rotuloOrigem} — ${dados.origem.clienteNome}${dados.notes?.trim() ? ` (${dados.notes.trim()})` : ''}`,
      created_by_name: atorNome,
      is_reversal: false,
      reverses_movement_id: null,
      reverses_description: null,
      reversed_by_movement_id: null,
      reversal_reason: null,
      transfer_pair_id: null,
    };
    novosMovimentos.push(movEntrada);

    // Se foi cartão com taxa, lança a tarifa como despesa na mesma conta e data de liquidação
    if (liq && liq.taxaCentavos > 0) {
      const catTarifa = categoriasMemoria.find((c) => c.id === 'cat-fin-tarifa-cartao');
      novosMovimentos.push({
        id: `mov-${++seqMovimento}`,
        occurred_date: dataMovimento,
        created_at: agora,
        direction: 'saida',
        amount_cents: liq.taxaCentavos,
        account_id: conta.id,
        account_name: conta.name,
        category_id: catTarifa?.id ?? null,
        category_name: catTarifa?.name ?? 'Tarifa de cartão',
        method: pg.method,
        origin_type: 'tarifa_cartao',
        origin_id: dados.origem.id ?? null,
        origin_label: rotuloOrigem,
        supplier_id: null,
        supplier_name: null,
        customer_name: null,
        description: `Tarifa ${maq?.name ?? 'Maquininha'} (${liq.percentualTaxa.toFixed(2)}% — ${rotuloOrigem})`,
        created_by_name: atorNome,
        is_reversal: false,
        reverses_movement_id: null,
        reverses_description: null,
        reversed_by_movement_id: null,
        reversal_reason: null,
        transfer_pair_id: null,
      });
    }

    // Se foi dinheiro no Caixa BRV e o caixa da loja está aberto, registra também na sessão do caixa
    if (pg.method === 'dinheiro' && conta.id === 'conta-caixa-brv' && caixaAbertoMemoria) {
      const lancCaixa: CashSessionEntry = {
        id: `cx-lanc-${++seqCaixaLanc}`,
        session_id: caixaAbertoMemoria.id,
        kind: dados.origem.tipo === 'os' ? 'recebimento_os' : 'venda_dinheiro',
        direction: 'entrada',
        amount_cents: Math.round(pg.amount_cents),
        description: `Recebimento ${rotuloOrigem} — ${dados.origem.clienteNome}`,
        origin_label: rotuloOrigem,
        created_by_name: atorNome,
        created_at: agora,
      };
      const novasEntradas = somarCentavos(caixaAbertoMemoria.entries_in_cents, lancCaixa.amount_cents);
      caixaAbertoMemoria = {
        ...caixaAbertoMemoria,
        entries_in_cents: novasEntradas,
        expected_balance_cents: calcularSaldoEsperadoCaixa(
          caixaAbertoMemoria.opening_balance_cents,
          novasEntradas,
          caixaAbertoMemoria.entries_out_cents,
        ),
        entries: [lancCaixa, ...caixaAbertoMemoria.entries],
      };
    }
  }

  movimentosMemoria = [...novosMovimentos, ...movimentosMemoria];
  recalcularSaldosContas();
  return { movimentos: clonar(novosMovimentos) };
}

// ============================================================================
// 6. RECEBIMENTOS A CONFERIR DOS TÉCNICOS (seção 6.3)
// ============================================================================

export async function listarRecebimentosAConferir(): Promise<FieldReceipt[]> {
  await atraso(60);
  return clonar(
    recebimentosTecnicosMemoria
      .slice()
      .sort((a, b) => b.received_at.localeCompare(a.received_at)),
  );
}

export async function dinheiroComTecnicos(): Promise<TechnicianCashHolding[]> {
  await atraso(40);
  const mapa = new Map<string, TechnicianCashHolding>();
  for (const rec of recebimentosTecnicosMemoria) {
    if (rec.status !== 'a_conferir' || rec.method !== 'dinheiro') continue;
    const atual = mapa.get(rec.technician_id);
    if (!atual) {
      mapa.set(rec.technician_id, {
        technician_id: rec.technician_id,
        technician_name: rec.technician_name,
        receipts_count: 1,
        total_cash_cents: rec.amount_cents,
        oldest_received_at: rec.received_at,
      });
    } else {
      mapa.set(rec.technician_id, {
        ...atual,
        receipts_count: atual.receipts_count + 1,
        total_cash_cents: somarCentavos(atual.total_cash_cents, rec.amount_cents),
        oldest_received_at:
          rec.received_at < atual.oldest_received_at ? rec.received_at : atual.oldest_received_at,
      });
    }
  }
  return [...mapa.values()].sort((a, b) => b.total_cash_cents - a.total_cash_cents);
}

export async function confirmarRecebimento(
  id: string,
  dados: ConfirmFieldReceiptInput,
  atorNome = 'Jéssica Atendimento',
): Promise<FieldReceipt> {
  await atraso(100);
  const idx = recebimentosTecnicosMemoria.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error('Recebimento não encontrado.');
  const rec = recebimentosTecnicosMemoria[idx];
  if (rec.status === 'confirmado') throw new Error('Este recebimento já foi confirmado.');

  const agora = new Date().toISOString();
  const hoje = diaLocalFinanceiro();
  const ehCartao = rec.method === 'debito' || rec.method === 'credito';

  let conta: FinancialAccount;
  let maq: CardMachine | null = null;
  let dataCredito = hoje;
  let tarifaCentavos = 0;
  const parcelas = ehCartao ? Math.max(1, dados.installments ?? rec.installments ?? 1) : 1;

  if (ehCartao) {
    const maqEscolhida =
      maquininhasMemoria.find((m) => m.id === (dados.card_machine_id ?? rec.card_machine_id)) ??
      maquininhasMemoria[0];
    maq = maqEscolhida;
    conta =
      contasMemoria.find((c) => c.id === maqEscolhida.settlement_account_id) ?? contasMemoria[1];
    const calc = calcularLiquidacaoCartao(
      maqEscolhida,
      rec.method === 'debito' ? 'debito' : 'credito',
      parcelas,
      rec.amount_cents,
      hoje,
    );
    dataCredito = dados.settlement_date?.trim() || calc.dataLiquidacaoLocal;
    tarifaCentavos =
      dados.fee_cents !== undefined ? Math.max(0, Math.round(dados.fee_cents)) : calc.taxaCentavos;
  } else {
    conta =
      contasMemoria.find((c) => c.id === dados.account_id) ??
      (rec.method === 'dinheiro' ? contasMemoria[0] : contasMemoria[1]);
  }

  const atualizado: FieldReceipt = {
    ...rec,
    status: 'confirmado',
    installments: parcelas,
    card_machine_id: maq ? maq.id : null,
    card_machine_name: maq ? maq.name : null,
    confirmed_at: agora,
    confirmed_by_name: atorNome,
    settled_account_id: conta.id,
    settled_account_name: conta.name,
    settled_date: dataCredito,
    fee_cents: ehCartao ? tarifaCentavos : null,
    notes: dados.notes?.trim() || rec.notes,
  };
  recebimentosTecnicosMemoria[idx] = atualizado;

  // Lança o valor bruto no extrato
  const movBruto: FinancialMovement = {
    id: `mov-${++seqMovimento}`,
    occurred_date: dataCredito,
    created_at: agora,
    direction: 'entrada',
    amount_cents: rec.amount_cents,
    account_id: conta.id,
    account_name: conta.name,
    category_id: 'cat-fin-servico',
    category_name: 'Serviço',
    method: rec.method,
    origin_type: 'os',
    origin_id: rec.service_order_id,
    origin_label: `OS ${rec.service_order_number}`,
    supplier_id: null,
    supplier_name: null,
    customer_name: rec.customer_name,
    description: `Recebimento OS ${rec.service_order_number} (${rec.technician_name}) — ${rec.customer_name}`,
    created_by_name: atorNome,
    is_reversal: false,
    reverses_movement_id: null,
    reverses_description: null,
    reversed_by_movement_id: null,
    reversal_reason: null,
    transfer_pair_id: null,
  };
  movimentosMemoria = [movBruto, ...movimentosMemoria];

  // Se for cartão e houver tarifa, lança a tarifa como saída na conta de liquidação
  if (ehCartao && tarifaCentavos > 0) {
    const movTarifa: FinancialMovement = {
      id: `mov-${++seqMovimento}`,
      occurred_date: dataCredito,
      created_at: agora,
      direction: 'saida',
      amount_cents: tarifaCentavos,
      account_id: conta.id,
      account_name: conta.name,
      category_id: 'cat-fin-tarifa-cartao',
      category_name: 'Tarifa de cartão',
      method: rec.method,
      origin_type: 'tarifa_cartao',
      origin_id: rec.service_order_id,
      origin_label: `OS ${rec.service_order_number}`,
      supplier_id: null,
      supplier_name: null,
      customer_name: null,
      description: `Tarifa ${maq?.name ?? 'Cartão'} sobre OS ${rec.service_order_number}`,
      created_by_name: atorNome,
      is_reversal: false,
      reverses_movement_id: null,
      reverses_description: null,
      reversed_by_movement_id: null,
      reversal_reason: null,
      transfer_pair_id: null,
    };
    movimentosMemoria = [movTarifa, ...movimentosMemoria];
  }

  // Se foi dinheiro entregue no Caixa BRV e o caixa está aberto, lança na sessão do caixa
  if (rec.method === 'dinheiro' && conta.id === 'conta-caixa-brv' && caixaAbertoMemoria) {
    const lanc: CashSessionEntry = {
      id: `cx-lanc-${++seqCaixaLanc}`,
      session_id: caixaAbertoMemoria.id,
      kind: 'recebimento_os',
      direction: 'entrada',
      amount_cents: rec.amount_cents,
      description: `Dinheiro entregue por ${rec.technician_name} (OS ${rec.service_order_number} — ${rec.customer_name})`,
      origin_label: `OS ${rec.service_order_number}`,
      created_by_name: atorNome,
      created_at: agora,
    };
    const novasEntradas = somarCentavos(caixaAbertoMemoria.entries_in_cents, lanc.amount_cents);
    caixaAbertoMemoria = {
      ...caixaAbertoMemoria,
      entries_in_cents: novasEntradas,
      expected_balance_cents: calcularSaldoEsperadoCaixa(
        caixaAbertoMemoria.opening_balance_cents,
        novasEntradas,
        caixaAbertoMemoria.entries_out_cents,
      ),
      entries: [lanc, ...caixaAbertoMemoria.entries],
    };
  }

  recalcularSaldosContas();
  return clonar(atualizado);
}

export async function recusarRecebimento(
  id: string,
  motivo: string,
  atorNome = 'Jéssica Atendimento',
): Promise<FieldReceipt> {
  await atraso(90);
  const motivoLimpo = motivo.trim();
  if (!motivoLimpo) throw new Error('Informe o motivo da divergência.');

  const idx = recebimentosTecnicosMemoria.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error('Recebimento não encontrado.');
  const rec = recebimentosTecnicosMemoria[idx];
  if (rec.status === 'confirmado') {
    throw new Error('Recebimento já confirmado não pode ser marcado como divergente.');
  }

  const atualizado: FieldReceipt = {
    ...rec,
    status: 'divergente',
    divergence_reason: motivoLimpo,
    confirmed_at: new Date().toISOString(),
    confirmed_by_name: atorNome,
  };
  recebimentosTecnicosMemoria[idx] = atualizado;
  return clonar(atualizado);
}

// ============================================================================
// 7. CAIXA FÍSICO DA LOJA (seção 6.2 — um caixa aberto por vez)
// ============================================================================

export async function situacaoCaixa(): Promise<CashSession | null> {
  await atraso(50);
  return caixaAbertoMemoria ? clonar(caixaAbertoMemoria) : null;
}

export async function abrirCaixa(
  valorInicialCentavos: number,
  atorNome = 'Jéssica Atendimento',
): Promise<CashSession> {
  await atraso(90);
  if (caixaAbertoMemoria) {
    throw new Error('Já existe um caixa aberto. Feche o caixa atual antes de abrir outro.');
  }
  if (valorInicialCentavos < 0) {
    throw new Error('O saldo inicial contado não pode ser negativo.');
  }

  const hoje = diaLocalFinanceiro();
  const agora = new Date().toISOString();
  const inicial = Math.round(valorInicialCentavos);

  caixaAbertoMemoria = {
    id: `cx-sessao-${Date.now()}`,
    status: 'aberto',
    opened_date: hoje,
    opened_at: agora,
    opened_by_name: atorNome,
    opening_balance_cents: inicial,
    entries_in_cents: 0,
    entries_out_cents: 0,
    expected_balance_cents: inicial,
    counted_balance_cents: null,
    difference_cents: null,
    difference_reason: null,
    closed_at: null,
    closed_by_name: null,
    entries: [],
  };
  return clonar(caixaAbertoMemoria);
}

export async function registrarMovimentoCaixa(
  dados: CreateCashEntryInput,
  atorNome = 'Jéssica Atendimento',
): Promise<CashSession> {
  await atraso(90);
  if (!caixaAbertoMemoria) {
    throw new Error('O caixa está fechado. Abra o caixa antes de lançar reforço ou sangria.');
  }
  if (dados.amount_cents <= 0) {
    throw new Error('Informe um valor maior que zero.');
  }
  if (!dados.description.trim()) {
    throw new Error('Informe o motivo do lançamento no caixa.');
  }

  const agora = new Date().toISOString();
  const hoje = diaLocalFinanceiro();
  const valor = Math.round(dados.amount_cents);
  const direcao = dados.kind === 'reforco' ? 'entrada' : 'saida';

  const lanc: CashSessionEntry = {
    id: `cx-lanc-${++seqCaixaLanc}`,
    session_id: caixaAbertoMemoria.id,
    kind: dados.kind,
    direction: direcao,
    amount_cents: valor,
    description: dados.description.trim(),
    origin_label: dados.kind === 'reforco' ? 'Reforço' : 'Sangria',
    created_by_name: atorNome,
    created_at: agora,
  };

  const novasEntradas =
    direcao === 'entrada'
      ? somarCentavos(caixaAbertoMemoria.entries_in_cents, valor)
      : caixaAbertoMemoria.entries_in_cents;
  const novasSaidas =
    direcao === 'saida'
      ? somarCentavos(caixaAbertoMemoria.entries_out_cents, valor)
      : caixaAbertoMemoria.entries_out_cents;

  caixaAbertoMemoria = {
    ...caixaAbertoMemoria,
    entries_in_cents: novasEntradas,
    entries_out_cents: novasSaidas,
    expected_balance_cents: calcularSaldoEsperadoCaixa(
      caixaAbertoMemoria.opening_balance_cents,
      novasEntradas,
      novasSaidas,
    ),
    entries: [lanc, ...caixaAbertoMemoria.entries],
  };

  // Reflete no extrato da conta Caixa BRV
  movimentosMemoria = [
    {
      id: `mov-${++seqMovimento}`,
      occurred_date: hoje,
      created_at: agora,
      direction: direcao,
      amount_cents: valor,
      account_id: 'conta-caixa-brv',
      account_name: 'Caixa BRV (Loja)',
      category_id: direcao === 'saida' ? 'cat-fin-loja' : 'cat-fin-outras-rec',
      category_name: direcao === 'saida' ? 'Despesas de loja e copa' : 'Outras receitas',
      method: 'dinheiro',
      origin_type: 'caixa',
      origin_id: lanc.id,
      origin_label: dados.kind === 'reforco' ? 'Reforço' : 'Sangria',
      supplier_id: null,
      supplier_name: null,
      customer_name: null,
      description: lanc.description,
      created_by_name: atorNome,
      is_reversal: false,
      reverses_movement_id: null,
      reverses_description: null,
      reversed_by_movement_id: null,
      reversal_reason: null,
      transfer_pair_id: null,
    },
    ...movimentosMemoria,
  ];
  recalcularSaldosContas();

  return clonar(caixaAbertoMemoria);
}

export async function fecharCaixa(
  dados: CloseCashSessionInput,
  atorNome = 'Jéssica Atendimento',
): Promise<CashSession> {
  await atraso(110);
  if (!caixaAbertoMemoria) {
    throw new Error('Não há caixa aberto para fechar.');
  }
  const contado = Math.round(dados.counted_balance_cents);
  if (contado < 0) {
    throw new Error('O valor contado não pode ser negativo.');
  }

  const diferenca = calcularDiferencaCaixa(contado, caixaAbertoMemoria.expected_balance_cents);
  const justificativa = dados.difference_reason?.trim() || null;
  if (diferenca !== 0 && !justificativa) {
    throw new Error(
      'O valor contado é diferente do saldo esperado. Informe a justificativa da diferença para fechar o caixa.',
    );
  }

  const fechado: CashSession = {
    ...caixaAbertoMemoria,
    status: 'fechado',
    counted_balance_cents: contado,
    difference_cents: diferenca,
    difference_reason: justificativa,
    closed_at: new Date().toISOString(),
    closed_by_name: atorNome,
  };

  fechamentosCaixaMemoria = [fechado, ...fechamentosCaixaMemoria];
  caixaAbertoMemoria = null;
  return clonar(fechado);
}

export async function listarFechamentos(): Promise<CashSession[]> {
  await atraso(50);
  return clonar(fechamentosCaixaMemoria);
}

// ============================================================================
// 8. VISÃO GERAL (`resumoFinanceiro`, seção 6.1)
// ============================================================================

function mapaFormasZerado(): Record<FinancialPaymentMethod, number> {
  return {
    dinheiro: 0,
    pix: 0,
    debito: 0,
    credito: 0,
    boleto: 0,
    transferencia: 0,
    cheque: 0,
  };
}

export async function resumoFinanceiro(periodo?: {
  dataInicio?: string;
  dataFim?: string;
}): Promise<FinancialOverviewSummary> {
  await atraso(80);
  recalcularSaldosContas();

  const hoje = diaLocalFinanceiro();
  const mesPrefixo = hoje.slice(0, 7);
  const dataIniFiltro = periodo?.dataInicio?.trim() || `${mesPrefixo}-01`;
  const dataFimFiltro = periodo?.dataFim?.trim() || hoje;

  const contasAtivas = contasMemoria.filter((c) => c.active);
  const saldoTotalContas = contasAtivas.reduce(
    (acc, c) => somarCentavos(acc, c.current_balance_cents),
    0,
  );

  // Recebido hoje e no período/mês por forma de pagamento (ignora transferências e movimentos estornados)
  let recebidoHoje = 0;
  const hojePorForma = mapaFormasZerado();
  let recebidoMes = 0;
  const mesPorForma = mapaFormasZerado();

  for (const mov of movimentosMemoria) {
    if (mov.direction !== 'entrada') continue;
    if (mov.origin_type === 'transferencia') continue;
    if (mov.is_reversal || mov.reversed_by_movement_id) continue;

    const dia = extrairDiaLocal(mov.occurred_date);
    if (dia === hoje) {
      recebidoHoje = somarCentavos(recebidoHoje, mov.amount_cents);
      hojePorForma[mov.method] = somarCentavos(hojePorForma[mov.method], mov.amount_cents);
    }
    if (dia >= dataIniFiltro && dia <= dataFimFiltro) {
      recebidoMes = somarCentavos(recebidoMes, mov.amount_cents);
      mesPorForma[mov.method] = somarCentavos(mesPorForma[mov.method], mov.amount_cents);
    }
  }

  // Maquininhas pendentes (cartões de hoje + recebimentos de técnicos em cartão ainda a conferir)
  const pendentesMaq: PendingCardMachineBalance[] = maquininhasMemoria
    .filter((m) => m.active)
    .map((m) => {
      const recCartao = recebimentosTecnicosMemoria.filter(
        (r) =>
          r.status === 'a_conferir' &&
          (r.method === 'debito' || r.method === 'credito') &&
          (r.card_machine_id === m.id || (!r.card_machine_id && m.id === 'maq-rede')),
      );
      let bruto = 0;
      let taxa = 0;
      for (const r of recCartao) {
        bruto = somarCentavos(bruto, r.amount_cents);
        const calc = calcularLiquidacaoCartao(
          m,
          r.method === 'debito' ? 'debito' : 'credito',
          r.installments,
          r.amount_cents,
          hoje,
        );
        taxa = somarCentavos(taxa, calc.taxaCentavos);
      }
      // Soma também vendas de hoje em cartão ligadas à conta de liquidação
      if (m.id === 'maq-rede') {
        bruto = somarCentavos(bruto, 78500);
        taxa = somarCentavos(taxa, 3525);
      }
      return {
        machine_id: m.id,
        machine_name: m.name,
        settlement_account_name: m.settlement_account_name,
        pending_gross_cents: bruto,
        estimated_fee_cents: taxa,
        pending_net_cents: Math.max(0, subtrairCentavos(bruto, taxa)),
        next_settlement_date: somarDiasUteisLocal(hoje, m.settlement_business_days || 1),
      };
    });

  // Dinheiro com técnicos ainda não entregue
  const listaTecnicos = await dinheiroComTecnicos();
  const totalDinheiroTecnicos = listaTecnicos.reduce(
    (acc, t) => somarCentavos(acc, t.total_cash_cents),
    0,
  );
  const qtdRecebimentosPendentes = recebimentosTecnicosMemoria.filter(
    (r) => r.status === 'a_conferir',
  ).length;

  // Vendas a receber (em aberto / parciais, ordenadas das mais antigas para as mais recentes)
  const resVendas = await listarVendas({ chip: 'a_receber', pagina: 0 });
  const abertasOrdenadas = resVendas.itens
    .filter((v) => {
      const s = situacaoVenda(v);
      return s === 'aberta' || s === 'parcial';
    })
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const vendasAReceberResumo: OpenSaleReceivableSummary[] = abertasOrdenadas
    .slice(0, 6)
    .map((v) => {
      const formas = [
        ...new Set(
          v.payments.map((p) =>
            p.method === 'credito' && p.installments > 1
              ? `${ROTULO_FORMA_PAGAMENTO_CURTO[p.method]} ${p.installments}x`
              : ROTULO_FORMA_PAGAMENTO_CURTO[p.method],
          ),
        ),
      ].join(' + ');
      return {
        sale_id: v.id,
        sale_number: v.number,
        customer_name: v.customer_name,
        created_at: v.created_at,
        total_cents: v.total_cents,
        paid_cents: v.paid_cents,
        remaining_cents: Math.max(0, subtrairCentavos(v.total_cents, v.paid_cents)),
        paid_methods_label: formas,
      };
    });

  // Gráfico dos últimos 30 dias (do dia -29 até hoje, sempre em data local)
  const mapa30d = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    mapa30d.set(deslocarDiaLocal(hoje, -i), 0);
  }
  for (const mov of movimentosMemoria) {
    if (mov.direction !== 'entrada') continue;
    if (mov.origin_type === 'transferencia') continue;
    if (mov.is_reversal || mov.reversed_by_movement_id) continue;
    const dia = extrairDiaLocal(mov.occurred_date);
    if (mapa30d.has(dia)) {
      mapa30d.set(dia, somarCentavos(mapa30d.get(dia) ?? 0, mov.amount_cents));
    }
  }
  const serie30d: DailyReceivedPoint[] = [...mapa30d.entries()].map(([date, amount_cents]) => ({
    date,
    amount_cents,
  }));

  return {
    accounts: clonar(contasAtivas),
    total_accounts_balance_cents: saldoTotalContas,
    pending_machines: pendentesMaq,
    received_today_cents: recebidoHoje,
    received_today_by_method: hojePorForma,
    received_month_cents: recebidoMes,
    received_month_by_method: mesPorForma,
    technician_cash_total_cents: totalDinheiroTecnicos,
    technician_cash_list: listaTecnicos,
    pending_receipts_count: qtdRecebimentosPendentes,
    open_sales_total_cents: resVendas.soma_a_receber_cents,
    open_sales_count: abertasOrdenadas.length,
    open_sales_oldest: vendasAReceberResumo,
    daily_received_30d: serie30d,
  };
}
