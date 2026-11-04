// Regras de negócio, cálculos de datas/periodicidade e formatadores visuais do módulo PMOC.

import type { CustomerAddress } from '../../types/fsm';
import type {
  PmocAddressSnapshot,
  PmocDisplayStatus,
  PmocEquipmentMonthExecution,
  PmocEquipmentTask,
  PmocMeasurementKey,
  PmocPeriodicity,
  PmocPlanBaseStatus,
  PmocRegistrationType,
  PmocVisitCellStatus,
} from '../../types/pmoc';
import { formatarData } from '../../utils/ordens';

export const PERIODICIDADES_PMOC: readonly {
  valor: PmocPeriodicity;
  rotulo: string;
  passoMeses: number;
}[] = [
  { valor: 'mensal', rotulo: 'Mensal', passoMeses: 1 },
  { valor: 'bimestral', rotulo: 'Bimestral', passoMeses: 2 },
  { valor: 'trimestral', rotulo: 'Trimestral', passoMeses: 3 },
  { valor: 'semestral', rotulo: 'Semestral', passoMeses: 6 },
  { valor: 'anual', rotulo: 'Anual', passoMeses: 12 },
];

export const CAMPOS_MEDICAO_PMOC: readonly {
  chave: PmocMeasurementKey;
  rotulo: string;
  rotuloCurto: string;
  unidade: string;
}[] = [
  {
    chave: 'current_a',
    rotulo: 'Corrente elétrica ventilador/compressor (A)',
    rotuloCurto: 'Corrente (A)',
    unidade: 'A',
  },
  {
    chave: 'temp_supply_c',
    rotulo: 'Temperatura de insuflamento (°C)',
    rotuloCurto: 'T. insuflamento (°C)',
    unidade: '°C',
  },
  {
    chave: 'temp_return_c',
    rotulo: 'Temperatura de retorno (°C)',
    rotuloCurto: 'T. retorno (°C)',
    unidade: '°C',
  },
  {
    chave: 'temp_ambient_c',
    rotulo: 'Temperatura ambiente (°C)',
    rotuloCurto: 'T. ambiente (°C)',
    unidade: '°C',
  },
];

export const TIPOS_EQUIPAMENTO_SUGERIDOS: readonly string[] = [
  'Split Hi-Wall',
  'Cassete',
  'Split Piso-Teto',
  'VRF',
  'Chiller',
  'Janela',
  'Cortina de Ar',
];

const NOMES_MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

const NOMES_MESES_CURTOS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

const fmtMilhar = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const fmtArea = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const fmtMedicao = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Rótulo curto do termo de responsabilidade conforme o conselho escolhido (`TRT` ou `ART`). */
export function rotuloTermoResponsabilidade(tipo: PmocRegistrationType): 'TRT' | 'ART' {
  return tipo === 'CFT' ? 'TRT' : 'ART';
}

/** Nome por extenso do termo de responsabilidade para o título do anexo no documento. */
export function nomeExtensoTermoResponsabilidade(tipo: PmocRegistrationType): string {
  return tipo === 'CFT'
    ? 'TERMO DE RESPONSABILIDADE TÉCNICA'
    : 'ANOTAÇÃO DE RESPONSABILIDADE TÉCNICA';
}

/** Rótulo amigável de uma periodicidade. */
export function rotuloPeriodicidade(periodicidade: PmocPeriodicity): string {
  return PERIODICIDADES_PMOC.find((p) => p.valor === periodicidade)?.rotulo ?? periodicidade;
}

/** Intervalo em meses de uma periodicidade. */
export function passoPeriodicidade(periodicidade: PmocPeriodicity): number {
  return PERIODICIDADES_PMOC.find((p) => p.valor === periodicidade)?.passoMeses ?? 1;
}

/** Data local atual no formato `YYYY-MM-DD`. */
export function hojeLocalIso(): string {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/** Ano e mês local atual no formato `YYYY-MM`. */
export function mesAtualLocal(): string {
  return hojeLocalIso().slice(0, 7);
}

/** Formata uma data `YYYY-MM-DD` usando `formatarData` de `utils/ordens.ts` sem deslocar fuso. */
export function formatarDataIsoCurta(dataIso: string | null | undefined): string {
  if (!dataIso) return '—';
  const base = dataIso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(base)) {
    return formatarData(`${base}T12:00:00`);
  }
  return formatarData(dataIso);
}

