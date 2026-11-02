import { useOutletContext } from 'react-router-dom';
import type { MeuColaborador } from '../../services/campo';

/** Repassado pelo CampoLayout às telas do app de campo. */
export interface ContextoCampo {
  colaborador: MeuColaborador;
}

export const useContextoCampo = () => useOutletContext<ContextoCampo>();
