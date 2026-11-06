import { somarMeses } from '../hooks/useCalendario';
import { semAcento } from '../services/clientes';
import type { AtividadeRealizada, AvaliacaoRecebida, ComTipoServico } from '../services/relatorios';
import { dataLocal } from './linhaDoTempo';

/** Limites do mês "AAAA-MM" no fuso local: [inicio, fim), em ISO. */
export function limitesDoMes(mes: string): { inicio: string; fim: string } {
  return {
    inicio: new Date(`${mes}-01T00:00:00`).toISOString(),
    fim: new Date(`${somarMeses(mes, 1)}-01T00:00:00`).toISOString(),
  };
}

/** Dia local (AAAA-MM-DD) em que a atividade foi realizada. */
export function diaDaAtividade(a: AtividadeRealizada): string {
  return dataLocal(new Date((a.finished_at ?? a.scheduled_start)!));
}

export interface Colaborador {
  id: string;
  name: string;
  timeline_color: string;
  active: boolean;
  role: string;
}

export interface LinhaTecnico {
  id: string | null;
  nome: string;
  cor: string | null;
  realizadas: number;
  diasTrabalhados: number;
  /** Atividades por dia trabalhado (dia com ao menos uma atividade concluída). */
  mediaPorDia: number | null;
  mediaEstrelas: number | null;
  avaliacoes: number;
}

export function media(valores: number[]): number | null {
  return valores.length === 0 ? null : valores.reduce((s, v) => s + v, 0) / valores.length;
}

/**
 * Uma linha por técnico ativo, mesmo zerado, mais quem não é técnico ativo mas teve atividade ou avaliação no mês.
 * Atividade sem técnico (só importadas) vira a linha "Sem técnico", no fim.
 */
export function resumirPorTecnico(
  atividades: AtividadeRealizada[],
  avaliacoes: AvaliacaoRecebida[],
  colaboradores: Colaborador[],
): LinhaTecnico[] {
  const diasPorTecnico = new Map<string | null, string[]>();
  for (const a of atividades) {
    const lista = diasPorTecnico.get(a.employee_id) ?? [];
    lista.push(diaDaAtividade(a));
    diasPorTecnico.set(a.employee_id, lista);
  }
  const estrelasPorTecnico = new Map<string | null, number[]>();
  for (const r of avaliacoes) {
    const lista = estrelasPorTecnico.get(r.employee_id) ?? [];
    lista.push(r.stars);
    estrelasPorTecnico.set(r.employee_id, lista);
  }

  const montar = (id: string | null, nome: string, cor: string | null): LinhaTecnico => {
    const dias = diasPorTecnico.get(id) ?? [];
    const estrelas = estrelasPorTecnico.get(id) ?? [];
    const diasTrabalhados = new Set(dias).size;
    return {
      id,
      nome,
      cor,
      realizadas: dias.length,
      diasTrabalhados,
      mediaPorDia: diasTrabalhados > 0 ? dias.length / diasTrabalhados : null,
      mediaEstrelas: media(estrelas),
      avaliacoes: estrelas.length,
    };
  };

  const linhas = colaboradores
    .filter((c) => (c.active && c.role === 'tecnico') || diasPorTecnico.has(c.id) || estrelasPorTecnico.has(c.id))
    .map((c) => montar(c.id, c.name, c.timeline_color))
    .sort((a, b) => b.realizadas - a.realizadas || a.nome.localeCompare(b.nome, 'pt-BR'));

  const semTecnico = montar(null, 'Sem técnico', null);
  return semTecnico.realizadas > 0 || semTecnico.avaliacoes > 0 ? [...linhas, semTecnico] : linhas;
}

export interface LinhaTipo {
  id: string | null;
  nome: string;
  realizadas: number;
  mediaEstrelas: number | null;
  avaliacoes: number;
}

