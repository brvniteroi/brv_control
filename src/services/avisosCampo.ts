// Aviso dentro do app do técnico quando a agenda de hoje muda (com o app aberto): compara a agenda
// que chegou do servidor com a última vista no aparelho, toca um alerta e destaca o cartão até ele abrir.
// Com o app fechado quem avisa é a notificação push (services/push.ts).
import type { AtividadeCampo } from './campo';

export type Destaque = 'nova' | 'horario';

interface Estado {
  dia: string;
  /** Atividades em aberto de hoje -> horário, como estavam na última carga */
  visto: Record<string, string | null>;
  destaques: Record<string, Destaque>;
}

const chave = (colaboradorId: string) => `brv:campo:avisos:${colaboradorId}`;
const diaDeHoje = () => new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD no fuso do aparelho
const emAberto = (a: AtividadeCampo) => a.status !== 'concluida' && a.status !== 'cancelada';

function ler(colaboradorId: string): Estado | null {
  try {
    const e = JSON.parse(localStorage.getItem(chave(colaboradorId)) ?? 'null') as Estado | null;
    return e && e.dia === diaDeHoje() ? e : null;
  } catch {
    return null;
  }
}

function gravar(colaboradorId: string, e: Estado) {
  localStorage.setItem(chave(colaboradorId), JSON.stringify(e));
}

export interface MudancasAgenda {
  novas: AtividadeCampo[];
  alteradas: AtividadeCampo[];
  removidas: number;
  destaques: Record<string, Destaque>;
}

/**
 * Compara a agenda de hoje (vinda do servidor) com a última vista. Na primeira carga do dia só guarda:
 * nada é "novo". Atividade concluída pelo próprio técnico não conta como removida.
 */
export function analisarAgenda(colaboradorId: string, hoje: AtividadeCampo[]): MudancasAgenda {
  const antes = ler(colaboradorId);
  const abertas = hoje.filter(emAberto);
  const visto = Object.fromEntries(abertas.map((a) => [a.id, a.scheduled_start]));
  if (!antes) {
    gravar(colaboradorId, { dia: diaDeHoje(), visto, destaques: {} });
    return { novas: [], alteradas: [], removidas: 0, destaques: {} };
  }

  const novas = abertas.filter((a) => !(a.id in antes.visto));
  const alteradas = abertas.filter((a) => a.id in antes.visto && antes.visto[a.id] !== a.scheduled_start);
  const presentes = new Set(hoje.map((a) => a.id));
  const removidas = Object.keys(antes.visto).filter((id) => !presentes.has(id)).length;

  const destaques: Record<string, Destaque> = {};
  for (const [id, d] of Object.entries(antes.destaques)) if (abertas.some((a) => a.id === id)) destaques[id] = d;
  for (const a of alteradas) destaques[a.id] ??= 'horario';
  for (const a of novas) destaques[a.id] = 'nova';

  gravar(colaboradorId, { dia: diaDeHoje(), visto, destaques });
  return { novas, alteradas, removidas, destaques };
}

export function lerDestaques(colaboradorId: string): Record<string, Destaque> {
  return ler(colaboradorId)?.destaques ?? {};
}

/** O técnico abriu a atividade: tira o destaque. */
export function marcarVisto(colaboradorId: string, atividadeId: string) {
  const e = ler(colaboradorId);
  if (!e || !(atividadeId in e.destaques)) return;
  delete e.destaques[atividadeId];
  gravar(colaboradorId, e);
}

/** Vibra e toca dois bipes (o navegador pode bloquear o som se ninguém tocou na tela ainda). */
export function tocarAlerta() {
  navigator.vibrate?.([300, 150, 300]);
  try {
    const ctx = new AudioContext();
    for (const [i, freq] of [880, 1175].entries()) {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      const t = ctx.currentTime + i * 0.25;
      osc.frequency.value = freq;
      vol.gain.setValueAtTime(0.0001, t);
      vol.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(vol).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.22);
    }
    setTimeout(() => void ctx.close(), 1000);
  } catch {
    /* sem áudio: fica a vibração e o aviso na tela */
  }
}
