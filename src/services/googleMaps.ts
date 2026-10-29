import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

const CHAVE = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

/** Sem chave no .env o app funciona normalmente, só sem mapa e sem coordenadas novas. */
export const mapasConfigurados = Boolean(CHAVE);

let configurado = false;

function configurar() {
  if (configurado) return;
  setOptions({ key: CHAVE, v: 'weekly', language: 'pt-BR', region: 'BR' });
  configurado = true;
}

export async function carregarMapa() {
  configurar();
  return importLibrary('maps');
}

export interface EnderecoGeocodificavel {
  street: string;
  number?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
}

export interface Coordenadas {
  latitude: number;
  longitude: number;
}

/** Texto usado para localizar o endereço; também serve para saber se ele mudou. */
export function textoEndereco(e: EnderecoGeocodificavel): string {
  const via = [e.street, e.number].map((p) => p?.trim()).filter(Boolean).join(', ');
  const cep = e.zip_code?.replace(/\D/g, '');
  const partes = [via, e.district?.trim(), [e.city?.trim(), e.state?.trim()].filter(Boolean).join(' - '), cep];
  return [...partes.filter(Boolean), 'Brasil'].join(', ');
}

/** Devolve as coordenadas do endereço ou null (sem chave, sem resultado ou erro). Nunca lança. */
export async function geocodificar(e: EnderecoGeocodificavel): Promise<Coordenadas | null> {
  if (!mapasConfigurados || !e.street.trim()) return null;
  try {
    configurar();
    const { Geocoder } = await importLibrary('geocoding');
    const { results } = await new Geocoder().geocode({
      address: textoEndereco(e),
      componentRestrictions: { country: 'BR' },
    });
    const local = results[0]?.geometry.location;
    return local ? { latitude: local.lat(), longitude: local.lng() } : null;
  } catch (err) {
    console.error('Falha ao geocodificar endereço:', err);
    return null;
  }
}
