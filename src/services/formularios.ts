import { supabase } from './supabase';
import type { Attachment } from '../types/fsm';
import type {
  FormularioRespondido,
  ModeloFormulario,
  Pergunta,
  Respostas,
  StatusFormulario,
} from '../types/formularios';

// ---------- Modelos (escritório monta; técnico só lê os ativos) ----------

export async function listarModelos(apenasAtivos = false): Promise<ModeloFormulario[]> {
  let query = supabase.from('form_templates').select('*').order('name');
  if (apenasAtivos) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw new Error(`Não foi possível carregar os modelos: ${error.message}`);
  return data as ModeloFormulario[];
}

export interface SalvarModeloInput {
  id?: string;
  name: string;
  description?: string | null;
  questions: Pergunta[];
  active: boolean;
}

export async function salvarModelo(d: SalvarModeloInput): Promise<string> {
  const campos = {
    name: d.name.trim(),
    description: d.description?.trim() || null,
    questions: d.questions,
    active: d.active,
  };
  const consulta = d.id
    ? supabase.from('form_templates').update(campos).eq('id', d.id)
    : supabase.from('form_templates').insert(campos);
  const { data, error } = await consulta.select('id').single();
  if (error) {
    if (error.code === '23505') throw new Error('Já existe um modelo com esse nome');
    throw new Error(`Não foi possível salvar o modelo: ${error.message}`);
  }
  return data.id as string;
}

// ---------- Formulários de uma atividade ----------

export async function listarFormulariosDaAtividade(taskId: string): Promise<FormularioRespondido[]> {
  const { data, error } = await supabase
    .from('form_responses')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at');
  if (error) throw new Error(`Não foi possível carregar os formulários: ${error.message}`);
  return data as FormularioRespondido[];
}

export async function listarFormulariosDaOrdem(serviceOrderId: string): Promise<FormularioRespondido[]> {
  const { data, error } = await supabase
    .from('form_responses')
    .select('*')
    .eq('service_order_id', serviceOrderId)
    .order('created_at');
  if (error) throw new Error(`Não foi possível carregar os formulários: ${error.message}`);
  return data as FormularioRespondido[];
}

export async function buscarFormulario(id: string): Promise<FormularioRespondido | null> {
  const { data, error } = await supabase.from('form_responses').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Não foi possível carregar o formulário: ${error.message}`);
  return data as FormularioRespondido | null;
}

/** Adiciona um formulário (em branco) à atividade. O banco copia as perguntas do modelo. */
export async function abrirFormulario(
  taskId: string,
  templateId: string,
  equipmentId?: string | null,
): Promise<FormularioRespondido> {
  const { data, error } = await supabase
    .from('form_responses')
    .insert({ task_id: taskId, template_id: templateId, equipment_id: equipmentId ?? null })
    .select()
    .single();
  if (error) throw new Error(`Não foi possível abrir o formulário: ${error.message}`);
  return data as FormularioRespondido;
}

/** Salva o rascunho (`pendente`) ou conclui (`preenchido`). Valide antes com `validarRespostas`. */
export async function salvarRespostas(
  id: string,
  answers: Respostas,
  status: StatusFormulario,
): Promise<FormularioRespondido> {
  const { data, error } = await supabase
    .from('form_responses')
    .update({ answers, status })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`Não foi possível salvar o formulário: ${error.message}`);
  return data as FormularioRespondido;
}

/** Só admin (RLS). */
export async function excluirFormulario(id: string): Promise<void> {
  const { error } = await supabase.from('form_responses').delete().eq('id', id);
  if (error) throw new Error(`Não foi possível excluir o formulário: ${error.message}`);
}

/** Fotos/assinaturas citadas nas respostas (ids vindos de `answers`), para exibir na tela. */
export async function buscarAnexosPorIds(ids: string[]): Promise<Attachment[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('attachments').select('*').in('id', ids);
  if (error) throw new Error(`Não foi possível carregar as fotos: ${error.message}`);
  return data as Attachment[];
}
