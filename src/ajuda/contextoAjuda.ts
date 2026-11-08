import { useEffect, useSyncExternalStore } from 'react';
import type { TelaAjuda } from './topicos';

/**
 * Qual tela o operador está vendo, para o F1 abrir a ajuda certa.
 *
 * A rota diz a página (/clientes, /ordens-de-servico...), mas a OS e o cadastro do cliente abrem
 * por cima de outras páginas sem mudar a rota. Esses painéis chamam `useTelaAjuda('os')` e entram
 * numa pilha: o F1 usa o do topo; sem nenhum, usa a rota.
 */

let pilha: { chave: number; tela: TelaAjuda }[] = [];
let proximaChave = 1;
const ouvintes = new Set<() => void>();

const avisar = () => ouvintes.forEach((f) => f());

const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
};

const topoDaPilha = () => (pilha.length ? pilha[pilha.length - 1].tela : null);

/** Marca a tela enquanto o componente estiver aberto. */
export function useTelaAjuda(tela: TelaAjuda) {
  useEffect(() => {
    const chave = proximaChave++;
    pilha = [...pilha, { chave, tela }];
    avisar();
    return () => {
      pilha = pilha.filter((p) => p.chave !== chave);
      avisar();
    };
  }, [tela]);
}

/** Painel aberto por cima (OS, cliente, nova atividade) ou null. */
export function useTelaSobreposta() {
  return useSyncExternalStore(assinar, topoDaPilha);
}

const ROTAS: [prefixo: string, tela: TelaAjuda][] = [
  ['/clientes', 'clientes'],
  ['/ordens-de-servico', 'os-lista'],
  ['/linha-do-tempo', 'linha-do-tempo'],
  ['/calendario', 'calendario'],
  ['/mapa', 'mapa'],
  ['/equipamentos', 'equipamentos'],
  ['/tipos-de-servico', 'cadastros'],
  ['/etiquetas', 'cadastros'],
  ['/cargos', 'cadastros'],
  ['/formularios', 'cadastros'],
  ['/relatorios', 'relatorios'],
  ['/equipe', 'equipe'],
];

export function telaDaRota(pathname: string): TelaAjuda {
  if (pathname === '/') return 'dashboard';
  return ROTAS.find(([p]) => pathname.startsWith(p))?.[1] ?? 'geral';
}
