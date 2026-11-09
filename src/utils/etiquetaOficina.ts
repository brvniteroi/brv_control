// Etiqueta do item da oficina na Elgin L42PRO (203 dpi = 8 pontos por mm).
// Um modelo só: dadosEtiqueta() alimenta o ZPL (fila de impressão) e o HTML (contingência
// "imprimir pelo navegador" e pré-visualização). Layout herdado do BRV Equipamentos (zpl_bridge.php).
import type { ItemOficinaTela } from '../types/oficina';
import { ROTULO_UNIDADE_CURTO, numeroItem } from './oficina';

/** Cabeçalho da etiqueta. Fica num lugar só para o futuro multiempresa. */
export const EMPRESA_ETIQUETA = 'BRV CLIMATIZACAO';
export const URL_SISTEMA = 'https://control.brvniteroi.com.br';

export type LarguraEtiqueta = 100 | 80;

export interface DadosEtiqueta {
  numero: string;          // "OS 17300 · item 2"
  cliente: string;
  equipamento: string;     // tipo + marca + modelo
  recolhido: string;       // unidade
  tensao: string;
  tecnico: string;         // quem retirou
  defeito: string;
  entrada: string;         // dd/mm/aaaa
  garantia: boolean;
  qr: string;              // link do item no Control
}

export function dadosEtiqueta(item: ItemOficinaTela, totalNaOs?: number): DadosEtiqueta {
  const data = new Date(item.received_at ?? item.created_at);
  return {
    numero: numeroItem(item, totalNaOs),
    cliente: item.customer_name ?? '',
    equipamento: [item.equipment_type, item.brand, item.model].filter(Boolean).join(' '),
    recolhido: ROTULO_UNIDADE_CURTO[item.units_collected],
    tensao: item.voltage ?? '-',
    tecnico: item.pickup_employee_name ?? 'Balcão',
    defeito: item.reported_defect ?? 'Sem relato',
    entrada: data.toLocaleDateString('pt-BR'),
    garantia: item.is_warranty,
    qr: `${URL_SISTEMA}/oficina?item=${item.id}`,
  };
}

/** Texto seguro para o ZPL: sem acento, sem ^ ~ \ (comandos da linguagem), cortado no tamanho. */
export function textoZpl(s: string, max: number): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .,:;/#|()+*=_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * ZPL da etiqueta 100x50 mm (ou 80x50). Coordenadas em pontos (8/mm).
 * Coluna da esquerda: rótulo; do meio: valor; à direita: QR que abre o item no Control.
 */
export function gerarZpl(d: DadosEtiqueta, opcoes: { largura?: LarguraEtiqueta; copias?: number } = {}): string {
  const largura = opcoes.largura ?? 100;
  const copias = Math.min(10, Math.max(1, Math.round(opcoes.copias ?? 1)));
  const pw = largura * 8;                 // 800 ou 640
  const util = pw - 48;                   // 752 ou 592 (margem esquerda 24 + direita 24)
  const qrX = pw - 24 - 136;              // QR ~17 mm encostado à direita
  const maxValor = largura === 100 ? 27 : 18;

  const linhas: string[] = [
    '^XA',
    '^CI28',
    `^PW${pw}`,
    '^LL400',
    '^LH0,0',
    '^PR2',
    `^FO24,18^A0N,32,32^FD${textoZpl(EMPRESA_ETIQUETA, largura === 100 ? 22 : 14)}^FS`,
    // Tarja preta com o número (texto invertido)
    `^FO${pw - 24 - 280},10^GB280,52,52^FS`,
    // "OS 17300 · item 2" vira "OS 17300-2" para caber na tarja
    `^FO${pw - 24 - 270},22^A0N,30,30^FR^FD${textoZpl(d.numero.replace(' · item ', '-'), 13)}^FS`,
    `^FO24,70^GB${util},3,3^FS`,
  ];

  const campos: [string, string][] = [
    ['Cliente', d.cliente],
    ['Equip.', d.equipamento],
    ['Recolhido', `${d.recolhido}  ${d.tensao}`],
    ['Retirada', d.tecnico],
    ['Defeito', d.defeito],
  ];
  campos.forEach(([rotulo, valor], i) => {
    const y = 84 + i * 36;
    linhas.push(`^FO24,${y}^A0N,22,22^FD${rotulo}^FS`);
    linhas.push(`^FO150,${y}^A0N,${i === 4 ? 20 : 24},${i === 4 ? 20 : 24}^FD${textoZpl(valor, maxValor)}^FS`);
  });

  // QR (nível de correção L, modo automático), ampliação 3 = ~2 mm por 6 pontos
  linhas.push(`^FO${qrX},80^BQN,2,3^FDLA,${d.qr}^FS`);

  linhas.push(`^FO24,272^GB${util},2,2^FS`);
  linhas.push(`^FO24,288^A0N,22,22^FDEntrada ${textoZpl(d.entrada, 10)}${d.garantia ? '   GARANTIA' : ''}^FS`);
  linhas.push(`^FO${pw - 24 - 150},290^A0N,20,20^FDBRV OFICINA^FS`);
  linhas.push(`^PQ${copias}`);
  linhas.push('^XZ');
  return linhas.join('\r\n') + '\r\n';
}

