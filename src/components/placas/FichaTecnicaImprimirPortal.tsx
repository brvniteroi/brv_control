import { createPortal } from 'react-dom';
import { ArrowLeft, Printer, X } from 'lucide-react';
import type { PlacaFichaTecnica } from '../../types/placas';
import { formatarData } from '../../utils/ordens';
import { EMPRESA_BRV } from '../pmoc/empresa';

interface FichaTecnicaImprimirPortalProps {
  ficha: PlacaFichaTecnica;
  onFechar: () => void;
}

const ESTILO_IMPRESSAO_FICHA = `
@media print {
  @page {
    size: A4 portrait;
    margin: 12mm 14mm 14mm 14mm;
  }
  .placas-cor-exata {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
`;

const v = (valor: string | null | undefined) => (valor && valor.trim() ? valor.trim() : '—');

function LinhaCampo({ rotulo, valor, mono }: { rotulo: string; valor: string | null; mono?: boolean }) {
  return (
    <div className="border-b border-slate-200 py-1.5">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{rotulo}</dt>
      <dd className={`mt-0.5 text-xs font-semibold text-slate-900 ${mono ? 'font-mono' : ''}`}>
        {v(valor)}
      </dd>
    </div>
  );
}

export default function FichaTecnicaImprimirPortal({
  ficha,
  onFechar,
}: FichaTecnicaImprimirPortalProps) {
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Impressão da ficha técnica ${ficha.fabricante}`}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 p-3 sm:p-6 print:static print:overflow-visible print:bg-white print:p-0"
    >
      <style>{ESTILO_IMPRESSAO_FICHA}</style>

      {/* Barra de controle na tela */}
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white shadow-lg print:hidden">
        <button
          type="button"
          onClick={onFechar}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Voltar</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Printer size={15} aria-hidden="true" />
            <span>Imprimir A4</span>
          </button>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar visualização"
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Folha A4 */}
      <article className="placas-cor-exata mx-auto max-w-[210mm] rounded-xl bg-white p-6 text-slate-900 shadow-2xl sm:p-10 print:max-w-none print:rounded-none print:p-0 print:shadow-none space-y-5">
        <header className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
          <div className="flex items-center gap-3">
            <img
              src={EMPRESA_BRV.logoUrl}
              alt="BRV Niterói"
              className="h-12 w-12 object-contain"
            />
            <div>
              <h1 className="text-base font-black uppercase tracking-tight text-slate-900">
                Ficha Técnica de Equipamento Split
              </h1>
              <p className="text-xs text-slate-600">
                {EMPRESA_BRV.razaoSocial} · Apoio Técnico de Bancada e Campo
              </p>
            </div>
          </div>

          <div className="text-right text-xs">
            <p className="font-extrabold text-slate-900">
              {ficha.fabricante} {ficha.linha ? `· ${ficha.linha}` : ''}
            </p>
            <p className="text-slate-600">{v(ficha.capacidade_btu)}</p>
            <p className="text-[10px] text-slate-400">
              Cadastro: {formatarData(ficha.created_at)}
            </p>
          </div>
        </header>

        {/* 1. Identificação */}
        <section className="space-y-2">
          <h2 className="rounded bg-slate-900 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white">
            1. Identificação das unidades
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
            <LinhaCampo rotulo="Fabricante" valor={ficha.fabricante} />
            <LinhaCampo rotulo="Linha comercial" valor={ficha.linha} />
            <LinhaCampo rotulo="Tipo de split" valor={ficha.tipo_split} />
            <LinhaCampo rotulo="Capacidade (BTU/h)" valor={ficha.capacidade_btu} />
            <LinhaCampo rotulo="Capacidade (W)" valor={ficha.capacidade_w} />
            <LinhaCampo rotulo="Revisão do manual" valor={ficha.revisao_manual} />
            <LinhaCampo rotulo="Unidade evaporadora" valor={ficha.evaporadora} mono />
            <LinhaCampo rotulo="Medida evaporadora" valor={ficha.medida_evaporadora} />
            <LinhaCampo rotulo="Ref. placa evaporadora" valor={ficha.ref_evaporadora} mono />
            <LinhaCampo rotulo="Unidade condensadora" valor={ficha.condensadora} mono />
            <LinhaCampo rotulo="Medida condensadora" valor={ficha.medida_condensadora} />
            <LinhaCampo rotulo="Ref. placa condensadora" valor={ficha.ref_condensadora} mono />
          </dl>
        </section>

        {/* 2. Linha frigorífica */}
        <section className="space-y-2">
          <h2 className="rounded bg-slate-900 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white">
            2. Linha frigorífica e fluido refrigerante
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
            <LinhaCampo rotulo="Fluido refrigerante" valor={ficha.gas} />
            <LinhaCampo rotulo="Tubulação líquido" valor={ficha.cobre_liquido} />
            <LinhaCampo rotulo="Tubulação sucção" valor={ficha.cobre_succao} />
            <LinhaCampo rotulo="Distância mínima" valor={ficha.dist_min} />
            <LinhaCampo rotulo="Distância padrão (sem carga extra)" valor={ficha.dist_padrao} />
            <LinhaCampo rotulo="Distância máxima" valor={ficha.dist_max} />
            <LinhaCampo rotulo="Desnível máximo" valor={ficha.desnivel_max} />
            <LinhaCampo rotulo="Carga de fábrica" valor={ficha.carga_fabrica} />
            <LinhaCampo rotulo="Carga adicional por metro" valor={ficha.carga_extra} />
            <div className="col-span-2 sm:col-span-3">
              <LinhaCampo rotulo="Regra especial de bitola" valor={ficha.regra_bitola} />
            </div>
          </dl>
        </section>

        {/* 3. Elétrica */}
        <section className="space-y-2">
          <h2 className="rounded bg-slate-900 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white">
            3. Dados elétricos e interligação
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
            <LinhaCampo rotulo="Tensão / Fases" valor={ficha.tensao} />
            <LinhaCampo rotulo="Ponto de alimentação" valor={ficha.alimentacao_em} />
            <LinhaCampo rotulo="Disjuntor / Proteção" valor={ficha.protecao} />
            <LinhaCampo rotulo="Potência nominal" valor={ficha.p_nominal} />
            <LinhaCampo rotulo="Potência máx. dimensionamento" valor={ficha.p_max_dim} />
            <LinhaCampo rotulo="Origem recomendação elétrica" valor={ficha.origem_eletrica} />
            <LinhaCampo rotulo="Corrente refrigeração" valor={ficha.i_refrigeracao} />
            <LinhaCampo rotulo="Corrente aquecimento" valor={ficha.i_aquecimento} />
            <LinhaCampo rotulo="Corrente máx. dimensionamento" valor={ficha.i_max_dim} />
            <LinhaCampo rotulo="Cabo de alimentação" valor={ficha.cabo_alimentacao} />
            <div className="col-span-2">
              <LinhaCampo rotulo="Cabo de interligação (PP)" valor={ficha.cabo_interligacao} />
            </div>
          </dl>
        </section>

        {/* 4. Notas */}
        <section className="space-y-2">
          <h2 className="rounded bg-slate-900 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white">
            4. Notas, lacunas e fonte documental
          </h2>
          <dl className="grid grid-cols-1 gap-x-6">
            <LinhaCampo rotulo="Observações técnicas" valor={ficha.observacao} />
            <LinhaCampo rotulo="Lacunas / pontos a conferir" valor={ficha.lacunas} />
            <LinhaCampo rotulo="Fonte / Manual de origem" valor={ficha.fonte} />
          </dl>
        </section>
      </article>
    </div>,
    document.body,
  );
}

