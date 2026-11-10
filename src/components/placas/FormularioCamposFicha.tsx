import { useId } from 'react';
import type { DadosCamposFicha } from './regrasPlacas';

interface FormularioCamposFichaProps {
  dados: DadosCamposFicha;
  onChange: (novos: DadosCamposFicha) => void;
  /** Chaves que vieram incertas/ausentes da extração por IA e devem exibir o selo `"conferir"`. */
  camposConferir?: ReadonlySet<keyof DadosCamposFicha>;
}

interface ConfigCampo {
  chave: keyof DadosCamposFicha;
  rotulo: string;
  placeholder?: string;
  obrigatorio?: boolean;
  mono?: boolean;
  colSpan2?: boolean;
}

const CAMPOS_IDENTIFICACAO: readonly ConfigCampo[] = [
  { chave: 'fabricante', rotulo: 'Fabricante', placeholder: 'Ex.: Midea, LG, Daikin', obrigatorio: true },
  { chave: 'linha', rotulo: 'Linha comercial', placeholder: 'Ex.: Xtreme Save Connect' },
  { chave: 'tipo_split', rotulo: 'Tipo de split', placeholder: 'Ex.: Hi-Wall Inverter' },
  { chave: 'capacidade_btu', rotulo: 'Capacidade (BTU/h)', placeholder: 'Ex.: 12.000 BTU/h' },
  { chave: 'capacidade_w', rotulo: 'Capacidade (W)', placeholder: 'Ex.: 3.517 W' },
  { chave: 'revisao_manual', rotulo: 'Revisão do manual', placeholder: 'Ex.: Rev. 2025.04' },
  { chave: 'evaporadora', rotulo: 'Código evaporadora', placeholder: 'Ex.: 42AGVCI12M5', mono: true },
  { chave: 'medida_evaporadora', rotulo: 'Medida evaporadora (LxAxP)', placeholder: 'Ex.: 802 x 295 x 200 mm' },
  { chave: 'ref_evaporadora', rotulo: 'Ref. placa evaporadora', placeholder: 'Ex.: 17122000048120', mono: true },
  { chave: 'condensadora', rotulo: 'Código condensadora', placeholder: 'Ex.: 38AGVCI12M5', mono: true },
  { chave: 'medida_condensadora', rotulo: 'Medida condensadora (LxAxP)', placeholder: 'Ex.: 720 x 495 x 270 mm' },
  { chave: 'ref_condensadora', rotulo: 'Ref. placa condensadora', placeholder: 'Ex.: 17122000051902', mono: true },
];

const CAMPOS_FRIGORIFICA: readonly ConfigCampo[] = [
  { chave: 'gas', rotulo: 'Fluido refrigerante', placeholder: 'Ex.: R-32 / R-410A' },
  { chave: 'cobre_liquido', rotulo: 'Cobre líquido', placeholder: 'Ex.: 1/4"' },
  { chave: 'cobre_succao', rotulo: 'Cobre sucção', placeholder: 'Ex.: 3/8"' },
  { chave: 'dist_min', rotulo: 'Distância mínima', placeholder: 'Ex.: 3 m' },
  { chave: 'dist_padrao', rotulo: 'Distância padrão (fábrica)', placeholder: 'Ex.: 5 m' },
  { chave: 'dist_max', rotulo: 'Distância máxima', placeholder: 'Ex.: 25 m' },
  { chave: 'desnivel_max', rotulo: 'Desnível máximo', placeholder: 'Ex.: 10 m' },
  { chave: 'carga_fabrica', rotulo: 'Carga de fábrica', placeholder: 'Ex.: 580 g' },
  { chave: 'carga_extra', rotulo: 'Carga extra por metro', placeholder: 'Ex.: 12 g/m após 5 m' },
  { chave: 'regra_bitola', rotulo: 'Regra de bitola em longa distância', placeholder: 'Ex.: Manter 3/8" até 25 m', colSpan2: true },
];

const CAMPOS_ELETRICA: readonly ConfigCampo[] = [
  { chave: 'tensao', rotulo: 'Tensão nominal', placeholder: 'Ex.: 220V ~ 60Hz 1F' },
  { chave: 'alimentacao_em', rotulo: 'Alimentação elétrica em', placeholder: 'Evaporadora ou Condensadora' },
  { chave: 'protecao', rotulo: 'Disjuntor / Proteção', placeholder: 'Ex.: 16 A Curva C' },
  { chave: 'p_nominal', rotulo: 'Potência nominal (W)', placeholder: 'Ex.: 1.085 W' },
  { chave: 'p_max_dim', rotulo: 'Potência máx. dim. (W)', placeholder: 'Ex.: 1.650 W' },
  { chave: 'origem_eletrica', rotulo: 'Origem dado elétrico', placeholder: 'Ex.: Tabela pág. 18 do manual' },
  { chave: 'i_refrigeracao', rotulo: 'Corrente refrigeração (A)', placeholder: 'Ex.: 5,1 A' },
  { chave: 'i_aquecimento', rotulo: 'Corrente aquecimento (A)', placeholder: 'Ex.: 5,4 A' },
  { chave: 'i_max_dim', rotulo: 'Corrente máx. dim. (A)', placeholder: 'Ex.: 9,0 A' },
  { chave: 'cabo_alimentacao', rotulo: 'Cabo de alimentação', placeholder: 'Ex.: 3 x 2,5 mm²' },
  { chave: 'cabo_interligacao', rotulo: 'Cabo de interligação (PP)', placeholder: 'Ex.: 4 x 1,5 mm² (L, N, S, Terra)', colSpan2: true },
];

