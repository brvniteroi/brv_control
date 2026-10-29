import { supabase } from './supabase';
import type { Customer, CustomerAddress, CustomerContact, PersonType } from '../types/fsm';

export interface ClienteCompleto extends Customer {
  contacts: CustomerContact[];
  addresses: CustomerAddress[];
}

export type FiltroStatusCliente = 'ativos' | 'arquivados' | 'todos';

export const CLIENTES_POR_PAGINA = 50;

export interface PaginaClientes {
  itens: Customer[];
  total: number;
}

export type ContatoNovo = Omit<CustomerContact, 'id' | 'customer_id' | 'created_at'>;

export interface EnderecoInput {
  label?: string | null;
  zip_code?: string | null;
  street: string;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  reference?: string | null;
  // Só enviar quando houver coordenada nova; se omitidas, as atuais são mantidas
  latitude?: number | null;
  longitude?: number | null;
}

export interface SalvarClienteInput {
  id?: string;
  name: string;
  trade_name?: string | null;
  person_type: PersonType;
  document?: string | null;
  state_registration?: string | null;
  notes?: string | null;
  active?: boolean;
  /** Só usado na criação; depois os contatos são adicionados/removidos um a um. */
  contacts?: ContatoNovo[];
  address?: EnderecoInput | null;
}

/** Remove o que tem significado na sintaxe do filtro `.or()` do PostgREST. */
function termoSeguro(termo: string): string {
  return termo.replace(/[,()"'\\%_*:]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function listarClientes(
  termo: string,
  filtro: FiltroStatusCliente,
  pagina: number,
): Promise<PaginaClientes> {
  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .order('id', { ascending: true })
    .range(pagina * CLIENTES_POR_PAGINA, (pagina + 1) * CLIENTES_POR_PAGINA - 1);

  if (filtro === 'ativos') query = query.eq('active', true);
  if (filtro === 'arquivados') query = query.eq('active', false);

  const limpo = termoSeguro(termo);
  if (limpo) {
    const condicoes = [
      `name.ilike.%${limpo}%`,
      `trade_name.ilike.%${limpo}%`,
      `email.ilike.%${limpo}%`,
      `phone.ilike.%${limpo}%`,
      `document.ilike.%${limpo}%`,
    ];
    // CPF/CNPJ é guardado sem máscara: "123.456.789-00" deve achar "12345678900"
    const semMascara = limpo.replace(/[.\-/\s]/g, '');
    if (semMascara && semMascara !== limpo) condicoes.push(`document.ilike.%${semMascara}%`);
    query = query.or(condicoes.join(','));
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { itens: (data ?? []) as Customer[], total: count ?? 0 };
}

export async function buscarClientePorId(id: string): Promise<ClienteCompleto | null> {
  const { data: customer, error: errCustomer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single();

  if (errCustomer || !customer) {
    console.error('Erro ao buscar cliente:', errCustomer);
    return null;
  }

  const [{ data: contacts }, { data: addresses }] = await Promise.all([
    supabase
      .from('customer_contacts')
      .select('*')
      .eq('customer_id', id)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true }),
    supabase
      .from('customer_addresses')
      .select('*')
      .eq('customer_id', id)
      .order('is_primary', { ascending: false }),
  ]);

  return {
    ...(customer as Customer),
    contacts: (contacts || []) as CustomerContact[],
    addresses: (addresses || []) as CustomerAddress[],
  };
}

/**
 * Cria ou atualiza o cliente, o endereço principal e (na criação) os contatos,
 * tudo numa transação no banco (função `salvar_cliente`). Devolve o id do cliente.
 */
export async function salvarCliente(dados: SalvarClienteInput): Promise<string> {
  const { data, error } = await supabase.rpc('salvar_cliente', {
    p_id: dados.id ?? null,
    p_cliente: {
      name: dados.name,
      trade_name: dados.trade_name ?? null,
      person_type: dados.person_type,
      document: dados.document ?? null,
      state_registration: dados.state_registration ?? null,
      notes: dados.notes ?? null,
      active: dados.active ?? true,
    },
    p_endereco: dados.address ?? null,
    p_contatos: dados.id ? null : (dados.contacts ?? []),
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function alternarStatusCliente(id: string, novoStatus: boolean): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({ active: novoStatus })
    .eq('id', id);
  if (error) throw error;
}

/** O banco cuida do "principal": marcar um novo rebaixa o anterior. */
export async function adicionarContato(customerId: string, contato: ContatoNovo): Promise<CustomerContact> {
  const { data, error } = await supabase
    .from('customer_contacts')
    .insert({
      customer_id: customerId,
      name: contato.name.trim(),
      role: contato.role?.trim() || null,
      phone: contato.phone?.trim() || null,
      is_whatsapp: contato.is_whatsapp ?? true,
      email: contato.email?.trim() || null,
      is_primary: contato.is_primary ?? false,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as CustomerContact;
}

export async function removerContato(contatoId: string): Promise<void> {
  const { error } = await supabase
    .from('customer_contacts')
    .delete()
    .eq('id', contatoId);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Endereços de atendimento (um cliente pode ter vários)
// ---------------------------------------------------------------------

export interface EnderecoClienteInput extends EnderecoInput {
  label: string | null;
}

/** Cria ou atualiza um endereço. O banco garante um único principal por cliente. */
export async function salvarEnderecoCliente(
  customerId: string,
  endereco: EnderecoClienteInput,
  opcoes: { id?: string; principal?: boolean } = {},
): Promise<string> {
  const { data, error } = await supabase.rpc('salvar_endereco_cliente', {
    p_id: opcoes.id ?? null,
    p_customer_id: customerId,
    p_endereco: endereco,
    p_principal: opcoes.principal ?? false,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function definirEnderecoPrincipal(id: string): Promise<void> {
  const { error } = await supabase.rpc('definir_endereco_principal', { p_id: id });
  if (error) throw new Error(error.message);
}

export async function alternarEnderecoAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from('customer_addresses').update({ active: ativo }).eq('id', id);
  if (error) throw error;
}

/**
 * Exclui o endereço. Se ele já foi usado em OS ou equipamentos (FK RESTRICT),
 * o histórico é preservado e ele é apenas desativado.
 */
export async function removerEndereco(id: string): Promise<'removido' | 'desativado'> {
  const { error } = await supabase.from('customer_addresses').delete().eq('id', id);
  if (!error) return 'removido';
  if (error.code === '23503') {
    await alternarEnderecoAtivo(id, false);
    return 'desativado';
  }
  throw error;
}
