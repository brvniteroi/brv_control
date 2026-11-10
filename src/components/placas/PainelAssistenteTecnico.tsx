import { useId, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  Gauge,
  Loader2,
  RotateCcw,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type {
  AssistenteTecnicoInput,
  HipoteseAssistentePlaca,
  ResultadoAssistenteTecnico,
} from '../../types/placas';
import { assistenteTecnico } from './fonteDeDados';

interface PainelAssistenteTecnicoProps {
  valoresIniciais?: Partial<AssistenteTecnicoInput>;
  /** Quando presente (aberto dentro do detalhe da placa), exibe o botão "Usar na placa". */
  onUsarNaPlaca?: (resumoParaDiagnostico: string) => void;
  compacto?: boolean;
}

const SUGESTOES_MARCAS = [
  'Midea',
  'LG',
  'Daikin',
  'Samsung',
  'Elgin',
  'Gree',
  'Carrier',
  'Fujitsu',
  'Springer',
  'Consul',
] as const;

const COR_PROBABILIDADE: Record<HipoteseAssistentePlaca['probabilidade'], string> = {
  Alta: 'border-rose-200 bg-rose-50 text-rose-800',
  Média: 'border-amber-200 bg-amber-50 text-amber-800',
  Baixa: 'border-slate-200 bg-slate-100 text-slate-700',
};

function formatarTextoParaPlaca(res: ResultadoAssistenteTecnico): string {
  const hipotesesPrincipais = res.hipoteses
    .slice(0, 2)
    .map((h) => `- [${h.probabilidade}] ${h.titulo}`)
    .join('\n');
  const componentes = res.componentes_medir.map((c) => c.componente).join(', ');
  return [
    `[Sugestão assistente IA — confirmar em bancada]`,
    res.resumo_diagnostico,
    hipotesesPrincipais ? `Hipóteses prioritárias:\n${hipotesesPrincipais}` : '',
    componentes ? `Componentes a aferir: ${componentes}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export default function PainelAssistenteTecnico({
  valoresIniciais,
  onUsarNaPlaca,
  compacto = false,
}: PainelAssistenteTecnicoProps) {
  const idBase = useId();
  const [marca, setMarca] = useState(valoresIniciais?.marca ?? '');
  const [codigoErro, setCodigoErro] = useState(valoresIniciais?.codigoErro ?? '');
  const [modeloPlaca, setModeloPlaca] = useState(valoresIniciais?.modeloPlaca ?? '');
  const [sintoma, setSintoma] = useState(valoresIniciais?.sintoma ?? '');

  const [carregando, setCarregando] = useState(false);
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);
  const [erroConsulta, setErroConsulta] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoAssistenteTecnico | null>(null);
  const [copiadoNaPlaca, setCopiadoNaPlaca] = useState(false);

  const executarAnalise = async () => {
    setErroValidacao(null);
    setErroConsulta(null);
    setCopiadoNaPlaca(false);

    if (!marca.trim()) {
      setErroValidacao('Informe a marca do equipamento ou da placa.');
      return;
    }
    if (!codigoErro.trim() && !sintoma.trim()) {
      setErroValidacao('Informe o código de erro ou descreva o sintoma observado na bancada.');
      return;
    }

    setCarregando(true);
    try {
      const resposta = await assistenteTecnico({
        marca: marca.trim(),
        codigoErro: codigoErro.trim(),
        modeloPlaca: modeloPlaca.trim(),
        sintoma: sintoma.trim(),
      });
      setResultado(resposta);
    } catch (err) {
      setErroConsulta(
        err instanceof Error
          ? err.message
          : 'Não foi possível consultar o assistente técnico agora.',
      );
    } finally {
      setCarregando(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void executarAnalise();
  };

  const preencherExemplo = (exemplo: AssistenteTecnicoInput) => {
    setMarca(exemplo.marca);
    setCodigoErro(exemplo.codigoErro);
    setModeloPlaca(exemplo.modeloPlaca);
    setSintoma(exemplo.sintoma);
    setErroValidacao(null);
    setErroConsulta(null);
  };

  const handleUsarNaPlaca = () => {
    if (!resultado || !onUsarNaPlaca) return;
    onUsarNaPlaca(formatarTextoParaPlaca(resultado));
    setCopiadoNaPlaca(true);
  };

  return (
    <div className="space-y-5">
      <form
        onSubmit={handleSubmit}
        noValidate
        className={`rounded-2xl border border-slate-200 bg-white ${compacto ? 'p-4' : 'p-5 sm:p-6'} shadow-2xs space-y-4`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">Dados do circuito em bancada</h2>
            <p className="text-xs text-slate-500">
              Informe marca, código de erro, part number da placa e o comportamento medido.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-400">Exemplos:</span>
            <button
              type="button"
              onClick={() =>
                preencherExemplo({
                  marca: 'Midea',
                  codigoErro: 'P4',
                  modeloPlaca: 'CE-KFR35GW/BP2N1Y',
                  sintoma: 'Compressor tenta partir por 3 segundos, desarma e pisca erro de IPM.',
                })
              }
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >
              Midea · P4 (IPM)
            </button>
            <button
              type="button"
              onClick={() =>
                preencherExemplo({
                  marca: 'LG',
                  codigoErro: 'CH05',
                  modeloPlaca: 'EBR83695003',
                  sintoma:
                    'Sem pulso oscilante entre bornes N e S na bancada; fonte primária com 310 VDC normais.',
                })
              }
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >
              LG · CH05 (Serial)
            </button>
          </div>
        </div>

        <datalist id={`${idBase}-marcas`}>
          {SUGESTOES_MARCAS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
              placeholder="Ex.: Midea, LG, Daikin"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor={`${idBase}-erro`}
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Código de erro
            </label>
            <input
              id={`${idBase}-erro`}
              type="text"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={codigoErro}
              onChange={(e) => setCodigoErro(e.target.value)}
              placeholder="Ex.: P4, E1, CH05"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor={`${idBase}-placa`}
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Modelo / código da placa
            </label>
            <input
              id={`${idBase}-placa`}
              type="text"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={modeloPlaca}
              onChange={(e) => setModeloPlaca(e.target.value)}
              placeholder="Ex.: EBR83695003"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor={`${idBase}-sintoma`}
            className="mb-1 block text-xs font-semibold text-slate-700"
          >
            Sintoma observado na bancada *
          </label>
          <textarea
            id={`${idBase}-sintoma`}
            rows={compacto ? 2 : 3}
            value={sintoma}
            onChange={(e) => setSintoma(e.target.value)}
            placeholder="Descreva tensões já conferidas, piscadas de LED, desarme de relé ou aquecimento anormal..."
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
        </div>

        {erroValidacao && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
          >
            {erroValidacao}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
          <button
            type="submit"
            disabled={carregando}
            className="inline-flex items-center gap-2 rounded-xl bg-brv-navy px-4 py-2.5 text-sm font-semibold text-white shadow-2xs transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {carregando ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                <span>A IA está analisando o circuito...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} aria-hidden="true" />
                <span>Gerar diagnóstico</span>
              </>
            )}
          </button>
        </div>
      </form>

      {carregando && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-8 text-center"
        >
          <Loader2 size={28} className="animate-spin text-blue-600" aria-hidden="true" />
          <p className="text-sm font-semibold text-blue-950">
            A IA está analisando o circuito...
          </p>
          <p className="max-w-md text-xs text-blue-800">
            Cruzando código de erro, topologia de fonte chaveada/IPM e pontos clássicos de medição em bancada.
          </p>
        </div>
      )}

      {!carregando && erroConsulta && (
        <div
          role="alert"
          className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center"
        >
          <div className="text-sm text-rose-900">
            <p className="font-semibold">Falha ao gerar o diagnóstico técnico</p>
            <p className="text-xs text-rose-800">{erroConsulta}</p>
          </div>
          <button
            type="button"
            onClick={() => void executarAnalise()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3.5 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
          >
            <RotateCcw size={14} aria-hidden="true" />
            Tentar de novo
          </button>
        </div>
      )}

      {!carregando && resultado && (
        <div className="space-y-4">
          {/* Rótulo obrigatório em toda resposta de IA */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={18} className="shrink-0 text-amber-700" aria-hidden="true" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-900">
                  Sugestão da IA: confirme na bancada
                </p>
                <p className="text-xs text-amber-800">
                  Confira sempre as leituras reais com multímetro/osciloscópio e lâmpada série antes de energizar em carga plena.
                </p>
              </div>
            </div>

            {onUsarNaPlaca && (
              <button
                type="button"
                onClick={handleUsarNaPlaca}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700"
              >
                {copiadoNaPlaca ? (
                  <>
                    <CheckCircle2 size={15} aria-hidden="true" />
                    <span>Copiado para a placa</span>
                  </>
                ) : (
                  <>
                    <ClipboardCheck size={15} aria-hidden="true" />
                    <span>Usar na placa</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Resumo direto */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs">
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              Resumo de bancada
            </h3>
            <p className="text-sm leading-relaxed text-slate-800">
              {resultado.resumo_diagnostico}
            </p>
          </section>

          {/* Hipóteses em ordem de probabilidade */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <Cpu size={16} className="text-blue-600" aria-hidden="true" />
              <h3 className="text-sm font-bold text-slate-900">
                Hipóteses em ordem de probabilidade
              </h3>
            </div>
            <ol className="space-y-2.5">
              {resultado.hipoteses.map((hip, idx) => (
                <li
                  key={`${hip.titulo}-${idx}`}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {idx + 1}. {hip.titulo}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${COR_PROBABILIDADE[hip.probabilidade]}`}
                    >
                      Probabilidade {hip.probabilidade}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-700">{hip.explicacao}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* Testes de bancada / multímetro */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <Gauge size={16} className="text-indigo-600" aria-hidden="true" />
              <h3 className="text-sm font-bold text-slate-900">
                Testes de bancada e multímetro
              </h3>
            </div>

            {/* Cartões no celular */}
            <div className="space-y-2.5 md:hidden">
              {resultado.testes_bancada.map((t) => (
                <div
                  key={t.passo}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">Passo {t.passo}</span>
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-medium text-indigo-800">
                      {t.instrumento_escala}
                    </span>
                  </div>
                  <p className="font-medium text-slate-800">{t.ponto_medicao}</p>
                  <p className="text-emerald-800">
                    <span className="font-semibold">Normal:</span> {t.leitura_normal}
                  </p>
                  <p className="text-rose-800">
                    <span className="font-semibold">Defeito:</span> {t.sinal_defeito}
                  </p>
                </div>
              ))}
            </div>

            {/* Tabela semântica no computador */}
            <div
              role="region"
              aria-label="Tabela de testes de bancada"
              tabIndex={0}
              className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block"
            >
              <table className="w-full text-left text-xs">
                <caption className="sr-only">
                  Procedimento passo a passo de medição em bancada com leituras normais e de defeito
                </caption>
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600">
                  <tr>
                    <th scope="col" className="px-3 py-2.5 font-semibold">
                      #
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">
                      Escala / Instrumento
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">
                      Ponto de medição
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">
                      Leitura íntegra
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">
                      Sinal de defeito
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {resultado.testes_bancada.map((t) => (
                    <tr key={t.passo} className="align-top hover:bg-slate-50/70">
                      <th scope="row" className="px-3 py-2.5 font-bold text-slate-900">
                        {t.passo}
                      </th>
                      <td className="px-3 py-2.5 font-medium text-indigo-900">
                        {t.instrumento_escala}
                      </td>
                      <td className="px-3 py-2.5 text-slate-800">{t.ponto_medicao}</td>
                      <td className="px-3 py-2.5 text-emerald-800">{t.leitura_normal}</td>
                      <td className="px-3 py-2.5 text-rose-800">{t.sinal_defeito}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Componentes prioritários a medir */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <Wrench size={16} className="text-emerald-600" aria-hidden="true" />
              <h3 className="text-sm font-bold text-slate-900">Componentes a medir</h3>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {resultado.componentes_medir.map((comp) => (
                <div
                  key={comp.componente}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs space-y-1"
                >
                  <p className="font-mono text-xs font-bold text-slate-900">{comp.componente}</p>
                  <p className="text-slate-600">
                    <span className="font-semibold text-slate-700">Função:</span> {comp.funcao}
                  </p>
                  <p className="text-slate-700">
                    <span className="font-semibold text-rose-800">Falha típica:</span>{' '}
                    {comp.falha_tipica}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Observações e segurança */}
          {resultado.observacoes.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 space-y-1.5">
              <h3 className="font-bold uppercase tracking-wider text-slate-600">
                Cuidados e observações de bancada
              </h3>
              <ul className="list-disc space-y-1 pl-4">
                {resultado.observacoes.map((obs, idx) => (
                  <li key={idx}>{obs}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