/** Etiqueta de teste (confere a ligação servidor → Elgin sem precisar de um item). */
export function gerarZplTeste(quem: string): string {
  const agora = new Date().toLocaleString('pt-BR');
  return [
    '^XA', '^CI28', '^PW800', '^LL400', '^LH0,0', '^PR2',
    `^FO24,18^A0N,32,32^FD${EMPRESA_ETIQUETA}^FS`,
    '^FO24,70^GB752,3,3^FS',
    '^FO24,110^A0N,40,40^FDTESTE DE IMPRESSAO^FS',
    `^FO24,170^A0N,24,24^FDPedido por ${textoZpl(quem, 40)}^FS`,
    `^FO24,210^A0N,24,24^FD${textoZpl(agora, 30)}^FS`,
    '^FO24,272^GB752,2,2^FS',
    '^FO24,288^A0N,22,22^FDFila de impressao do BRV Control OK^FS',
    '^PQ1', '^XZ',
  ].join('\r\n') + '\r\n';
}

const escaparHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Página HTML da etiqueta no tamanho do rolo, para imprimir pelo navegador quando o servidor da loja
 * estiver desligado (no Chrome: Margens "Nenhuma"). `paraTela` = só pré-visualização (sem imprimir sozinho).
 */
export function htmlEtiqueta(d: DadosEtiqueta, largura: LarguraEtiqueta = 100, paraTela = false): string {
  const e = (s: string) => escaparHtml(s);
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Etiqueta ${e(d.numero)}</title>
<style>
  @page { size: ${largura}mm 50mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
  html, body { background: #fff; }
  .folha { width: ${largura}mm; height: 47.5mm; padding: 2mm 3mm 1.5mm 3mm; display: flex; flex-direction: column; overflow: hidden; }
  .topo { display: flex; justify-content: space-between; align-items: center; border-bottom: 0.8mm solid #000; padding-bottom: 1mm; }
  .topo b { font-size: 12pt; font-weight: 900; }
  .num { background: #000; color: #fff !important; font-weight: 900; font-size: 12pt; padding: 0.5mm 2mm; border-radius: 1mm; white-space: nowrap;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .meio { flex: 1; display: flex; gap: 2mm; padding-top: 1mm; }
  .campos { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-evenly; font-size: 9.5pt; }
  .campos div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .qr { width: 17mm; height: 17mm; border: 0.3mm dashed #555; font-size: 7pt; display: flex; align-items: center; justify-content: center; align-self: center; }
  .rodape { display: flex; justify-content: space-between; border-top: 0.5mm solid #000; padding-top: 0.8mm; font-size: 8.5pt; }
</style></head>
<body>
  <div class="folha">
    <div class="topo"><b>${e(EMPRESA_ETIQUETA.replace('CLIMATIZACAO', 'CLIMATIZAÇÃO'))}</b><span class="num">${e(d.numero)}</span></div>
    <div class="meio">
      <div class="campos">
        <div><b>Cliente:</b> ${e(d.cliente)}</div>
        <div><b>Equip.:</b> ${e(d.equipamento)}</div>
        <div><b>Recolhido:</b> ${e(d.recolhido)} &nbsp; <b>Tensão:</b> ${e(d.tensao)}</div>
        <div><b>Retirada:</b> ${e(d.tecnico)}</div>
        <div><b>Defeito:</b> ${e(d.defeito)}</div>
      </div>
      <div class="qr">QR</div>
    </div>
    <div class="rodape"><span>Entrada ${e(d.entrada)}${d.garantia ? ' · <b>GARANTIA</b>' : ''}</span><span>BRV OFICINA</span></div>
  </div>
  ${paraTela ? '' : '<script>window.addEventListener("load",function(){setTimeout(function(){window.focus();window.print();},300);});</script>'}
</body></html>`;
}

/**
 * Contingência: imprime a etiqueta pelo navegador. Chamar direto no clique (o celular bloqueia
 * janela aberta depois de um await). No computador usa um iframe escondido; no celular, aba nova.
 */
export function imprimirPeloNavegador(d: DadosEtiqueta, largura: LarguraEtiqueta = 100): void {
  const html = htmlEtiqueta(d, largura);
  const celular = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (celular) {
    const janela = window.open('', '_blank');
    if (!janela) throw new Error('O navegador bloqueou a janela. Permita pop-ups para este site.');
    janela.document.open();
    janela.document.write(html);
    janela.document.close();
    return;
  }
  let frame = document.getElementById('etiqueta-oficina-frame') as HTMLIFrameElement | null;
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = 'etiqueta-oficina-frame';
    Object.assign(frame.style, { position: 'fixed', top: '-9999px', left: '-9999px', border: '0' });
    document.body.appendChild(frame);
  }
  frame.style.width = `${largura}mm`;
  frame.style.height = '50mm';
  const doc = frame.contentWindow?.document;
  if (!doc) throw new Error('Não foi possível preparar a impressão.');
  doc.open();
  doc.write(html);
  doc.close();
}
