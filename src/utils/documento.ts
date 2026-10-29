import type { PersonType } from '../types/fsm';

/** CPF: só dígitos (11). CNPJ: 12 alfanuméricos + 2 dígitos (formato da Receita desde jul/2026). */
export function limparDocumento(valor: string, tipo: PersonType): string {
  if (tipo === 'PF') return valor.replace(/\D/g, '').slice(0, 11);
  const limpo = valor.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 14);
  // Os dois últimos caracteres (dígitos verificadores) são sempre numéricos
  return limpo.slice(0, 12) + limpo.slice(12).replace(/\D/g, '');
}

export function formatarDocumento(valor: string, tipo: PersonType): string {
  const d = limparDocumento(valor, tipo);
  if (tipo === 'PF') {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  }
  return d
    .replace(/^(.{2})(.)/, '$1.$2')
    .replace(/^(.{2})\.(.{3})(.)/, '$1.$2.$3')
    .replace(/^(.{2})\.(.{3})\.(.{3})(.)/, '$1.$2.$3/$4')
    .replace(/^(.{2})\.(.{3})\.(.{3})\/(.{4})(.)/, '$1.$2.$3/$4-$5');
}

function digitoVerificador(valores: number[], pesos: number[]): number {
  const soma = valores.reduce((acc, v, i) => acc + v * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function cpfValido(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const n = d.split('').map(Number);
  const pesos1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  return (
    digitoVerificador(n.slice(0, 9), pesos1) === n[9] &&
    digitoVerificador(n.slice(0, 10), pesos2) === n[10]
  );
}

function cnpjValido(d: string): boolean {
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(d) || /^(.)\1{13}$/.test(d)) return false;
  // Valor de cada caractere = código ASCII - 48 (dígitos seguem valendo 0-9)
  const v = d.split('').map((c) => c.charCodeAt(0) - 48);
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return (
    digitoVerificador(v.slice(0, 12), pesos1) === v[12] &&
    digitoVerificador(v.slice(0, 13), pesos2) === v[13]
  );
}

/** Vazio é válido (documento é opcional). */
export function documentoValido(valor: string, tipo: PersonType): boolean {
  const d = limparDocumento(valor, tipo);
  if (!d) return true;
  return tipo === 'PF' ? cpfValido(d) : cnpjValido(d);
}
