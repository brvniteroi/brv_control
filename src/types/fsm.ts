// Tipos do banco. Espelham supabase/migrations: ao mudar uma coluna lá,
// atualize aqui (ou gere com `supabase gen types typescript`).

/** 'oficina' = técnico de bancada (só o menu Oficina); 'impressora' = agente da Elgin no servidor da loja (sem telas). */
export type ProfileRole = 'admin' | 'escritorio' | 'tecnico' | 'cliente' | 'oficina' | 'impressora';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: ProfileRole;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type PersonType = 'PF' | 'PJ';

export interface Customer {
  id: string;
  person_type: PersonType;
  name: string;
  trade_name: string | null;
  document: string | null;
  state_registration: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
  field_control_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Etiqueta de OS (catálogo `tags`, ligada pelos `service_order_tags`). Ex.: "Aguardando pagamento". */
export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface CustomerContact {
  id: string;
  customer_id: string;
  name: string;
  role: string | null;
  phone: string | null;
  is_whatsapp: boolean;
  email: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  label: string | null;
  zip_code: string | null;
  street: string;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string;
  state: string;
  reference: string | null;
  latitude: number | null;
  longitude: number | null;
  is_primary: boolean;
  active: boolean;
  field_control_id: string | null;
  created_at: string;
  updated_at: string;
}

export type EmployeeRole = 'tecnico' | 'auxiliar' | 'supervisor' | 'administrativo' | 'oficina';

export interface Employee {
  id: string;
  profile_id: string | null;
  name: string;
  role: EmployeeRole;
  phone: string | null;
  email: string | null;
  timeline_color: string;
  active: boolean;
  field_control_id: string | null;
  /** Cargo do cadastro de cargos; `role` é copiado da categoria dele (trigger no banco). */
  cargo_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Cargo (cadastro livre); a categoria diz ao sistema quem atende em campo. */
export interface Cargo {
  id: string;
  nome: string;
  categoria: EmployeeRole;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

/** Dados pessoais do funcionário (LGPD): só o admin lê e altera. */
export interface FuncionarioDados {
  employee_id: string;
  cpf: string | null;
  rg: string | null;
  rg_orgao: string | null;
  data_nascimento: string | null;
  ctps_numero: string | null;
  ctps_serie: string | null;
  ctps_uf: string | null;
  pis: string | null;
  data_admissao: string | null;
  registro_profissional: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
}

export interface Equipment {
  id: string;
  customer_id: string;
  address_id: string | null;
  category: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  capacity_btu: number | null;
  voltage: string | null;
  refrigerant: string | null;
  location: string | null;
  installed_at: string | null;
  warranty_until: string | null;
  qr_code: string | null;
  notes: string | null;
  active: boolean;
  field_control_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceType {
  id: string;
  name: string;
  default_duration_minutes: number | null;
  active: boolean;
  field_control_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ServiceOrderStatus = 'agendada' | 'em_andamento' | 'concluida' | 'cancelada';

export type ServiceOrderPriority = 'baixa' | 'normal' | 'alta' | 'urgente';

export interface ServiceOrder {
  id: string;
  number: number;
  customer_id: string;
  address_id: string | null;
  contact_id: string | null;
  service_type_id: string;
  status: ServiceOrderStatus;
  priority: ServiceOrderPriority;
  description: string | null;
  internal_notes: string | null;
  opened_at: string;
  due_date: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_by: string | null;
  field_control_id: string | null;
  /** Nome de quem criou a OS no Field Control (só nas importadas). */
  field_control_created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceOrderEquipment {
  service_order_id: string;
  equipment_id: string;
  service_performed: string | null;
  created_at: string;
}

export type TaskStatus = 'agendada' | 'em_deslocamento' | 'em_execucao' | 'concluida' | 'cancelada';

export interface Task {
  id: string;
  service_order_id: string;
  employee_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  /** Duração prevista em minutos */
  estimated_minutes: number | null;
  started_at: string | null;
  finished_at: string | null;
  checkin_lat: number | null;
  checkin_lng: number | null;
  checkout_lat: number | null;
  checkout_lng: number | null;
  technician_notes: string | null;
  field_control_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Vídeos só vêm da importação do Field Control (o app de campo envia só fotos). */
export type AttachmentMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4' | 'video/quicktime';

export type AttachmentCategory =
  | 'antes'
  | 'depois'
  | 'placa_equipamento'
  | 'assinatura'
  | 'documento'
  | 'outros';

export interface Attachment {
  id: string;
  service_order_id: string | null;
  task_id: string | null;
  equipment_id: string | null;
  /** Item da oficina (fotos da bancada não aparecem na galeria da OS) */
  workshop_order_id?: string | null;
  /** Etapa do item da oficina quando a foto foi tirada (preenchida pelo banco) */
  workshop_status?: string | null;
  /** 'fieldcontrol' = arquivo ainda no S3 do Field Control (importado), sem mime/tamanho */
  storage: 'hostgator' | 'supabase' | 'fieldcontrol';
  storage_path: string;
  public_url: string;
  file_name: string | null;
  mime_type: AttachmentMime | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  category: AttachmentCategory;
  caption: string | null;
  field_control_id: string | null;
  uploaded_by: string | null;
  created_at: string;
}

/** Resposta de hostgator-api/upload.php */
export interface UploadResult {
  storage_path: string;
  public_url: string;
  mime_type: AttachmentMime;
  size_bytes: number;
  width: number;
  height: number;
  file_name: string | null;
}
