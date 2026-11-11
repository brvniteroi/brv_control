import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Link2Off, Loader2, MessageCircle, Printer, RotateCcw, ThumbsUp } from 'lucide-react';
import FolhaOrcamentoPlaca, { ESTILO_IMPRESSAO_ORCAMENTO_A4 } from '../components/placas/FolhaOrcamentoPlaca';
import { montarLinkWhatsAppPlaca } from '../components/placas/regrasPlacas';
import { EMPRESA_BRV } from '../components/pmoc/empresa';
import { aprovarOrcamentoPublico, verOrcamentoPublico } from '../services/placas';
import type { BoardPublicQuote } from '../types/placas';
import { valorEmReais } from '../utils/oficina';
import { formatarData, formatarDataHora } from '../utils/ordens';

/**
 * Página pública (sem login) do orçamento de placa: /orcamento-placa/<token>.
 * O cliente vê a mesma folha do PDF, salva em PDF pelo "Imprimir" do navegador e aprova num botão.
 * A página é montada num portal em document.body, porque o index.css esconde o #root ao imprimir.
 */
export default function OrcamentoPlacaPublico() {
  const { token = '' } = useParams();
  const [dados, setDados] = useState<BoardPublicQuote | null | undefined>(undefined);
  const [erroRede, setErroRede] = useState<string | null>(null);
  const [chaveRecarga, setChaveRecarga] = useState(0);

  const [nome, setNome] = useState('');
  const [concordo, setConcordo] = useState(false);
  const [aprovando, setAprovando] = useState(false);
  const [erroAprovar, setErroAprovar] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    Promise.resolve()
      .then(() => {
        setDados(undefined);
        setErroRede(null);
        return verOrcamentoPublico(token);
      })
      .then((res) => {
        if (ativo) setDados(res);
      })
      .catch((err) => {
        if (!ativo) return;
        setErroRede(err instanceof Error ? err.message : 'Não foi possível abrir o orçamento agora.');
        setDados(null);
      });
    return () => {
      ativo = false;
    };
  }, [token, chaveRecarga]);

  useEffect(() => {
    document.title = dados ? `Orçamento ${dados.board_number} · BRV Niterói` : 'Orçamento · BRV Niterói';
  }, [dados]);

  const aprovar = async (e: FormEvent) => {
    e.preventDefault();
    if (nome.trim().length < 3) {
      setErroAprovar('Informe o seu nome.');
      return;
    }
    if (!concordo) {
      setErroAprovar('Marque que leu e concorda com as condições do orçamento.');
      return;
    }
    setAprovando(true);
    setErroAprovar(null);
    try {
      setDados(await aprovarOrcamentoPublico(token, nome));
    } catch (err) {
      setErroAprovar(err instanceof Error ? err.message : 'Não foi possível registrar a aprovação. Tente de novo.');
    } finally {
      setAprovando(false);
    }
  };

  const linkWhatsBrv = montarLinkWhatsAppPlaca(
    EMPRESA_BRV.telefone,
    dados
      ? `Olá, BRV Niterói! Tenho uma dúvida sobre o orçamento da placa ${dados.board_number} (${dados.brand_model}).`
      : 'Olá, BRV Niterói! Tenho uma dúvida sobre um orçamento de placa.',
  );

  const botaoWhats = (
    <a
      href={linkWhatsBrv}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
    >
      <MessageCircle size={17} aria-hidden="true" />
      Dúvidas? Falar com a BRV no WhatsApp
    </a>
  );

  const aprovado = dados?.quote_status === 'aprovado';
  const aceite = aprovado
    ? `Aprovado pelo cliente${dados?.quote_response_channel === 'link' ? ' pelo link' : ''} em ${formatarDataHora(dados?.quote_responded_at ?? null)}`
    : undefined;

  return createPortal(
    <div className="min-h-dvh bg-[#F4F6F8] print:min-h-0 print:bg-white">
      <style>{ESTILO_IMPRESSAO_ORCAMENTO_A4}</style>

      {/* Situação e ações (somem no papel) */}
      <div className="mx-auto w-full max-w-4xl space-y-3 px-4 pt-6 sm:px-6 print:hidden">
        {dados === undefined && !erroRede && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white py-14 text-slate-500">
            <Loader2 size={26} className="animate-spin text-blue-600" aria-hidden="true" />
            <p className="text-sm font-medium">Abrindo o orçamento...</p>
          </div>
        )}

        {erroRede && (
          <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-white p-6 text-center">
            <p className="text-sm font-semibold text-rose-900">{erroRede}</p>
            <button
              type="button"
              onClick={() => setChaveRecarga((c) => c + 1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800"
            >
              <RotateCcw size={14} aria-hidden="true" />
              Tentar de novo
            </button>
          </div>
        )}

        {dados === null && !erroRede && (
          <div className="mx-auto max-w-lg space-y-3 rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Link2Off size={22} aria-hidden="true" />
            </div>
            <h1 className="text-base font-bold text-slate-900">Orçamento não encontrado</h1>
            <p className="text-xs leading-relaxed text-slate-600">
              Confira se o link foi copiado por inteiro ou peça o link atualizado à equipe da BRV.
            </p>
            {botaoWhats}
          </div>
        )}

        {dados && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">BRV Niterói · Laboratório de Placas</p>
                <h1 className="text-lg font-extrabold text-slate-900">Orçamento da placa {dados.board_number}</h1>
                <p className="text-sm text-slate-700">
                  Valor total: <strong>{valorEmReais(dados.quote_amount) || '—'}</strong>
                  {dados.quote_valid_until && dados.quote_status === 'enviado' && (
                    <> · válido até {formatarData(dados.quote_valid_until)}</>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                <Printer size={15} aria-hidden="true" />
                Salvar em PDF / Imprimir
              </button>
            </div>

            <div className="mt-4">
              {aprovado && (
                <div role="status" className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-900">
                  <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                  <div>
                    <p className="font-bold">Orçamento aprovado. Obrigado!</p>
                    <p className="text-xs">
                      {aceite}. A placa segue para o reparo; acompanhe pelo link que você recebeu na entrada ou fale com a BRV.
                    </p>
                  </div>
                </div>
              )}

              {dados.quote_status === 'recusado' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-700">
                  Este orçamento foi registrado como <strong>recusado</strong>. Se mudou de ideia, fale com a BRV.
                </div>
              )}

              {dados.quote_status === 'enviado' && dados.quote_expired && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
                  <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                  <p>
                    A validade deste orçamento terminou em {formatarData(dados.quote_valid_until)}. Fale com a BRV pelo WhatsApp para
                    atualizar a proposta.
                  </p>
                </div>
              )}

              {dados.quote_status === 'enviado' && !dados.quote_expired && (
                <form onSubmit={(e) => void aprovar(e)} className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3.5">
                  <p className="text-sm font-semibold text-slate-900">
                    Leia o orçamento abaixo. Se estiver de acordo, aprove aqui para liberar o reparo.
                  </p>
                  <div>
                    <label htmlFor="orc-nome" className="mb-1 block text-xs font-semibold text-slate-700">
                      Seu nome
                    </label>
                    <input
                      id="orc-nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      autoComplete="name"
                      maxLength={120}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                      placeholder="Nome de quem está aprovando"
                    />
                  </div>
                  <label className="flex items-start gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={concordo}
                      onChange={(e) => setConcordo(e.target.checked)}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span>
                      Li e concordo com o valor, as condições de pagamento e as condições gerais deste orçamento
                      {dados.quote_amount ? ` (${valorEmReais(dados.quote_amount)})` : ''}.
                    </span>
                  </label>
                  {erroAprovar && (
                    <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                      {erroAprovar}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={aprovando}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {aprovando ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <ThumbsUp size={17} aria-hidden="true" />}
                    Aprovar orçamento
                  </button>
                </form>
              )}

              <div className="mt-3">{botaoWhats}</div>
            </div>
          </section>
        )}
      </div>

      {/* Folha A4 (é o que vai para o PDF) */}
      {dados && (
        <div className="mx-auto my-6 max-w-4xl px-4 sm:px-6 print:m-0 print:max-w-none print:p-0">
          <FolhaOrcamentoPlaca
            dados={dados}
            dataEmissao={new Date(dados.quote_sent_at ?? dados.quote_valid_until ?? 0)}
            aceiteCliente={aceite}
          />
        </div>
      )}
    </div>,
    document.body,
  );
}
