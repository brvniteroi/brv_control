import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, MessageCircle, Star } from 'lucide-react';
import { avaliacoesDaOS, gerarLinkAvaliacao, whatsappDoCliente, type Avaliacao } from '../../services/avaliacoes';
import type { ServiceOrderStatus } from '../../types/fsm';
import { formatarData } from '../../utils/ordens';
import Estrelas from './Estrelas';

interface AvaliacaoOSProps {
  ordemId: string;
  numero: number;
  status: ServiceOrderStatus;
  clienteId: string;
  clienteNome: string | null;
}

const BOTAO =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50';

/** Avaliação do cliente na OS: as recebidas e, com a OS concluída, o pedido pelo WhatsApp. */
export default function AvaliacaoOS({ ordemId, numero, status, clienteId, clienteNome }: AvaliacaoOSProps) {
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(() => {
    avaliacoesDaOS(ordemId)
      .then((lista) => {
        setAvaliacoes(lista);
        setErro(null);
      })
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar a avaliação.'));
  }, [ordemId]);
  useEffect(carregar, [carregar]);

  // O cliente pode avaliar enquanto a tela está aberta: confere de novo ao voltar para a aba
  useEffect(() => {
    const aoVoltar = () => document.visibilityState === 'visible' && carregar();
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [carregar]);

  const jaAvaliadaNoSistema = avaliacoes?.some((a) => !a.field_control_id) ?? false;
  const podePedir = status === 'concluida' && !jaAvaliadaNoSistema;

  const mensagem = (link: string) => {
    const nome = clienteNome?.trim().split(/\s+/)[0];
    return (
      `Olá${nome ? `, ${nome}` : ''}! Aqui é da BRV Niterói. Obrigado pela confiança no nosso serviço (OS ${numero}).\n\n` +
      `Pode avaliar como foi o atendimento? Leva só alguns segundos:\n${link}`
    );
  };

  const enviarWhatsapp = async () => {
    setErro(null);
    setAviso(null);
    // Abre a janela já no clique (depois do await o navegador bloquearia o pop-up)
    const janela = window.open('', '_blank');
    setOcupado(true);
    try {
      const [link, fone] = await Promise.all([gerarLinkAvaliacao(ordemId), whatsappDoCliente(clienteId)]);
      const url = `https://wa.me/${fone ?? ''}?text=${encodeURIComponent(mensagem(link))}`;
      if (janela) janela.location.href = url;
      else window.location.href = url;
      if (!fone) setAviso('O cliente não tem celular válido no cadastro: escolha o contato no WhatsApp.');
    } catch (e) {
      janela?.close();
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar o link.');
    } finally {
      setOcupado(false);
    }
  };

  const copiarLink = async () => {
    setErro(null);
    setOcupado(true);
    try {
      const link = await gerarLinkAvaliacao(ordemId);
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível copiar o link.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-800">
          <Star size={18} className="text-amber-500" />
          <h2 className="text-sm font-bold">Avaliação do cliente</h2>
        </div>
        {podePedir && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={enviarWhatsapp} disabled={ocupado} className={`${BOTAO} border-emerald-200 text-emerald-700 hover:bg-emerald-50`}>
              <MessageCircle size={14} /> Enviar avaliação pelo WhatsApp
            </button>
            <button type="button" onClick={copiarLink} disabled={ocupado} className={BOTAO}>
              {copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? 'Link copiado' : 'Copiar link'}
            </button>
          </div>
        )}
      </div>

      {erro && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}
      {aviso && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{aviso}</p>}

      {avaliacoes === null ? (
        !erro && <p className="mt-3 text-xs text-slate-400">Carregando...</p>
      ) : avaliacoes.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          {status === 'concluida'
            ? 'Ainda sem avaliação. Envie o link para o cliente avaliar o atendimento.'
            : 'O pedido de avaliação fica disponível quando a OS for concluída.'}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {avaliacoes.map((a) => (
            <li key={a.id} className="py-2.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Estrelas nota={a.stars} />
                <span className="text-[11px] text-slate-500">
                  {formatarData(a.created_at)}
                  {a.employee ? ` · ${a.employee.name}` : ''}
                  {a.field_control_id ? ' · Field Control' : ''}
                </span>
              </div>
              {a.comment && <p className="mt-1 whitespace-pre-line text-xs text-slate-700">"{a.comment}"</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
