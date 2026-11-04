import { useMemo, useState } from 'react';
import { AlertTriangle, Copy, Layers, Plus, Trash2 } from 'lucide-react';
import {
  formatarAreaM2,
  lerNumeroDecimal,
  normalizarSiglaAmbiente,
  sugerirSiglaAmbiente,
} from './regrasPmoc';
import type { PmocEnvironment } from '../../types/pmoc';

interface AbaAmbientesPmocProps {
  planId: string;
  ambientes: PmocEnvironment[];
  onChange: (novos: PmocEnvironment[]) => void;
}

const INPUT_TABELA =
  'block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

export default function AbaAmbientesPmoc({
  planId,
  ambientes,
  onChange,
}: AbaAmbientesPmocProps) {
  // Rascunho textual da área (para permitir digitar "15," antes do próximo algarismo sem perder a vírgula)
  const [textosArea, setTextosArea] = useState<Record<string, string>>({});
  // Marca quais ambientes tiveram a sigla digitada manualmente pelo operador
  const [siglasEditadasManual, setSiglasEditadasManual] = useState<Record<string, boolean>>({});

  const contagensNomes = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const a of ambientes) {
      const chave = a.name.trim().toLowerCase();
      if (!chave) continue;
      mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
    }
    return mapa;
  }, [ambientes]);

  const contagensSiglas = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const a of ambientes) {
      const chave = a.code.trim().toUpperCase();
      if (!chave) continue;
      mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
    }
    return mapa;
  }, [ambientes]);

  const totais = useMemo(() => {
    let fixos = 0;
    let flutuantes = 0;
    let area = 0;
    for (const a of ambientes) {
      fixos += Number.isFinite(a.fixed_occupants) ? a.fixed_occupants : 0;
      flutuantes += Number.isFinite(a.floating_occupants) ? a.floating_occupants : 0;
      area += Number.isFinite(a.area_m2) ? a.area_m2 : 0;
    }
    return { fixos, flutuantes, area };
  }, [ambientes]);

  const adicionarAmbiente = () => {
    const novo: PmocEnvironment = {
      id: crypto.randomUUID(),
      plan_id: planId,
      name: '',
      code: '',
      fixed_occupants: 0,
      floating_occupants: 0,
      area_m2: 0,
      sort_order: ambientes.length + 1,
      created_at: new Date().toISOString(),
    };
    onChange([...ambientes, novo]);
  };

  const duplicarAmbiente = (amb: PmocEnvironment) => {
    const novoId = crypto.randomUUID();
    const nomeCopia = amb.name ? `${amb.name} (Cópia)` : '';
    const siglaSugerida = sugerirSiglaAmbiente(nomeCopia);
    const copia: PmocEnvironment = {
      ...amb,
      id: novoId,
      name: nomeCopia,
      code: siglaSugerida,
      sort_order: ambientes.length + 1,
      created_at: new Date().toISOString(),
    };
    onChange([...ambientes, copia]);
  };

  const removerAmbiente = (id: string) => {
    onChange(
      ambientes
        .filter((a) => a.id !== id)
        .map((a, idx) => ({ ...a, sort_order: idx + 1 })),
    );
  };

  const atualizarNome = (amb: PmocEnvironment, novoNome: string) => {
    const sugeridaAntes = sugerirSiglaAmbiente(amb.name);
    const podeSugerir =
      !siglasEditadasManual[amb.id] && (!amb.code || amb.code === sugeridaAntes);
    const novaSigla = podeSugerir ? sugerirSiglaAmbiente(novoNome) : amb.code;

    onChange(
      ambientes.map((item) =>
        item.id === amb.id ? { ...item, name: novoNome, code: novaSigla } : item,
      ),
    );
  };

  const atualizarSigla = (id: string, valorDigitado: string) => {
    const normalizada = normalizarSiglaAmbiente(valorDigitado);
    setSiglasEditadasManual((prev) => ({ ...prev, [id]: Boolean(normalizada) }));
    onChange(
      ambientes.map((item) => (item.id === id ? { ...item, code: normalizada } : item)),
    );
  };

  const atualizarInteiro = (
    id: string,
    campo: 'fixed_occupants' | 'floating_occupants',
    valor: string,
  ) => {
    const limpo = valor.replace(/\D/g, '');
    const numero = limpo ? Math.max(0, Number.parseInt(limpo, 10)) : 0;
    onChange(
      ambientes.map((item) => (item.id === id ? { ...item, [campo]: numero } : item)),
    );
  };

  const atualizarArea = (id: string, texto: string) => {
    // Permite números, vírgula ou ponto durante a digitação
    const permitido = texto.replace(/[^0-9.,]/g, '');
    setTextosArea((prev) => ({ ...prev, [id]: permitido }));
    const convertido = lerNumeroDecimal(permitido);
    onChange(
      ambientes.map((item) =>
        item.id === id
          ? { ...item, area_m2: convertido !== null && convertido >= 0 ? convertido : 0 }
          : item,
      ),
    );
  };

  const finalizarEdicaoArea = (amb: PmocEnvironment) => {
    setTextosArea((prev) => {
      const copia = { ...prev };
      delete copia[amb.id];
      return copia;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Ambientes climatizados</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Cadastre cada ambiente do imóvel. A sigla (2 a 3 letras) forma o identificador automático dos aparelhos (<code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px]">AR-SR-0001</code>).
          </p>
        </div>

        <button
          type="button"
          onClick={adicionarAmbiente}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700"
        >
          <Plus size={15} aria-hidden="true" />
          Adicionar ambiente
        </button>
      </div>

      {ambientes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Layers size={24} aria-hidden="true" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-800">
            Nenhum ambiente cadastrado neste plano
          </h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            Adicione os ambientes climatizados antes de vincular os equipamentos do cliente.
          </p>
          <button
            type="button"
            onClick={adicionarAmbiente}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={15} aria-hidden="true" />
            Adicionar primeiro ambiente
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div
            role="region"
            aria-label="Tabela editável de ambientes climatizados"
            tabIndex={0}
            className="overflow-x-auto"
          >
            <table className="w-full min-w-[700px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 font-semibold tracking-wider text-slate-500 uppercase">
                  <th scope="col" className="px-4 py-3">
                    Nome do ambiente *
                  </th>
                  <th scope="col" className="w-32 px-3 py-3">
                    Sigla (2–3) *
                  </th>
                  <th scope="col" className="w-32 px-3 py-3 text-right">
                    Ocupantes fixos
                  </th>
                  <th scope="col" className="w-36 px-3 py-3 text-right">
                    Ocupantes flutuantes
                  </th>
                  <th scope="col" className="w-36 px-3 py-3 text-right">
                    Área (m²)
                  </th>
                  <th scope="col" className="w-24 px-4 py-3 text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ambientes.map((amb, idx) => {
                  const chaveNome = amb.name.trim().toLowerCase();
                  const nomeRepetido =
                    Boolean(chaveNome) && (contagensNomes.get(chaveNome) ?? 0) > 1;

                  const chaveSigla = amb.code.trim().toUpperCase();
                  const siglaRepetida =
                    Boolean(chaveSigla) && (contagensSiglas.get(chaveSigla) ?? 0) > 1;
                  const siglaTamanhoInvalido =
                    Boolean(chaveSigla) && (chaveSigla.length < 2 || chaveSigla.length > 3);

                  const valorCampoArea =
                    textosArea[amb.id] !== undefined
                      ? textosArea[amb.id]
                      : amb.area_m2 > 0
                        ? formatarAreaM2(amb.area_m2, false)
                        : '';

                  return (
                    <tr key={amb.id} className="align-top hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          aria-label={`Nome do ambiente ${idx + 1}`}
                          value={amb.name}
                          onChange={(e) => atualizarNome(amb, e.target.value)}
                          placeholder="Ex.: Sala de Reunião"
                          className={`${INPUT_TABELA} ${
                            nomeRepetido ? 'border-rose-400 bg-rose-50/40' : ''
                          }`}
                        />
                        {nomeRepetido && (
                          <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                            <AlertTriangle size={12} aria-hidden="true" />
                            Nome de ambiente repetido neste plano.
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <input
                          type="text"
                          aria-label={`Sigla do ambiente ${amb.name || idx + 1}`}
                          value={amb.code}
                          maxLength={3}
                          autoCorrect="off"
                          spellCheck={false}
                          onChange={(e) => atualizarSigla(amb.id, e.target.value)}
                          placeholder="SR"
                          className={`${INPUT_TABELA} font-mono font-bold uppercase ${
                            siglaRepetida || siglaTamanhoInvalido
                              ? 'border-amber-400 bg-amber-50/50'
                              : ''
                          }`}
                        />
                        {siglaRepetida && (
                          <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                            <AlertTriangle size={12} aria-hidden="true" />
                            Sigla repetida
                          </span>
                        )}
                        {!siglaRepetida && siglaTamanhoInvalido && (
                          <span className="mt-1 block text-[11px] text-amber-700">
                            Use 2 ou 3 letras
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label={`Ocupantes fixos de ${amb.name || `ambiente ${idx + 1}`}`}
                          value={String(amb.fixed_occupants)}
                          onChange={(e) =>
                            atualizarInteiro(amb.id, 'fixed_occupants', e.target.value)
                          }
                          className={`${INPUT_TABELA} text-right`}
                        />
                      </td>

                      <td className="px-3 py-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label={`Ocupantes flutuantes de ${amb.name || `ambiente ${idx + 1}`}`}
                          value={String(amb.floating_occupants)}
                          onChange={(e) =>
                            atualizarInteiro(amb.id, 'floating_occupants', e.target.value)
                          }
                          className={`${INPUT_TABELA} text-right`}
                        />
                      </td>

                      <td className="px-3 py-3">
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            aria-label={`Área em metros quadrados de ${amb.name || `ambiente ${idx + 1}`}`}
                            value={valorCampoArea}
                            onChange={(e) => atualizarArea(amb.id, e.target.value)}
                            onBlur={() => finalizarEdicaoArea(amb)}
                            placeholder="0,0"
                            className={`${INPUT_TABELA} pr-8 text-right`}
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[11px] text-slate-400">
                            m²
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => duplicarAmbiente(amb)}
                            aria-label={`Duplicar ambiente ${amb.name || idx + 1}`}
                            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600"
                          >
                            <Copy size={15} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removerAmbiente(amb.id)}
                            aria-label={`Remover ambiente ${amb.name || idx + 1}`}
                            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-800">
                  <td colSpan={2} className="px-4 py-3">
                    Total ({ambientes.length}{' '}
                    {ambientes.length === 1 ? 'ambiente' : 'ambientes'})
                  </td>
                  <td className="px-3 py-3 text-right">{totais.fixos}</td>
                  <td className="px-3 py-3 text-right">{totais.flutuantes}</td>
                  <td className="px-3 py-3 text-right">
                    {formatarAreaM2(totais.area, true)}
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

