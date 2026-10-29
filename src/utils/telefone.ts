/**
 * Formata telefone brasileiro enquanto se digita: "21996418351" -> "(21) 99641-8351".
 * Ignora o +55 e aceita fixo (10 dígitos) e celular (11). Outros tamanhos (ramais,
 * números internacionais) são devolvidos como estão, para não destruir o dado.
 */
export function formatarTelefone(valor: string | null | undefined): string {
  if (!valor) return '';
  const original = valor.trim();
  let d = original.replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length > 11) return original;

  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}${d.length > 6 ? '-' + d.slice(6) : ''}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
