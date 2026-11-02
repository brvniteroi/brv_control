import { useEffect, useRef, useState } from 'react';
import { Map as MapaIcone, Move } from 'lucide-react';
import { carregarMapa, mapasConfigurados } from '../../services/googleMaps';
import type { CustomerAddress } from '../../types/fsm';

interface MapaEnderecosProps {
  enderecos: CustomerAddress[];
  /** Com ela, o alfinete pode ser arrastado para corrigir a posição (lança Error se não salvar). */
  onMover?: (endereco: CustomerAddress, latitude: number, longitude: number) => Promise<void>;
}

function rotulo(e: CustomerAddress): string {
  const apelido = e.label && e.label !== 'Principal' ? e.label : e.is_primary ? 'Principal' : 'Endereço';
  return `${apelido}${e.active ? '' : ' (inativo)'}`;
}

export default function MapaEnderecos({ enderecos, onMover }: MapaEnderecosProps) {
  const container = useRef<HTMLDivElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const onMoverRef = useRef(onMover);
  useEffect(() => {
    onMoverRef.current = onMover;
  });
  const podeMover = !!onMover;

  const localizados = enderecos.filter((e) => e.latitude !== null && e.longitude !== null);

  // O aviso de "posição salva" some sozinho
  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(timer);
  }, [aviso]);

  useEffect(() => {
    const pontos = enderecos.filter((e) => e.latitude !== null && e.longitude !== null);
    if (!mapasConfigurados || pontos.length === 0 || !container.current) return;
    let cancelado = false;
    const alvo = container.current;

    carregarMapa()
      .then(({ Map: MapaGoogle, InfoWindow }) => {
        if (cancelado) return;
        const mapa = new MapaGoogle(alvo, {
          center: { lat: pontos[0].latitude!, lng: pontos[0].longitude! },
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        const janela = new InfoWindow();
        const limites = new google.maps.LatLngBounds();

        for (const e of pontos) {
          const posicao = { lat: e.latitude!, lng: e.longitude! };
          const marcador = new google.maps.Marker({
            map: mapa,
            position: posicao,
            title: podeMover ? `${rotulo(e)} (arraste para corrigir)` : rotulo(e),
            opacity: e.active ? 1 : 0.5,
            draggable: podeMover,
          });
          marcador.addListener('click', () => {
            const caixa = document.createElement('div');
            const titulo = document.createElement('strong');
            titulo.textContent = rotulo(e);
            const linha = document.createElement('div');
            linha.textContent = [e.street, e.number].filter(Boolean).join(', ');
            caixa.append(titulo, linha);
            janela.setContent(caixa);
            janela.open({ map: mapa, anchor: marcador });
          });

          // Solta o alfinete: grava a nova posição; se falhar, volta para onde estava
          let ultima = posicao;
          marcador.addListener('dragend', () => {
            const nova = marcador.getPosition();
            const salvar = onMoverRef.current;
            if (!nova || !salvar) return;
            janela.close();
            salvar(e, nova.lat(), nova.lng())
              .then(() => {
                ultima = { lat: nova.lat(), lng: nova.lng() };
                setAviso({ tipo: 'ok', texto: `Posição de "${rotulo(e)}" salva.` });
              })
              .catch((err: unknown) => {
                marcador.setPosition(ultima);
                setAviso({ tipo: 'erro', texto: err instanceof Error ? err.message : 'Não foi possível salvar a posição.' });
              });
          });
          limites.extend(posicao);
        }

        if (pontos.length > 1) mapa.fitBounds(limites, 48);
      })
      .catch((err: unknown) => {
        if (cancelado) return;
        console.error('Erro ao carregar o Google Maps:', err);
        setErro('Não foi possível carregar o mapa. Confira a chave e as APIs ativadas no Google Cloud.');
      });

    return () => {
      cancelado = true;
    };
  }, [enderecos, podeMover]);

  const semCoordenadas = enderecos.length - localizados.length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex items-center gap-2 text-slate-800">
        <MapaIcone size={18} className="text-blue-600" />
        <h2 className="text-base font-bold">Mapa</h2>
      </div>

      {!mapasConfigurados ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Mapa desativado: falta configurar <code>VITE_GOOGLE_MAPS_API_KEY</code> no <code>.env</code>.
        </p>
      ) : erro ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
      ) : localizados.length === 0 ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Nenhum endereço localizado ainda. As coordenadas são calculadas ao salvar um endereço.
        </p>
      ) : (
        <>
          {podeMover && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
              <Move size={12} /> Posição errada? Arraste o alfinete até o lugar certo; ela é salva ao soltar.
            </p>
          )}
          <div ref={container} className="mt-3 h-72 w-full overflow-hidden rounded-xl bg-slate-100" />
          {aviso && (
            <p
              className={`mt-2 rounded-lg px-3 py-1.5 text-xs ${
                aviso.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'border border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {aviso.texto}
            </p>
          )}
          {semCoordenadas > 0 && (
            <p className="mt-2 text-[11px] text-slate-400">
              {semCoordenadas} {semCoordenadas === 1 ? 'endereço' : 'endereços'} sem localização no mapa.
            </p>
          )}
        </>
      )}
    </div>
  );
}