export default function FormularioCamposFicha({
  dados,
  onChange,
  camposConferir,
}: FormularioCamposFichaProps) {
  const idBase = useId();

  const atualizar = (chave: keyof DadosCamposFicha, valor: string) => {
    onChange({
      ...dados,
      [chave]: valor,
    });
  };

  const renderBloco = (titulo: string, lista: readonly ConfigCampo[]) => (
    <fieldset className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
      <legend className="px-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
        {titulo}
      </legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {lista.map((cfg) => {
          const idCampo = `${idBase}-${cfg.chave}`;
          const conferir = camposConferir?.has(cfg.chave) ?? false;
          const valorAtual = dados[cfg.chave] ?? '';

          return (
            <div key={cfg.chave} className={cfg.colSpan2 ? 'sm:col-span-2' : ''}>
              <label
                htmlFor={idCampo}
                className="mb-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-700"
              >
                <span>
                  {cfg.rotulo}
                  {cfg.obrigatorio ? ' *' : ''}
                </span>
                {conferir && (
                  <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.2 text-[10px] font-bold uppercase text-amber-900">
                    conferir
                  </span>
                )}
              </label>
              <input
                id={idCampo}
                type="text"
                autoCorrect={cfg.mono ? 'off' : undefined}
                spellCheck={cfg.mono ? false : undefined}
                value={valorAtual}
                onChange={(e) => atualizar(cfg.chave, e.target.value)}
                placeholder={cfg.placeholder}
                className={`w-full rounded-xl border px-3 py-2 text-xs sm:text-sm focus:outline-none ${
                  conferir
                    ? 'border-amber-400 bg-amber-50/40 focus:border-amber-600'
                    : 'border-slate-300 bg-white focus:border-blue-600'
                } ${cfg.mono ? 'font-mono' : ''}`}
              />
            </div>
          );
        })}
      </div>
    </fieldset>
  );

  return (
    <div className="space-y-4">
      {renderBloco('Identificação', CAMPOS_IDENTIFICACAO)}
      {renderBloco('Linha frigorífica', CAMPOS_FRIGORIFICA)}
      {renderBloco('Elétrica', CAMPOS_ELETRICA)}

      <fieldset className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
        <legend className="px-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
          Notas, lacunas e fonte
        </legend>

        <div>
          <label
            htmlFor={`${idBase}-obs`}
            className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700"
          >
            <span>Observações técnicas</span>
            {camposConferir?.has('observacao') && (
              <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.2 text-[10px] font-bold uppercase text-amber-900">
                conferir
              </span>
            )}
          </label>
          <textarea
            id={`${idBase}-obs`}
            rows={2}
            value={dados.observacao ?? ''}
            onChange={(e) => atualizar('observacao', e.target.value)}
            placeholder="Particularidades de comunicação serial, sensores NTC, cuidados na bancada..."
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor={`${idBase}-lacunas`}
            className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700"
          >
            <span>Lacunas apontadas no manual</span>
            {camposConferir?.has('lacunas') && (
              <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.2 text-[10px] font-bold uppercase text-amber-900">
                conferir
              </span>
            )}
          </label>
          <textarea
            id={`${idBase}-lacunas`}
            rows={2}
            value={dados.lacunas ?? ''}
            onChange={(e) => atualizar('lacunas', e.target.value)}
            placeholder="Dados omissos ou divergentes no manual do fabricante..."
            className="w-full rounded-xl border border-amber-300 bg-amber-50/30 px-3 py-2 text-xs sm:text-sm focus:border-amber-600 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`${idBase}-fonte`}
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Fonte / Manual utilizado
            </label>
            <input
              id={`${idBase}-fonte`}
              type="text"
              value={dados.fonte ?? ''}
              onChange={(e) => atualizar('fonte', e.target.value)}
              placeholder="Ex.: Manual de Serviço Midea Xtreme Save 2025"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor={`${idBase}-url-orig`}
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Link do manual original (opcional)
            </label>
            <input
              id={`${idBase}-url-orig`}
              type="url"
              autoCorrect="off"
              spellCheck={false}
              value={dados.arquivo_original_url ?? ''}
              onChange={(e) => atualizar('arquivo_original_url', e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