/** Sugere a data de término da vigência: `início + 12 meses menos 1 dia` (`YYYY-MM-DD`). */
export function sugerirFimVigencia(inicioIso: string): string {
  const limpo = inicioIso.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(limpo)) return '';
  const [ano, mes, dia] = limpo.split('-').map(Number);
  // Dia 0 do mês ou dia (dia - 1) após somar 12 meses no calendário local
  const data = new Date(ano + 1, mes - 1, dia);
  data.setDate(data.getDate() - 1);
  const a = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const d = String(data.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

export interface InfoSituacaoPlano {
  situacao: PmocDisplayStatus;
  diasParaVencer: number | null;
  rotulo: string;
  classeSelo: string;
}

/** Calcula a situação visual do plano considerando a data de término (alerta até 60 dias). */
export function calcularSituacaoPlano(
  statusBase: PmocPlanBaseStatus,
  endDate: string,
  referenciaHojeIso: string = hojeLocalIso(),
): InfoSituacaoPlano {
  if (statusBase === 'rascunho') {
    return {
      situacao: 'rascunho',
      diasParaVencer: null,
      rotulo: 'Rascunho',
      classeSelo: 'border-slate-200 bg-slate-100 text-slate-700',
    };
  }

  if (statusBase === 'encerrado') {
    return {
      situacao: 'encerrado',
      diasParaVencer: null,
      rotulo: 'Encerrado',
      classeSelo: 'border-slate-700 bg-slate-800 text-white',
    };
  }

  const fimLimpo = endDate.trim().slice(0, 10);
  const hojeLimpo = referenciaHojeIso.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fimLimpo) || !/^\d{4}-\d{2}-\d{2}$/.test(hojeLimpo)) {
    return {
      situacao: 'vigente',
      diasParaVencer: null,
      rotulo: 'Vigente',
      classeSelo: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }

  const [af, mf, df] = fimLimpo.split('-').map(Number);
  const [ah, mh, dh] = hojeLimpo.split('-').map(Number);
  const msPorDia = 24 * 60 * 60 * 1000;
  const dias = Math.round((Date.UTC(af, mf - 1, df) - Date.UTC(ah, mh - 1, dh)) / msPorDia);

  if (dias < 0) {
    return {
      situacao: 'vencido',
      diasParaVencer: dias,
      rotulo: 'Vencido',
      classeSelo: 'border-rose-200 bg-rose-50 text-rose-700',
    };
  }

  if (dias <= 60) {
    const rotulo =
      dias === 0 ? 'Vence hoje' : dias === 1 ? 'Vence em 1 dia' : `Vence em ${dias} dias`;
    return {
      situacao: 'vencendo',
      diasParaVencer: dias,
      rotulo,
      classeSelo: 'border-amber-200 bg-amber-50 text-amber-800',
    };
  }

  return {
    situacao: 'vigente',
    diasParaVencer: dias,
    rotulo: 'Vigente',
    classeSelo: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
}

const PREPOSICOES_IGNORADAS = new Set([
  'DE',
  'DA',
  'DO',
  'DAS',
  'DOS',
  'E',
  'EM',
  'NO',
  'NA',
  'NOS',
  'NAS',
  'PARA',
  'COM',
  'A',
  'O',
  'AS',
  'OS',
]);

/** Sugere automaticamente sigla de 2 a 3 letras maiúsculas a partir do nome do ambiente. */
export function sugerirSiglaAmbiente(nome: string): string {
  const limpo = nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .trim();

  if (!limpo) return '';

  const palavras = limpo
    .split(/\s+/)
    .map((p) => p.replace(/[^A-Z]/g, ''))
    .filter((p) => p.length > 0 && !PREPOSICOES_IGNORADAS.has(p));

  if (palavras.length === 0) return '';

  if (palavras.length === 1) {
    const unica = palavras[0];
    if (unica.length >= 2) return unica.slice(0, 2);
    return `${unica}X`;
  }

  const iniciais = palavras.slice(0, 3).map((p) => p[0]).join('');
  return iniciais.length >= 2 ? iniciais : `${iniciais}X`;
}

/** Normaliza texto digitado no campo Sigla (apenas letras maiúsculas sem acento, até 3). */
export function normalizarSiglaAmbiente(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3);
}

