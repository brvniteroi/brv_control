import { useEffect, useRef, useState } from 'react';
import { carregarMapa } from '../../services/googleMaps';

/** Atendimento do dia no mapa (endereço do cliente). */
export interface PontoAtividade {
  id: string;
  serviceOrderId: string;
  lat: number;
  lng: number;
  /** Cor do status (preenchimento do marcador). */
  cor: string;
  /** Cor do técnico (contorno). */
  corTecnico: string;
  /** Posição na ordem do dia do técnico (1, 2, 3...). */
  rotulo: string;
  titulo: string;
  linhas: string[];
}

/** Última posição de um técnico. */
export interface PontoTecnico {
  id: string;
  lat: number;
  lng: number;
  cor: string;
  iniciais: string;
  /** Posição velha (app fechado ou sem sinal): aparece apagado. */
  antigo: boolean;
  titulo: string;
  linhas: string[];
}

export interface Foco {
  tipo: 'atividade' | 'tecnico';
  id: string;
  /** Muda a cada clique, para focar de novo o mesmo ponto. */
  vez: number;
}

interface MapaOperacaoProps {
  atividades: PontoAtividade[];
  tecnicos: PontoTecnico[];
  foco: Foco | null;
  /** Ao mudar (outro dia, botão "Enquadrar"), ajusta o zoom para caber todos os pontos. */
  chaveEnquadrar: string;
  onAbrirOS: (serviceOrderId: string) => void;
}

/** Centro de Niterói, quando ainda não há pontos. */
const CENTRO_PADRAO = { lat: -22.8832, lng: -43.1034 };

const svgUrl = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
const escapar = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function iconeAtividade(p: PontoAtividade): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
    <path d="M16 40C16 40 3 25 3 15a13 13 0 0 1 26 0c0 10-13 25-13 25z" fill="${p.cor}" stroke="${p.corTecnico}" stroke-width="3"/>
    <text x="16" y="20" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#fff">${escapar(p.rotulo)}</text>
  </svg>`;
  return { url: svgUrl(svg), scaledSize: new google.maps.Size(32, 42), anchor: new google.maps.Point(16, 41) };
}

function iconeTecnico(p: PontoTecnico): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
    <circle cx="22" cy="22" r="18" fill="${p.cor}" stroke="#fff" stroke-width="4"/>
    <circle cx="22" cy="22" r="20.5" fill="none" stroke="#0B1E3F" stroke-width="1" opacity=".35"/>
    <text x="22" y="27" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#fff">${escapar(p.iniciais)}</text>
  </svg>`;
  return { url: svgUrl(svg), scaledSize: new google.maps.Size(44, 44), anchor: new google.maps.Point(22, 22) };
}

/** Conteúdo do balão (montado com DOM: nomes vêm do banco). */
function conteudo(titulo: string, linhas: string[], acao?: { rotulo: string; aoClicar: () => void }): HTMLElement {
  const caixa = document.createElement('div');
  caixa.style.cssText = 'font-family:inherit;font-size:12px;line-height:1.45;max-width:240px;color:#334155';
  const t = document.createElement('div');
  t.style.cssText = 'font-weight:700;font-size:13px;color:#0f172a;margin-bottom:2px';
  t.textContent = titulo;
  caixa.append(t);
  for (const l of linhas) {
    const d = document.createElement('div');
    d.textContent = l;
    caixa.append(d);
  }
  if (acao) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = acao.rotulo;
    b.style.cssText = 'margin-top:6px;font-weight:600;color:#2563eb;background:none;border:0;padding:0;cursor:pointer';
    b.addEventListener('click', acao.aoClicar);
    caixa.append(b);
  }
  return caixa;
}

/**
 * Mapa do Google com os técnicos (bolinha com as iniciais, na cor do técnico) e os atendimentos
 * do dia (alfinete na cor do status, contorno na cor do técnico, número = ordem do dia).
 * Os marcadores são atualizados no lugar (o Realtime mexe neles sem fechar o balão aberto).
 */
