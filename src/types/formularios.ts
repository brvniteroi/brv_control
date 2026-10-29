// Formulários de campo. O formato das perguntas está documentado na migration
// supabase/migrations/20261029160000_formularios.sql.

export type TipoPergunta =
  | 'text'
  | 'textarea'
  | 'number'
  | 'single'
  | 'dropdown'
  | 'multi'
  | 'date'
  | 'photo'
  | 'signature';

export interface Pergunta {
  /** Chave estável (não muda ao editar o título); única dentro do formulário. */
  id: string;
  type: TipoPergunta;
  title: string;
  help?: string;
  required?: boolean;
  /** Só para single, dropdown e multi. */
  options?: string[];
  /** Só para number (ex.: "°C", "psi"). */
  unit?: string;
  /** Mostra a pergunta só se a resposta da outra pergunta for uma das opções de `in`. */
  visible_if?: { question: string; in: string[] };
}

/**
 * text/textarea/date -> string; number -> number; single/dropdown -> string;
 * multi -> string[]; photo -> string[] (attachments.id); signature -> string (attachments.id)
 */
export type Resposta = string | number | string[] | null;
export type Respostas = Record<string, Resposta>;

export interface ModeloFormulario {
  id: string;
  name: string;
  description: string | null;
  questions: Pergunta[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type StatusFormulario = 'pendente' | 'preenchido';

export interface FormularioRespondido {
  id: string;
  template_id: string | null;
  template_name: string;
  questions: Pergunta[];
  answers: Respostas;
  status: StatusFormulario;
  task_id: string;
  service_order_id: string;
  equipment_id: string | null;
  filled_by: string | null;
  filled_at: string | null;
  created_at: string;
  updated_at: string;
}
