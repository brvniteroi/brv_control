import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Link2Off,
  Loader2,
  MessageCircle,
  Printer,
  RotateCcw,
  ThumbsUp,
} from 'lucide-react';
import { EMPRESA_BRV } from '../components/pmoc/empresa';
import FolhaOrcamentoVenda, {
  ESTILO_IMPRESSAO_ORCAMENTO_VENDA_A4,
} from '../components/vendas/FolhaOrcamentoVenda';
import {
  aprovarOrcamentoPublico,
  buscarOrcamentoPublico,
} from '../components/vendas/fonteDeDados';
import type { PublicQuoteView } from '../types/vendas';
import { formatarReais } from '../utils/dinheiro';
import { formatarData, formatarDataHora } from '../utils/ordens';

function linkWhatsAppBrv(mensagem: string): string {
  const digitos = EMPRESA_BRV.telefone.replace(/\D/g, '');
  return `https://wa.me/55${digitos}?text=${encodeURIComponent(mensagem)}`;
}

/**
 * Página pública (sem login) do orçamento: `/orcamento/:token`.
 * Segue o mesmo molde de `src/pages/OrcamentoPlacaPublico.tsx`.
 */
export default function OrcamentoPublico() {
  const { token = '' } = useParams();
  const [dados, setDados] = useState<PublicQuoteView | null | undefined>(undefined);
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
        return buscarOrcamentoPublico(token);
      })
      .then((res) => {
        if (ativo) setDados(res);
      })
      .catch((err: unknown) => {
        if (!ativo) return;
        setErroRede(
          err instanceof Error ? err.message : 'Não foi possível abrir o orçamento agora.',
        );
        setDados(null);
      });
    return () => {
      ativo = false;
    };
  }, [token, chaveRecarga]);

  useEffect(() => {
    document.title = dados
      ? `Orçamento ${dados.number} · BRV Niterói`
      : 'Orçamento · BRV Niterói';
  }, [dados]);

  const handleAprovar = async (e: FormEvent) => {
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
      const atualizado = await aprovarOrcamentoPublico(token, nome);
      setDados(atualizado);
    } catch (err) {
      setErroAprovar(
        err instanceof Error
          ? err.message
          : 'Não foi possível registrar a aprovação. Tente de novo.',
      );
    } finally {
      setAprovando(false);
    }
  };

  const urlWhatsBrv = linkWhatsAppBrv(
    dados
      ? `Olá, BRV Niterói! Tenho uma dúvida sobre o orçamento ${dados.number} (${formatarReais(dados.total_cents)}).`
      : 'Olá, BRV Niterói! Tenho uma dúvida sobre um orçamento.',
  );

  const botaoWhats = (
    <a
      href={urlWhatsBrv}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
    >
      <MessageCircle size={17} aria-hidden="true" />
      Dúvidas? Falar com a BRV no WhatsApp
    </a>
  );

  const aprovado = dados?.status === 'aprovado' || dados?.status === 'convertido';
  const aceite = aprovado
    ? `Aprovado pelo cliente${dados?.response_channel === 'link' ? ' pelo link' : ''} em ${formatarDataHora(dados?.responded_at ?? null)}${dados?.responded_by_name ? ` (${dados.responded_by_name})` : ''}`
    : undefined;

  return createPortal(
    <div className="min-h-dvh bg-[#F4F6F8] print:min-h-0 print:bg-white">
      <style>{ESTILO_IMPRESSAO_ORCAMENTO_VENDA_A4}</style>

      {/* Situação e ações (somem no papel) */}
      <div className="mx-auto w-full max-w-4xl space-y-3 px-4 pt-6 sm:px-6 print:hidden">
        {dados === undefined && !erroRede && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white py-14 text-slate-500">
            <Loader2 size={26} className="animate-spin text-blue-600" aria-hidden="true" />
            <p className="text-sm font-medium">Abrindo o orçamento...</p>
          </div>
        )}

        {erroRede && (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-white p-6 text-center"
          >
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
                <p className="text-xs font-semibold text-slate-500">BRV Niterói</p>
                <h1 className="text-lg font-extrabold text-slate-900">
                  Orçamento {dados.number}
                </h1>
                <p className="text-sm text-slate-700">
                  Valor total: <strong>{formatarReais(dados.total_cents)}</strong>
                  {dados.valid_until && dados.status === 'enviado' && (
                    <> · válido até {formatarData(dados.valid_until)}</>
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
                <div
                  role="status"
                  className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-900"
                >
                  <CheckCircle2
                    size={20}
                    className="mt-0.5 shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-bold">Orçamento aprovado. Obrigado!</p>
                    <p className="text-xs">
                      {aceite}. Nossa equipe dará andamento ao atendimento.
                    </p>
                  </div>
                </div>
              )}

              {dados.status === 'recusado' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-700">
                  Este orçamento foi registrado como <strong>recusado</strong>. Se mudou de ideia, fale com a BRV.
                </div>
              )}

              {dados.status === 'rascunho' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
                  Este orçamento ainda está em elaboração pelo atendimento da BRV.
                </div>
              )}

              {dados.status === 'enviado' && dados.is_expired && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
                  <AlertTriangle
                    size={20}
                    className="mt-0.5 shrink-0 text-amber-600"
                    aria-hidden="true"
                  />
                  <p>
                    A validade deste orçamento terminou em {formatarData(dados.valid_until)}. Fale
                    com a BRV pelo WhatsApp para atualizar a proposta.
                  </p>
                </div>
              )}

              {dados.status === 'enviado' && !dados.is_expired && (
                <form
                  onSubmit={(e) => void handleAprovar(e)}
                  className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3.5"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    Leia o orçamento abaixo. Se estiver de acordo, aprove aqui.
                  </p>
                  <div>
                    <label
                      htmlFor="orc-pub-nome"
                      className="mb-1 block text-xs font-semibold text-slate-700"
                    >
                      Seu nome
                    </label>
                    <input
                      id="orc-pub-nome"
                      name="approver_name"
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      autoComplete="name"
                      maxLength={120}
                      placeholder="Nome de quem está aprovando"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                    />
                  </div>

                  <label className="flex items-start gap-2 text-xs text-slate-700">
                    <input
                      id="orc-pub-concordo"
                      type="checkbox"
                      checked={concordo}
                      onChange={(e) => setConcordo(e.target.checked)}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span>
                      Li e concordo com o valor ({formatarReais(dados.total_cents)}), as condições de pagamento e as condições gerais deste orçamento.
                    </span>
                  </label>

                  {erroAprovar && (
                    <p
                      role="alert"
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800"
                    >
                      {erroAprovar}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={aprovando}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {aprovando ? (
                      <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <ThumbsUp size={17} aria-hidden="true" />
                    )}
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
          <FolhaOrcamentoVenda dados={dados} aceiteCliente={aceite} />
        </div>
      )}
    </div>,
    document.body,
  );
}
