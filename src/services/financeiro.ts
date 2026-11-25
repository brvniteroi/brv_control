// Cadastros do financeiro no Supabase (migration 20261125110000_vendas_financeiro_base.sql).
// Ler contas, maquininhas e categorias: nível "caixa" ou "completo" (saldo só no completo), pelas funções financeiro_*.
// Cadastrar e alterar: só o nível completo (RLS). Cadastro não se exclui, só se desativa.
// Caixa da loja, recebimentos dos técnicos e extrato ainda estão na demonstração (parte 3).

import { supabase } from './supabase';
import type {
  CardMachine,
  FinancialAccount,
  FinancialCategory,
  SaveCardMachineInput,
  SaveFinancialAccountInput,
  SaveFinancialCategoryInput,
  SaveSupplierInput,
  Supplier,
} from '../types/financeiro';

function falhou(error: { message: string; code?: string } | null): void {
  if (!error) return;
  if (error.code === '23505') throw new Error('Já existe um cadastro com este nome.');
  if (error.message.includes('row-level security') || error.message.includes('permission denied')) {
    throw new Error('Só o acesso financeiro completo altera os cadastros.');
  }
  throw new Error(error.message);
}

/** Grava (insere ou altera) e confere se alguma linha foi mesmo alterada: sem permissão, a RLS não dá erro no UPDATE. */
async function gravar(tabela: string, id: string | undefined, campos: Record<string, unknown>): Promise<string> {
  const consulta = id
    ? supabase.from(tabela).update(campos).eq('id', id).select('id')
    : supabase.from(tabela).insert(campos).select('id');
  const { data, error } = await consulta;
  falhou(error);
  const salvo = data?.[0]?.id as string | undefined;
  if (!salvo) throw new Error('Só o acesso financeiro completo altera os cadastros.');
  return salvo;
}

export async function listarContas(): Promise<FinancialAccount[]> {
  const { data, error } = await supabase.rpc('financeiro_contas');
  falhou(error);
  return (data ?? []) as FinancialAccount[];
}

export async function salvarConta(dados: SaveFinancialAccountInput): Promise<FinancialAccount> {
  const nome = dados.name.trim();
  if (!nome) throw new Error('Informe o nome da conta.');
  const id = await gravar('financial_accounts', dados.id, {
    name: nome,
    kind: dados.kind,
    initial_balance_cents: Math.round(dados.initial_balance_cents),
    active: dados.active,
  });
  const conta = (await listarContas()).find((c) => c.id === id);
  if (!conta) throw new Error('Conta não encontrada depois de salvar.');
  return conta;
}

export async function listarMaquininhas(): Promise<CardMachine[]> {
  const { data, error } = await supabase.rpc('financeiro_maquininhas');
  falhou(error);
  return ((data ?? []) as CardMachine[]).map((m) => ({
    ...m,
    debit_fee_percent: Number(m.debit_fee_percent),
    credit_sight_fee_percent: Number(m.credit_sight_fee_percent),
  }));
}

export async function salvarMaquininha(dados: SaveCardMachineInput): Promise<CardMachine> {
  const nome = dados.name.trim();
  if (!nome) throw new Error('Informe o nome da maquininha.');
  if (!dados.settlement_account_id) throw new Error('Escolha a conta em que o dinheiro cai.');
  const id = await gravar('card_machines', dados.id, {
    name: nome,
    settlement_account_id: dados.settlement_account_id,
    settlement_business_days: dados.settlement_business_days,
    debit_fee_percent: dados.debit_fee_percent,
    credit_sight_fee_percent: dados.credit_sight_fee_percent,
    credit_installment_rates: dados.credit_installment_rates,
    active: dados.active,
  });
  const maquininha = (await listarMaquininhas()).find((m) => m.id === id);
  if (!maquininha) throw new Error('Maquininha não encontrada depois de salvar.');
  return maquininha;
}

export async function listarCategorias(): Promise<FinancialCategory[]> {
  const { data, error } = await supabase.rpc('financeiro_categorias');
  falhou(error);
  return (data ?? []) as FinancialCategory[];
}

export async function salvarCategoria(dados: SaveFinancialCategoryInput): Promise<FinancialCategory> {
  const nome = dados.name.trim();
  if (!nome) throw new Error('Informe o nome da categoria.');
  const id = await gravar('financial_categories', dados.id, { name: nome, kind: dados.kind, active: dados.active });
  return { id, name: nome, kind: dados.kind, active: dados.active };
}

const COLUNAS_FORNECEDOR = 'id, name, person_type, document, phone, email, active';

export async function listarFornecedores(): Promise<Supplier[]> {
  const { data, error } = await supabase.from('suppliers').select(COLUNAS_FORNECEDOR).order('name').limit(1000);
  falhou(error);
  return (data ?? []) as Supplier[];
}

export async function salvarFornecedor(dados: SaveSupplierInput): Promise<Supplier> {
  const nome = dados.name.trim();
  if (!nome) throw new Error('Informe o nome do fornecedor.');
  const campos = {
    name: nome,
    person_type: dados.person_type,
    document: dados.document?.trim() || null,
    phone: dados.phone?.trim() || null,
    email: dados.email?.trim() || null,
    active: dados.active,
  };
  const id = await gravar('suppliers', dados.id, campos);
  return { id, ...campos };
}
