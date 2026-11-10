// Etiqueta da placa na Elgin L42PRO (203 dpi = 8 pontos por mm), mesmo esquema da etiqueta da Oficina
// (utils/etiquetaOficina.ts): o agente da loja ajusta margem, passo do rolo e cópias antes de imprimir.
// Layout herdado do sistema antigo (zpl_bridge.php, "BRV NITEROI - PLACAS"): cliente, telefone, equipamento,
// modelo, código da placa e defeito, com o QR que abre a placa no Control.
import type { BoardOrder } from '../types/placas';
import { URL_SISTEMA, textoZpl, type LarguraEtiqueta } from './etiquetaOficina';

export const CABECALHO_ETIQUETA_PLACA = 'BRV NITEROI - PLACAS';

/** ZPL da etiqueta 100x50 mm (ou 80x50). Coordenadas em pontos (8/mm). */
export function gerarZplPlaca(placa: BoardOrder, opcoes: { largura?: LarguraEtiqueta; copias?: number } = {}): string {
  const largura = opcoes.largura ?? 100;
  const copias = Math.min(10, Math.max(1, Math.round(opcoes.copias ?? 1)));
  const pw = largura * 8;                 // 800 ou 640
  const util = pw - 48;                   // margem esquerda 24 + direita 24
  const qrX = pw - 24 - 136;              // QR ~17 mm encostado à direita
  const maxValor = largura === 100 ? 27 : 18;
  const entrada = new Date(placa.created_at).toLocaleDateString('pt-BR');
  const qr = `${URL_SISTEMA}/placas?placa=${placa.id}`;

  const linhas: string[] = [
    '^XA',
    '^CI28',
    `^PW${pw}`,
    '^LL400',
    '^LH0,0',
    '^PR2',
    `^FO24,18^A0N,30,30^FD${textoZpl(CABECALHO_ETIQUETA_PLACA, largura === 100 ? 24 : 14)}^FS`,
    // Tarja preta com o número da placa (texto invertido)
    `^FO${pw - 24 - 280},10^GB280,52,52^FS`,
    `^FO${pw - 24 - 270},22^A0N,30,30^FR^FD${textoZpl(placa.board_number, 14)}^FS`,
    `^FO24,70^GB${util},3,3^FS`,
  ];

  const campos: [string, string][] = [
    ['Cliente', placa.customer_name],
    ['Tel.', placa.customer_phone ?? ''],
    ['Equip.', placa.equipment_type],
    ['Modelo', placa.brand_model],
    ['Placa', placa.board_code],
    ['Defeito', placa.reported_defect],
  ];
  campos.forEach(([rotulo, valor], i) => {
    const y = 82 + i * 32;
    const ultimo = i === campos.length - 1;
    linhas.push(`^FO24,${y}^A0N,22,22^FD${rotulo}^FS`);
    linhas.push(`^FO150,${y}^A0N,${ultimo ? 20 : 24},${ultimo ? 20 : 24}^FD${textoZpl(valor, maxValor)}^FS`);
  });

  linhas.push(`^FO${qrX},80^BQN,2,3^FDLA,${qr}^FS`);

  linhas.push(`^FO24,282^GB${util},2,2^FS`);
  linhas.push(`^FO24,296^A0N,22,22^FDEntrada ${textoZpl(entrada, 10)}${placa.is_warranty ? '   GARANTIA' : ''}^FS`);
  linhas.push(`^FO${pw - 24 - 150},298^A0N,20,20^FDBRV PLACAS^FS`);
  linhas.push(`^PQ${copias}`);
  linhas.push('^XZ');
  return linhas.join('\r\n') + '\r\n';
}
