// Etiqueta do aparelho do PMOC na Elgin L42PRO (203 dpi = 8 pontos por mm), mesmo rolo da Oficina (100 x 50 mm; decisão 9 do plano).
// O QR leva à página pública do aparelho (/equipamento/<token>). O QR sai pela própria impressora (^BQ): não precisa de biblioteca.
import { EMPRESA_ETIQUETA, URL_SISTEMA, textoZpl } from './etiquetaOficina';

export interface DadosEtiquetaPmoc {
  identificador: string;     // AR-SR-0001
  cliente: string;
  ambiente: string;
  equipamento: string;       // tipo + BTU
  plano: string;             // PMOC-2026-0001
  token: string;             // equipments.public_token
}

export function linkEquipamentoPmoc(token: string): string {
  return `${URL_SISTEMA}/equipamento/${token}`;
}

/** ZPL da etiqueta 100 x 50 mm. Coordenadas em pontos (8/mm); QR ~17 mm à direita. */
export function gerarZplEtiquetaPmoc(d: DadosEtiquetaPmoc, copias = 1): string {
  const qtd = Math.min(10, Math.max(1, Math.round(copias)));
  const pw = 800;
  const util = pw - 48;
  const qrX = pw - 24 - 150;
  return [
    '^XA',
    '^CI28',
    `^PW${pw}`,
    '^LL400',
    '^LH0,0',
    '^PR2',
    `^FO24,18^A0N,32,32^FD${textoZpl(EMPRESA_ETIQUETA, 22)}^FS`,
    // Tarja preta com "PMOC" (texto invertido)
    `^FO${pw - 24 - 200},10^GB200,52,52^FS`,
    `^FO${pw - 24 - 150},20^A0N,34,34^FR^FDPMOC^FS`,
    `^FO24,70^GB${util},3,3^FS`,
    // Identificador grande: é o que o técnico lê de longe
    `^FO24,90^A0N,64,64^FD${textoZpl(d.identificador, 14)}^FS`,
    `^FO24,170^A0N,28,28^FD${textoZpl(d.ambiente || '-', 28)}^FS`,
    `^FO24,208^A0N,24,24^FD${textoZpl(d.equipamento, 30)}^FS`,
    `^FO24,242^A0N,22,22^FD${textoZpl(d.cliente, 30)}^FS`,
    // QR (nível de correção L, ampliação 5 = ~25 mm de lado não cabe: 4 = ~20 mm)
    `^FO${qrX},92^BQN,2,4^FDLA,${linkEquipamentoPmoc(d.token)}^FS`,
    `^FO24,282^GB${util},2,2^FS`,
    `^FO24,298^A0N,22,22^FDManutencao preventiva PMOC ${textoZpl(d.plano, 16)}^FS`,
    `^FO24,330^A0N,20,20^FDLeia o QR Code para ver o historico de manutencoes^FS`,
    `^PQ${qtd}`,
    '^XZ',
  ].join('\r\n') + '\r\n';
}