/** Verifica se o identificador segue o padrão gerado automaticamente (`AR-XX-0001`). */
export function ehIdentificadorAutomatico(identificador: string): boolean {
  return /^AR-[A-Z]{2,3}-\d{4}$/.test(identificador.trim());
}

/** Gera o próximo identificador único `AR-<SIGLA>-<0001>` para uma sigla dentro do plano. */
export function gerarProximoIdentificador(
  sigla: string,
  identificadoresExistentes: string[],
  ignorarIdentificadorAtual?: string,
): string {
  const cod = normalizarSiglaAmbiente(sigla) || 'EQ';
  const prefixo = `AR-${cod}-`;
  let maior = 0;

  for (const id of identificadoresExistentes) {
    if (ignorarIdentificadorAtual && id === ignorarIdentificadorAtual) continue;
    const limpo = id.trim().toUpperCase();
    if (limpo.startsWith(prefixo)) {
      const sufixo = Number(limpo.slice(prefixo.length));
      if (Number.isInteger(sufixo) && sufixo > maior) {
        maior = sufixo;
      }
    }
  }

  return `${prefixo}${String(maior + 1).padStart(4, '0')}`;
}

/** Letra do bloco de equipamento no cronograma: 0 -> A, 1 -> B, ..., 25 -> Z, 26 -> AA. */
export function letraEquipamento(indice: number): string {
  let n = indice + 1;
  let resultado = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    resultado = String.fromCharCode(65 + resto) + resultado;
    n = Math.floor((n - 1) / 26);
  }
  return resultado || 'A';
}

export interface MesPlanoInfo {
  /** Posição do mês no plano (1 a 12). */
  offset: number;
  /** Ano e mês (`YYYY-MM`). */
  referencia: string;
  /** Nome do mês em português (ex.: `Maio`). */
  nomeMes: string;
  /** Rótulo curto para colunas de grade (ex.: `Mai/26`). */
  rotuloCurto: string;
  /** Rótulo extenso para cabeçalhos de relatório (ex.: `Maio de 2026`). */
  rotuloExtenso: string;
}

/** Gera a lista ordenada dos 12 meses a partir da data de início do plano (`start_date`). */
export function gerarMesesDoPlano(startDate: string): MesPlanoInfo[] {
  const limpo = startDate.trim().slice(0, 10);
  let anoBase = new Date().getFullYear();
  let mesBaseZero = new Date().getMonth();

  if (/^\d{4}-\d{2}-\d{2}$/.test(limpo)) {
    const [a, m] = limpo.split('-').map(Number);
    anoBase = a;
    mesBaseZero = m - 1;
  }

  const resultado: MesPlanoInfo[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(anoBase, mesBaseZero + i, 1);
    const ano = d.getFullYear();
    const mesZero = d.getMonth();
    const referencia = `${ano}-${String(mesZero + 1).padStart(2, '0')}`;
    const nomeMes = NOMES_MESES[mesZero];
    const curtoAno = String(ano).slice(-2);
    resultado.push({
      offset: i + 1,
      referencia,
      nomeMes,
      rotuloCurto: `${NOMES_MESES_CURTOS[mesZero]}/${curtoAno}`,
      rotuloExtenso: `${nomeMes} de ${ano}`,
    });
  }
  return resultado;
}

/** Formata uma referência `YYYY-MM` para exibição amigável (`Agosto de 2026` ou `Ago/26`). */
export function formatarMesReferencia(
  referencia: string | null | undefined,
  curto = false,
): string {
  if (!referencia || !/^\d{4}-\d{2}$/.test(referencia)) return '—';
  const [anoStr, mesStr] = referencia.split('-');
  const idx = Number(mesStr) - 1;
  if (idx < 0 || idx > 11) return referencia;
  if (curto) return `${NOMES_MESES_CURTOS[idx]}/${anoStr.slice(-2)}`;
  return `${NOMES_MESES[idx]} de ${anoStr}`;
}

/** Define se uma tarefa cai em determinado mês relativo (`1..12`) do plano. */
export function tarefaCaiNoMes(
  periodicidade: PmocPeriodicity,
  startMonthOffset: number,
  monthOffset: number,
  ativa = true,
): boolean {
  if (!ativa) return false;
  const inicio = Math.min(12, Math.max(1, Math.trunc(startMonthOffset || 1)));
  if (monthOffset < inicio || monthOffset > 12) return false;
  const passo = passoPeriodicidade(periodicidade);
  return (monthOffset - inicio) % passo === 0;
}

