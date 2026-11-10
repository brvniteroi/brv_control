import { useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import {
  AlertTriangle,
  FileUp,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
} from 'lucide-react';
import type { ProfileRole } from '../../types/fsm';
import type { PlacaFichaTecnica } from '../../types/placas';
import { extrairFichaDoManual, salvarFicha } from './fonteDeDados';
import FormularioCamposFicha from './FormularioCamposFicha';
import ModalDialogoPlacas from './ModalDialogoPlacas';
import { criarFichaVazia, type DadosCamposFicha } from './regrasPlacas';

interface CadastrarFichaIAModalProps {
  aberto: boolean;
  papel: ProfileRole | undefined;
  onFechar: () => void;
  onSalva: (ficha: PlacaFichaTecnica) => void;
}

export default function CadastrarFichaIAModal({
  aberto,
  papel,
  onFechar,
  onSalva,
}: CadastrarFichaIAModalProps) {
  const [etapa, setEtapa] = useState<'upload' | 'lendo' | 'revisao'>('upload');
  const [arrastando, setArrastando] = useState(false);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [ultimoArquivo, setUltimoArquivo] = useState<File | null>(null);
  const [erroLeitura, setErroLeitura] = useState<string | null>(null);

  const [dadosRevisao, setDadosRevisao] = useState<DadosCamposFicha>(criarFichaVazia);
  const [camposConferir, setCamposConferir] = useState<Set<keyof DadosCamposFicha>>(
    () => new Set(),
  );
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const resetar = () => {
    setEtapa('upload');
    setArrastando(false);
    setNomeArquivo('');
    setUltimoArquivo(null);
    setErroLeitura(null);
    setDadosRevisao(criarFichaVazia());
    setCamposConferir(new Set());
    setSalvando(false);
    setErroSalvar(null);
  };

  const handleFechar = () => {
    if (etapa === 'lendo' || salvando) return;
    resetar();
    onFechar();
  };

  const processarArquivo = async (arquivo: File) => {
    setErroLeitura(null);
    setUltimoArquivo(arquivo);
    setNomeArquivo(arquivo.name);
    setEtapa('lendo');

    try {
      const extraido = await extrairFichaDoManual(arquivo);
      setDadosRevisao(extraido.ficha);
      setCamposConferir(new Set(extraido.campos_conferir));
      setEtapa('revisao');
    } catch (err) {
      setEtapa('upload');
      setErroLeitura(
        err instanceof Error ? err.message : 'Não foi possível ler este arquivo.',
      );
    }
  };

  const handleInputArquivo = (e: ChangeEvent<HTMLInputElement>) => {
    const arq = e.target.files?.[0];
    if (arq) void processarArquivo(arq);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastando(false);
    const arq = e.dataTransfer.files?.[0];
    if (arq) void processarArquivo(arq);
  };

  const handleSalvarFichaRevisada = async (e: FormEvent) => {
    e.preventDefault();
    setErroSalvar(null);

    if (!dadosRevisao.fabricante.trim()) {
      setErroSalvar('Informe o fabricante do equipamento antes de salvar.');
      return;
    }
    if (!dadosRevisao.evaporadora?.trim() && !dadosRevisao.condensadora?.trim()) {
      setErroSalvar('Informe ao menos o código da evaporadora ou da condensadora.');
      return;
    }

    setSalvando(true);
    try {
      const criada = await salvarFicha(dadosRevisao, papel ?? 'escritorio');
      resetar();
      onSalva(criada);
    } catch (err) {
      setErroSalvar(err instanceof Error ? err.message : 'Erro ao salvar a ficha técnica.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalDialogoPlacas
      aberto={aberto}
      onFechar={handleFechar}
      titulo="Cadastrar ficha técnica com IA"
      subtitulo="Envie o manual do fabricante (PDF ou TXT), revise os campos extraídos e confirme antes de gravar."
      larguraMax="max-w-4xl"
      fecharAoClicarFora={false}
    >
      {etapa === 'upload' && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition ${
              arrastando
                ? 'border-blue-600 bg-blue-50/70'
                : 'border-slate-300 bg-slate-50/60 hover:border-blue-400'
            }`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              <FileUp size={24} aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-900">
                Arraste o manual técnico aqui ou selecione no computador
              </p>
              <p className="text-xs text-slate-500">
                Formatos aceitos: <strong>.pdf</strong> ou <strong>.txt</strong> (até 20 MB).
              </p>
            </div>
            <label className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brv-navy px-4 py-2.5 text-xs font-semibold text-white shadow-2xs hover:bg-slate-800">
              <Sparkles size={15} aria-hidden="true" />
              <span>Escolher manual e ler com IA</span>
              <input
                type="file"
                accept=".pdf,.txt,application/pdf,text/plain"
                onChange={handleInputArquivo}
                className="sr-only"
              />
            </label>
          </div>

          {erroLeitura && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900"
            >
              <span className="font-semibold">{erroLeitura}</span>
              {ultimoArquivo && (
                <button
                  type="button"
                  onClick={() => void processarArquivo(ultimoArquivo)}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-white px-2.5 py-1 font-semibold text-rose-800 hover:bg-rose-100"
                >
                  <RotateCcw size={13} aria-hidden="true" />
                  <span>Tentar de novo</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {etapa === 'lendo' && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center justify-center gap-3 py-14 text-center"
        >
          <Loader2 size={32} className="animate-spin text-blue-600" aria-hidden="true" />
          <p className="text-base font-bold text-slate-900">A IA está lendo o manual...</p>
          <p className="max-w-md text-xs text-slate-600">
            Extraindo modelos de evaporadora/condensadora, bitolas frigoríficas, correntes e recomendações elétricas de{' '}
            <strong>{nomeArquivo}</strong>.
          </p>
        </div>
      )}

      {etapa === 'revisao' && (
        <form onSubmit={handleSalvarFichaRevisada} noValidate className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
              <div className="space-y-0.5">
                <p className="font-bold uppercase tracking-wide text-amber-900">
                  Sugestão da IA: revisão humana obrigatória antes de salvar
                </p>
                <p className="text-amber-900">
                  Arquivo lido: <strong>{nomeArquivo}</strong>. Os campos marcados com o selo{' '}
                  <strong className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] uppercase">
                    conferir
                  </strong>{' '}
                  estavam ausentes ou ambíguos no manual e precisam da sua validação.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={resetar}
              className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 font-semibold text-amber-900 hover:bg-amber-100"
            >
              Trocar arquivo
            </button>
          </div>

          <FormularioCamposFicha
            dados={dadosRevisao}
            onChange={setDadosRevisao}
            camposConferir={camposConferir}
          />

          {erroSalvar && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800"
            >
              {erroSalvar}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={salvando}
              onClick={handleFechar}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-60 sm:text-sm"
            >
              {salvando ? (
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <Save size={15} aria-hidden="true" />
              )}
              <span>Confirmar revisão e salvar ficha</span>
            </button>
          </div>
        </form>
      )}
    </ModalDialogoPlacas>
  );
}