export default function MapaOperacao({ atividades, tecnicos, foco, chaveEnquadrar, onAbrirOS }: MapaOperacaoProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<google.maps.Map | null>(null);
  const janelaRef = useRef<google.maps.InfoWindow | null>(null);
  const marcadores = useRef(new Map<string, google.maps.Marker>());
  const abertoRef = useRef<string | null>(null);
  const enquadradoRef = useRef<string | null>(null);
  const onAbrirOSRef = useRef(onAbrirOS);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    onAbrirOSRef.current = onAbrirOS;
  });

  // Cria o mapa uma vez
  useEffect(() => {
    if (!container.current) return;
    let cancelado = false;
    const alvo = container.current;
    carregarMapa()
      .then(({ Map: MapaGoogle, InfoWindow }) => {
        if (cancelado) return;
        mapaRef.current = new MapaGoogle(alvo, {
          center: CENTRO_PADRAO,
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
        });
        janelaRef.current = new InfoWindow();
        janelaRef.current.addListener('closeclick', () => (abertoRef.current = null));
        setPronto(true);
      })
      .catch((err: unknown) => {
        if (cancelado) return;
        console.error('Erro ao carregar o Google Maps:', err);
        setErro('Não foi possível carregar o mapa. Confira a chave e as APIs ativadas no Google Cloud.');
      });
    return () => {
      cancelado = true;
    };
  }, []);

  // Desenha / atualiza os marcadores
  useEffect(() => {
    const mapa = mapaRef.current;
    const janela = janelaRef.current;
    if (!pronto || !mapa || !janela) return;

    type Desenho = {
      chave: string;
      posicao: google.maps.LatLngLiteral;
      icone: google.maps.Icon;
      titulo: string;
      opacidade: number;
      z: number;
      balao: () => HTMLElement;
    };
    const desenhos: Desenho[] = [
      ...atividades.map((a) => ({
        chave: `atividade:${a.id}`,
        posicao: { lat: a.lat, lng: a.lng },
        icone: iconeAtividade(a),
        titulo: a.titulo,
        opacidade: 1,
        z: 10,
        balao: () => conteudo(a.titulo, a.linhas, { rotulo: 'Abrir OS', aoClicar: () => onAbrirOSRef.current(a.serviceOrderId) }),
      })),
      // Técnicos por cima dos atendimentos
      ...tecnicos.map((t) => ({
        chave: `tecnico:${t.id}`,
        posicao: { lat: t.lat, lng: t.lng },
        icone: iconeTecnico(t),
        titulo: t.titulo,
        opacidade: t.antigo ? 0.45 : 1,
        z: 100,
        balao: () => conteudo(t.titulo, t.linhas),
      })),
    ];

    const vistos = new Set<string>();
    for (const d of desenhos) {
      vistos.add(d.chave);
      let m = marcadores.current.get(d.chave);
      if (!m) {
        m = new google.maps.Marker({ map: mapa });
        const marcador = m;
        marcadores.current.set(d.chave, m);
        marcador.addListener('click', () => {
          abertoRef.current = d.chave;
          janela.setContent((marcador.get('balao') as () => HTMLElement)());
          janela.open({ map: mapa, anchor: marcador });
        });
      }
      m.setPosition(d.posicao);
      m.setIcon(d.icone);
      m.setTitle(d.titulo);
      m.setOpacity(d.opacidade);
      m.setZIndex(d.z);
      m.set('balao', d.balao);
      // Balão aberto acompanha os dados novos
      if (abertoRef.current === d.chave) janela.setContent(d.balao());
    }
    for (const [chave, m] of marcadores.current) {
      if (vistos.has(chave)) continue;
      if (abertoRef.current === chave) {
        janela.close();
        abertoRef.current = null;
      }
      m.setMap(null);
      marcadores.current.delete(chave);
    }

    // Enquadra todos os pontos ao abrir o dia (depois o usuário mexe à vontade)
    if (enquadradoRef.current !== chaveEnquadrar && desenhos.length > 0) {
      enquadradoRef.current = chaveEnquadrar;
      if (desenhos.length === 1) {
        mapa.setCenter(desenhos[0].posicao);
        mapa.setZoom(15);
      } else {
        const limites = new google.maps.LatLngBounds();
        desenhos.forEach((d) => limites.extend(d.posicao));
        mapa.fitBounds(limites, 56);
      }
    }
  }, [pronto, atividades, tecnicos, chaveEnquadrar]);

  // Clique na lista ao lado: centraliza e abre o balão
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!pronto || !mapa || !foco) return;
    const m = marcadores.current.get(`${foco.tipo}:${foco.id}`);
    const posicao = m?.getPosition();
    if (!m || !posicao) return;
    mapa.panTo(posicao);
    if ((mapa.getZoom() ?? 0) < 15) mapa.setZoom(15);
    google.maps.event.trigger(m, 'click');
  }, [pronto, foco]);

  // Ao sair da tela, tira os marcadores
  useEffect(() => {
    const lista = marcadores.current;
    return () => {
      lista.forEach((m) => m.setMap(null));
      lista.clear();
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
      <div ref={container} className="h-full w-full" />
      {erro && (
        <div className="absolute inset-x-4 top-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</div>
      )}
    </div>
  );
}
