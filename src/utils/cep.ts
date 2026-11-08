/** Endereço pelo CEP (ViaCEP). null se o CEP não tem 8 dígitos, não existe ou a consulta falhou. */
export async function buscarEnderecoPorCep(
  cep: string,
): Promise<{ logradouro: string; bairro: string; cidade: string; uf: string } | null> {
  const digitos = cep.replace(/\D/g, '');
  if (digitos.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
    const j = (await res.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
    if (j.erro) return null;
    return { logradouro: j.logradouro ?? '', bairro: j.bairro ?? '', cidade: j.localidade ?? '', uf: j.uf ?? '' };
  } catch {
    return null;
  }
}

export const formatarCep = (v: string) => v.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
