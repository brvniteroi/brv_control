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

/**
 * Marcadores avançados exigem um Map ID. Sem `VITE_GOOGLE_MAPS_MAP_ID` no .env usa o ID de demonstração
 * do Google (funciona igual, só não permite estilo do mapa pelo Google Cloud).
 */
export const ID_MAPA = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

export async function carregarMapa() {
  configurar();
  const [maps, marker] = await Promise.all([importLibrary('maps'), importLibrary('marker')]);
  return {
    Map: maps.Map,
    InfoWindow: maps.InfoWindow,
    AdvancedMarkerElement: marker.AdvancedMarkerElement,
    PinElement: marker.PinElement,
  };
}

/** Latitude/longitude de uma posição de marcador (que pode vir como LatLng ou como objeto simples). */
export function lerPosicao(p: google.maps.LatLng | google.maps.LatLngLiteral | google.maps.LatLngAltitude | null | undefined) {
  if (!p) return null;
  return { lat: typeof p.lat === 'function' ? p.lat() : p.lat, lng: typeof p.lng === 'function' ? p.lng() : p.lng };
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
