import { useSyncExternalStore } from 'react';
import { assinarFila, itensFila } from '../services/filaCampo';

/** Itens ainda não enviados da fila do app de campo (atualiza sozinho). */
export function useFilaCampo() {
  return useSyncExternalStore(assinarFila, itensFila);
}

function assinarConexao(fn: () => void) {
  window.addEventListener('online', fn);
  window.addEventListener('offline', fn);
  return () => {
    window.removeEventListener('online', fn);
    window.removeEventListener('offline', fn);
  };
}

/** true quando o aparelho diz que tem rede. */
export function useOnline() {
  return useSyncExternalStore(assinarConexao, () => navigator.onLine);
}
