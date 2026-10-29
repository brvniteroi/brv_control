// Fotos de campo: compacta no aparelho, envia para a HostGator
// (hostgator-api/upload.php) e registra os metadados em public.attachments.

import { supabase } from './supabase';
import type { Attachment, AttachmentCategory, UploadResult } from '../types/fsm';

const UPLOAD_URL = import.meta.env.VITE_UPLOAD_URL;

const LADO_MAXIMO_PX = 1600;
const QUALIDADE = 0.8;

/**
 * Reduz para no máximo 1600 px no maior lado e recodifica em WEBP (JPEG onde o
 * navegador não gera WEBP, ex.: Safari). Uma foto de 4 MB do celular vira ~250 KB.
 * Recodificar também descarta o EXIF (inclusive a localização GPS do aparelho).
 */
export async function compactarImagem(arquivo: File): Promise<File> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  const escala = Math.min(1, LADO_MAXIMO_PX / Math.max(bitmap.width, bitmap.height));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este navegador não consegue processar imagens');

  // Fundo branco: PNG transparente não fica preto quando cai no JPEG
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const gerar = (tipo: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, tipo, QUALIDADE));

  let blob = await gerar('image/webp');
  if (!blob || blob.type !== 'image/webp') blob = await gerar('image/jpeg');
  if (!blob) throw new Error('Não foi possível compactar a imagem');

  const extensao = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const nomeBase = arquivo.name.replace(/\.[^.]+$/, '') || 'foto';
  return new File([blob], `${nomeBase}.${extensao}`, { type: blob.type });
}

/** Envia o arquivo (já compactado) para a HostGator usando o login atual. */
export async function enviarParaHostgator(arquivo: File): Promise<UploadResult> {
  if (!UPLOAD_URL) throw new Error('Configure VITE_UPLOAD_URL no arquivo .env');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessão expirada. Entre novamente.');

  const corpo = new FormData();
  corpo.append('arquivo', arquivo);

  const resposta = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: corpo,
  });
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new Error(dados?.error || `Falha no envio da foto (HTTP ${resposta.status})`);
  }
  return dados as UploadResult;
}

export interface DestinoAnexo {
  serviceOrderId?: string;
  taskId?: string;
  equipmentId?: string;
  category?: AttachmentCategory;
  caption?: string;
}

/** Fluxo completo usado pelas telas: compactar -> enviar -> registrar na OS. */
export async function anexarFoto(arquivo: File, destino: DestinoAnexo): Promise<Attachment> {
  const compactada = await compactarImagem(arquivo);
  const enviado = await enviarParaHostgator(compactada);

  const { data, error } = await supabase
    .from('attachments')
    .insert({
      ...enviado,
      storage: 'hostgator',
      service_order_id: destino.serviceOrderId ?? null,
      task_id: destino.taskId ?? null,
      equipment_id: destino.equipmentId ?? null,
      category: destino.category ?? 'outros',
      caption: destino.caption ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Foto enviada, mas não foi registrada na OS: ${error.message}`);
  return data as Attachment;
}