/** Filtra as tarefas ativas de um equipamento previstas para um mês relativo (`1..12`). */
export function tarefasPrevistasNoMes(
  tarefasDoEquipamento: PmocEquipmentTask[],
  monthOffset: number,
): PmocEquipmentTask[] {
  return tarefasDoEquipamento
    .filter((t) => tarefaCaiNoMes(t.periodicity, t.start_month_offset, monthOffset, t.active))
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** Determina o estado visual de uma célula (equipamento x mês) na grade de Execução. */
export function calcularEstadoCelulaExecucao(
  qtdTarefasNoMes: number,
  execucao: PmocEquipmentMonthExecution | undefined,
  referenciaMes: string,
  mesAtual: string = mesAtualLocal(),
): PmocVisitCellStatus {
  if (qtdTarefasNoMes === 0) return 'nao_se_aplica';
  if (execucao?.status === 'concluida') return 'concluida';
  if (execucao?.status === 'nao_atendido') return 'atrasada';
  if (referenciaMes < mesAtual) return 'atrasada';
  return 'prevista';
}

export const ESTILOS_CELULA_EXECUCAO: Record<
  PmocVisitCellStatus,
  { rotulo: string; rotuloCurto: string; classe: string }
> = {
  prevista: {
    rotulo: 'Prevista',
    rotuloCurto: 'Prevista',
    classe: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
  },
  concluida: {
    rotulo: 'Concluída',
    rotuloCurto: 'Concluída',
    classe: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
  },
  atrasada: {
    rotulo: 'Atrasada',
    rotuloCurto: 'Atrasada',
    classe: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
  },
  nao_se_aplica: {
    rotulo: 'Não se aplica',
    rotuloCurto: 'N/A',
    classe: 'border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200/70',
  },
};

/** Formata capacidade térmica com separador de milhar (`12.000 BTUs`). */
export function formatarBtus(btu: number | null | undefined, incluirUnidade = true): string {
  if (btu === null || btu === undefined || Number.isNaN(btu) || btu <= 0) return '—';
  const num = fmtMilhar.format(Math.round(btu));
  return incluirUnidade ? `${num} BTUs` : num;
}

/** Formata área em m² com vírgula decimal (`15,5 m²`). */
export function formatarAreaM2(area: number | null | undefined, incluirUnidade = true): string {
  if (area === null || area === undefined || Number.isNaN(area)) return '—';
  const txt = fmtArea.format(area);
  return incluirUnidade ? `${txt} m²` : txt;
}

/** Formata número de medição com uma casa decimal e vírgula (`5,4 A`, `11,2 °C`). */
export function formatarMedicao(valor: number | null | undefined, unidade?: string): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  const txt = fmtMedicao.format(valor);
  return unidade ? `${txt} ${unidade}` : txt;
}

/** Converte texto digitado com vírgula ou ponto (`"15,5"`) para número decimal. */
export function lerNumeroDecimal(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, '').replace(',', '.');
  if (!limpo) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/** Converte `CustomerAddress` do cadastro de clientes em `PmocAddressSnapshot`. */
export function criarSnapshotEndereco(e: CustomerAddress): PmocAddressSnapshot {
  return {
    label: e.label,
    street: e.street,
    number: e.number,
    complement: e.complement,
    district: e.district,
    city: e.city,
    state: e.state,
    zip_code: e.zip_code,
  };
}

/** Formata o endereço resumido para tabela/cartões na listagem. */
export function formatarEnderecoResumo(e: PmocAddressSnapshot | null | undefined): string {
  if (!e) return 'Sem endereço definido';
  const via = [e.street, e.number].filter(Boolean).join(', ');
  const bairroCidade = [e.district, e.city ? `${e.city}/${e.state}` : '']
    .filter(Boolean)
    .join(' · ');
  return [via, bairroCidade].filter(Boolean).join(' — ') || 'Sem endereço definido';
}

/** Formata o endereço completo para impressão na Seção 1 do documento PMOC. */
export function formatarEnderecoDocumento(e: PmocAddressSnapshot | null | undefined): string {
  if (!e) return '—';
  const partes = [
    [e.street, e.number].filter(Boolean).join(', '),
    e.district,
    [e.city, e.state].filter(Boolean).join(' - '),
    e.zip_code ? `CEP ${e.zip_code}` : null,
  ].filter(Boolean);
  return partes.join(', ') || '—';
}

