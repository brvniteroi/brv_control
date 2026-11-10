import { useId, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  Cpu,
  Loader2,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { consultarCodigoErro } from '../components/placas/fonteDeDados';
import NavegacaoPlacas from '../components/placas/NavegacaoPlacas';
import type { ResultadoConsultaErro } from '../types/placas';
import { formatarDataHora } from '../utils/ordens';

const MARCAS_SUGERIDAS = [
  'LG',
  'Midea',
  'Daikin',
  'Samsung',
  'Elgin',
  'Gree',
  'Carrier',
  'Springer',
  'Fujitsu',
  'Consul',
] as const;

export default function PlacasErros() {
  const idBase = useId();

  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [consulta, setConsulta] = useState('');

  const [carregando, setCarregando] = useState(false);
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);
  const [erroRede, setErroRede] = useState<string | null>(null);
  const [resultadoAtual, setResultadoAtual] = useState<ResultadoConsultaErro | null>(null);
  const [historicoSessao, setHistoricoSessao] = useState<ResultadoConsultaErro[]>([]);

  const executarPesquisa = async (
    marcaAlvo = marca,
    modeloAlvo = modelo,
    consultaAlvo = consulta,
  ) => {
    setErroValidacao(null);
    setErroRede(null);

    if (!marcaAlvo.trim()) {
      setErroValidacao('Informe a marca do equipamento.');
      return;
    }
    if (!consultaAlvo.trim()) {
      setErroValidacao('Informe o código de erro ou o sintoma apresentado.');
      return;
    }

    setCarregando(true);
    try {
      const resposta = await consultarCodigoErro({
        marca: marcaAlvo.trim(),
        modelo: modeloAlvo.trim() || undefined,
        consulta: consultaAlvo.trim(),
      });
      setResultadoAtual(resposta);
      setHistoricoSessao((prev) => [resposta, ...prev.slice(0, 9)]);
    } catch (err) {
      setErroRede(
        err instanceof Error ? err.message : 'Não foi possível consultar o código de erro.',
      );
    } finally {
      setCarregando(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void executarPesquisa();
  };

  const dispararExemplo = (m: string, mod: string, cod: string) => {
    setMarca(m);
    setModelo(mod);
    setConsulta(cod);
    void executarPesquisa(m, mod, cod);
  };

  return (
    <div className="space-y-5">
      <NavegacaoPlacas />

      {/* Cabeçalho */}
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brv-navy text-white">
          <AlertTriangle size={18} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
            Consulta de códigos de erro
          </h1>
          <p className="text-xs text-slate-500">
            Pesquisa primeiro nos manuais enviados ao sistema e complementa com análise da IA.
          </p>
        </div>
      </div>

      {/* Formulário de pesquisa */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Nova consulta rápida
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Testar exemplos:</span>
            <button
              type="button"
              onClick={() => dispararExemplo('LG', 'Dual Inverter S4-Q12JA31A', 'CH05')}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >
              LG · CH05
            </button>
            <button
              type="button"
              onClick={() => dispararExemplo('Daikin', 'EcoSwing R-32', 'U4')}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >
              Daikin · U4
            </button>
            <button
              type="button"
              onClick={() => dispararExemplo('Samsung', 'WindFree', 'E464')}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >
              Samsung · E464
            </button>
          </div>
        </div>

        <datalist id={`${idBase}-marcas`}>
          {MARCAS_SUGERIDAS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label
              htmlFor={`${idBase}-marca`}
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Marca *
            </label>
            <input
              id={`${idBase}-marca`}
              type="text"
              list={`${idBase}-marcas`}
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              placeholder="Ex.: LG, Daikin, Midea"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor={`${idBase}-modelo`}
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Modelo (opcional)
            </label>
            <input
              id={`${idBase}-modelo`}
              type="text"
              autoCorrect="off"
              spellCheck={false}
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              placeholder="Ex.: Dual Inverter 12.000"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor={`${idBase}-consulta`}
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Código ou sintoma *
            </label>
            <input
              id={`${idBase}-consulta`}
              type="text"
              autoCorrect="off"
              spellCheck={false}
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              placeholder="Ex.: CH05, E1, LED pisca 5x"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-sm placeholder:font-sans focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {erroValidacao && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
          >
            {erroValidacao}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={carregando}
            className="inline-flex items-center gap-2 rounded-xl bg-brv-navy px-5 py-2.5 text-sm font-semibold text-white shadow-2xs hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {carregando ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                <span>A IA está pesquisando...</span>
              </>
            ) : (
              <>
                <Search size={16} aria-hidden="true" />
                <span>Pesquisar código</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Estado de carregando */}
      {carregando && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-blue-200 bg-blue-50/70 py-12 text-center"
        >
          <Loader2 size={28} className="animate-spin text-blue-600" aria-hidden="true" />
          <p className="text-sm font-bold text-blue-950">A IA está pesquisando...</p>
          <p className="text-xs text-blue-800">
            Verificando manuais de serviço cadastrados e base técnica de climatização inverter.
          </p>
        </div>
      )}

      {/* Estado de erro */}
      {!carregando && erroRede && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
        >
          <span className="font-semibold">{erroRede}</span>
          <button
            type="button"
            onClick={() => void executarPesquisa()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3.5 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span>Tentar de novo</span>
          </button>
        </div>
      )}

      {/* Cartão estruturado de resposta */}
      {!carregando && resultadoAtual && (
        <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs">
          {/* Rótulo obrigatório + Fonte explícita */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950">
            <span className="inline-flex items-center gap-2 font-bold uppercase tracking-wide text-amber-900">
              <AlertTriangle size={16} className="shrink-0 text-amber-700" aria-hidden="true" />
              Sugestão da IA: confirme na bancada
            </span>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${
                resultadoAtual.fonte_tipo === 'manual_fabricante'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'border-indigo-300 bg-indigo-50 text-indigo-900'
              }`}
            >
              {resultadoAtual.fonte_tipo === 'manual_fabricante' ? (
                <>
                  <BookOpenCheck size={13} aria-hidden="true" />
                  <span>Manual do fabricante</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} aria-hidden="true" />
                  <span>Pesquisa da IA</span>
                </>
              )}
            </span>
          </div>

          <header className="border-b border-slate-100 pb-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-blue-700">
                {resultadoAtual.marca}
                {resultadoAtual.modelo ? ` · ${resultadoAtual.modelo}` : ''}
              </span>
              <span className="rounded-lg bg-slate-900 px-2.5 py-0.5 font-mono text-xs font-bold text-white">
                {resultadoAtual.codigo_ou_sintoma}
              </span>
            </div>
            <h2 className="mt-2 text-base font-extrabold text-slate-900">
              {resultadoAtual.significado}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Fonte utilizada: <strong>{resultadoAtual.fonte_descricao}</strong>
            </p>
          </header>

          {resultadoAtual.aviso_seguranca && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-950">
              <ShieldAlert size={17} className="mt-0.5 shrink-0 text-rose-600" aria-hidden="true" />
              <div>
                <p className="font-bold uppercase tracking-wide text-rose-800">
                  Aviso de segurança elétrica
                </p>
                <p className="mt-0.5 text-rose-900">{resultadoAtual.aviso_seguranca}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Causas prováveis
              </h3>
              <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-slate-800">
                {resultadoAtual.causas_provaveis.map((causa, i) => (
                  <li key={i}>{causa}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                <CheckCircle2 size={14} className="text-emerald-600" aria-hidden="true" />
                Passo a passo de verificação
              </h3>
              <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-slate-800">
                {resultadoAtual.verificacoes.map((passo, i) => (
                  <li key={i}>{passo}</li>
                ))}
              </ol>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
              <Cpu size={14} className="text-blue-600" aria-hidden="true" />
              Componentes e periféricos envolvidos
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {resultadoAtual.componentes_envolvidos.map((comp) => (
                <span
                  key={comp}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-medium text-slate-800"
                >
                  {comp}
                </span>
              ))}
            </div>
          </div>
        </article>
      )}

      {/* Histórico de consultas da sessão */}
      {historicoSessao.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-slate-500" aria-hidden="true" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Consultas recentes nesta sessão ({historicoSessao.length})
            </h2>
          </div>

          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {historicoSessao.map((item, idx) => (
              <button
                key={`${item.consultado_em}-${idx}`}
                type="button"
                onClick={() => setResultadoAtual(item)}
                className="flex w-full flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <span className="font-bold text-slate-900">{item.marca}</span>
                  {item.modelo ? <span className="text-slate-500"> · {item.modelo}</span> : null}
                  <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 font-mono font-semibold text-slate-800">
                    {item.codigo_ou_sintoma}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  {formatarDataHora(item.consultado_em)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

