// Fila de envio do app de campo. Toda ação do técnico (a caminho, check-in, conclusão, fotos)
// entra aqui primeiro, fica guardada no IndexedDB do aparelho e é enviada em ordem assim que
// houver sinal. Sem sinal, nada se perde: a tela mostra o estado local e os itens pendentes.
import { supabase } from './supabase';
import { enviarParaHostgator, registrarAnexo } from './anexos';
import type { CamposExecucao } from './campo';
import type { AttachmentCategory, UploadResult } from '../types/fsm';

interface ItemBase {
  id: string;
  taskId: string;
  criadoEm: string;
  tentativas: number;
  erro: string | null;
}

export interface ItemAtividade extends ItemBase {
  tipo: 'atividade';
  campos: CamposExecucao;
}

export interface ItemFoto extends ItemBase {
  tipo: 'foto';
  serviceOrderId: string;
  categoria: AttachmentCategory;
  legenda: string | null;
  arquivo: Blob;
  nome: string;
  /** Preenchido quando o arquivo já subiu para a HostGator (falta só registrar na OS). */
  enviado: UploadResult | null;
}

export type ItemFila = ItemAtividade | ItemFoto;

const BANCO = 'brv-campo';
const LOJA = 'fila';
const MAX_TENTATIVAS_AUTOMATICAS = 5;

let bancoAberto: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  bancoAberto ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return bancoAberto;
}

async function operar<T>(modo: IDBTransactionMode, fn: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(LOJA, modo).objectStore(LOJA));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------- Estado em memória + assinantes (useSyncExternalStore) ----------

let itens: ItemFila[] = [];
const assinantes = new Set<() => void>();

function publicar(novos: ItemFila[]) {
  itens = [...novos].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  assinantes.forEach((fn) => fn());
}

export function assinarFila(fn: () => void): () => void {
  assinantes.add(fn);
  return () => assinantes.delete(fn);
}

export const itensFila = () => itens;

async function recarregarDoBanco() {
  publicar(await operar<ItemFila[]>('readonly', (l) => l.getAll() as IDBRequest<ItemFila[]>));
}

async function gravar(item: ItemFila) {
  await operar('readwrite', (l) => l.put(item));
  publicar([...itens.filter((i) => i.id !== item.id), item]);
}

async function remover(id: string) {
  await operar('readwrite', (l) => l.delete(id));
  publicar(itens.filter((i) => i.id !== id));
}

// ---------- API usada pelas telas ----------

const base = (taskId: string): ItemBase => ({
  id: crypto.randomUUID(),
  taskId,
  criadoEm: new Date().toISOString(),
  tentativas: 0,
  erro: null,
});

export async function enfileirarAtividade(taskId: string, campos: CamposExecucao) {
  await gravar({ ...base(taskId), tipo: 'atividade', campos });
  void processarFila();
}

/** A foto já deve vir compactada (compactarImagem). */
export async function enfileirarFoto(
  taskId: string,
  serviceOrderId: string,
  arquivo: File | Blob,
  opcoes: { categoria: AttachmentCategory; legenda?: string | null; nome?: string },
) {
  await gravar({
    ...base(taskId),
    tipo: 'foto',
    serviceOrderId,
    categoria: opcoes.categoria,
    legenda: opcoes.legenda ?? null,
    arquivo,
    nome: opcoes.nome ?? (arquivo instanceof File ? arquivo.name : 'foto.jpg'),
    enviado: null,
  });
  void processarFila();
}

/** Descarta um item que o servidor recusou (ex.: atividade passada para outro técnico). */
export const descartarItem = (id: string) => remover(id);

/** Aplica, em ordem, as alterações ainda não enviadas sobre a versão do servidor. */
export function comPendentes<T extends { id: string }>(registro: T, fila: ItemFila[]): T {
  return fila.reduce<T>(
    (r, item) => (item.tipo === 'atividade' && item.taskId === registro.id ? ({ ...r, ...item.campos } as T) : r),
    registro,
  );
}

// ---------- Envio ----------

function ehErroDeRede(e: unknown): boolean {
  if (!navigator.onLine) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed|timeout/i.test(msg);
}

async function enviar(item: ItemFila) {
  if (item.tipo === 'atividade') {
    const { data, error } = await supabase.from('tasks').update(item.campos).eq('id', item.taskId).select('id');
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error('Esta atividade não está mais com você. Fale com o escritório.');
    return;
  }

  if (!item.enviado) {
    const arquivo = new File([item.arquivo], item.nome, { type: item.arquivo.type || 'image/jpeg' });
    item.enviado = await enviarParaHostgator(arquivo);
    await gravar(item); // se o registro falhar, a próxima tentativa não sobe o arquivo de novo
  }
  await registrarAnexo(item.enviado, {
    serviceOrderId: item.serviceOrderId,
    taskId: item.taskId,
    category: item.categoria,
    caption: item.legenda ?? undefined,
  });
}

let processando = false;
let deNovo = false;

/** Envia a fila em ordem. `forcar` tenta de novo inclusive os que já falharam muitas vezes. */
export async function processarFila(forcar = false): Promise<void> {
  if (processando) {
    deNovo = true;
    return;
  }
  processando = true;
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session || !navigator.onLine) return;

    const tarefasComFalha = new Set<string>();
    for (const item of itens) {
      // Mantém a ordem das ações de uma atividade: se uma falhou, as seguintes esperam
      if (item.tipo === 'atividade' && tarefasComFalha.has(item.taskId)) continue;
      if (!forcar && item.tentativas >= MAX_TENTATIVAS_AUTOMATICAS) {
        if (item.tipo === 'atividade') tarefasComFalha.add(item.taskId);
        continue;
      }
      try {
        await enviar(item);
        await remover(item.id);
      } catch (e) {
        if (ehErroDeRede(e)) break; // sem sinal: tenta tudo de novo mais tarde
        if (item.tipo === 'atividade') tarefasComFalha.add(item.taskId);
        await gravar({ ...item, tentativas: item.tentativas + 1, erro: e instanceof Error ? e.message : String(e) });
      }
    }
  } finally {
    processando = false;
    if (deNovo) {
      deNovo = false;
      void processarFila(forcar);
    }
  }
}

let iniciada = false;

/** Carrega a fila guardada e passa a enviar quando houver sinal. Chamar uma vez (layout do app). */
export function iniciarFila() {
  if (iniciada) return;
  iniciada = true;
  void recarregarDoBanco().then(() => processarFila());
  window.addEventListener('online', () => void processarFila());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void processarFila();
  });
  setInterval(() => {
    if (itens.length > 0) void processarFila();
  }, 30000);
}