/** Uma linha por tipo com atividade ou avaliação no período, da maior quantidade para a menor; "Sem tipo" vai no fim. */
export function resumirPorTipo(atividades: ComTipoServico[], avaliacoes: (ComTipoServico & { stars: number })[]): LinhaTipo[] {
  const grupos = new Map<string | null, { nome: string; realizadas: number; estrelas: number[] }>();
  const grupoDe = (item: ComTipoServico) => {
    const tipo = item.service_order?.service_type ?? null;
    const chave = tipo?.id ?? null;
    let grupo = grupos.get(chave);
    if (!grupo) {
      grupo = { nome: tipo?.name ?? 'Sem tipo', realizadas: 0, estrelas: [] };
      grupos.set(chave, grupo);
    }
    return grupo;
  };
  for (const a of atividades) grupoDe(a).realizadas += 1;
  for (const r of avaliacoes) grupoDe(r).estrelas.push(r.stars);

  return [...grupos]
    .map(([id, g]) => ({ id, nome: g.nome, realizadas: g.realizadas, mediaEstrelas: media(g.estrelas), avaliacoes: g.estrelas.length }))
    .sort(
      (a, b) =>
        Number(a.id === null) - Number(b.id === null) || b.realizadas - a.realizadas || a.nome.localeCompare(b.nome, 'pt-BR'),
    );
}

export interface LinhaGarantia {
  id: string | null;
  nome: string;
  cor: string | null;
  garantias: number;
  /** Todas as atividades concluídas do técnico no período, de qualquer tipo. */
  atividades: number;
}

export function ehGarantiaBrv(item: ComTipoServico): boolean {
  return semAcento(item.service_order?.service_type?.name.trim() ?? '') === 'garantia brv';
}

/**
 * Técnicos em ordem de garantias atendidas: todos os técnicos ativos, mesmo zerados, mais quem atendeu garantia no
 * período. Garantia sem técnico (só importadas) vira a linha "Sem técnico", no fim.
 */
export function resumirGarantia(
  atividades: (ComTipoServico & { employee_id: string | null })[],
  colaboradores: Colaborador[],
): LinhaGarantia[] {
  const contagem = new Map<string | null, { garantias: number; atividades: number }>();
  for (const a of atividades) {
    const c = contagem.get(a.employee_id) ?? { garantias: 0, atividades: 0 };
    c.atividades += 1;
    if (ehGarantiaBrv(a)) c.garantias += 1;
    contagem.set(a.employee_id, c);
  }

  const linhas = colaboradores
    .filter((c) => (c.active && c.role === 'tecnico') || (contagem.get(c.id)?.garantias ?? 0) > 0)
    .map((c) => ({ id: c.id, nome: c.name, cor: c.timeline_color, garantias: 0, atividades: 0, ...contagem.get(c.id) }))
    .sort((a, b) => b.garantias - a.garantias || a.nome.localeCompare(b.nome, 'pt-BR'));

  const semTecnico = contagem.get(null);
  return semTecnico && semTecnico.garantias > 0 ? [...linhas, { id: null, nome: 'Sem técnico', cor: null, ...semTecnico }] : linhas;
}

export interface TotalMes {
  mes: string;
  quantidade: number;
}

/** Os 12 meses que terminam em `mesFinal`, do mais antigo ao mais novo, com a quantidade de atividades. */
export function contarUltimos12Meses(atividades: AtividadeRealizada[], mesFinal: string): TotalMes[] {
  const contagem = new Map<string, number>();
  for (const a of atividades) {
    const mes = diaDaAtividade(a).slice(0, 7);
    contagem.set(mes, (contagem.get(mes) ?? 0) + 1);
  }
  return Array.from({ length: 12 }, (_, i) => {
    const mes = somarMeses(mesFinal, i - 11);
    return { mes, quantidade: contagem.get(mes) ?? 0 };
  });
}

/** Parte em relação ao total, no formato brasileiro ("—" quando o total é zero). */
export function percentual(parte: number, total: number): string {
  return total > 0 ? `${((parte / total) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—';
}

/** "2026-11" → "novembro de 2026". */
export function nomeDoMes(mes: string): string {
  return new Date(`${mes}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

/** Número com uma casa decimal, no formato brasileiro ("—" quando não há valor). */
export function umaCasa(valor: number | null): string {
  return valor === null ? '—' : valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
