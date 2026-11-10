import { useEffect, useId, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  FolderOpen,
  Inbox,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  enviarManual,
  excluirManual,
  listarManuais,
  textoDoManual,
} from '../components/placas/fonteDeDados';
import ModalDialogoPlacas from '../components/placas/ModalDialogoPlacas';
import NavegacaoPlacas from '../components/placas/NavegacaoPlacas';
import { ehEscritorioOuAdminPlaca } from '../components/placas/regrasPlacas';
import { useAuth } from '../contexts/useAuth';
import type { PlacaManual } from '../types/placas';
import { formatarData } from '../utils/ordens';

/** PDF abre o arquivo; manual só em texto (importado ou TXT) abre o texto numa aba nova. */
function AbrirManual({ manual, rotulo, className, tamanho }: { manual: PlacaManual; rotulo: string; className: string; tamanho: number }) {
  const [abrindo, setAbrindo] = useState(false);
  if (manual.file_url) {
    return (
      <a href={manual.file_url} target="_blank" rel="noopener noreferrer" className={className}>
        <span>{rotulo}</span>
        <ExternalLink size={tamanho} aria-hidden="true" />
      </a>
    );
  }
  const abrirTexto = async () => {
    setAbrindo(true);
    try {
      const texto = await textoDoManual(manual.id);
      const url = URL.createObjectURL(new Blob([texto], { type: 'text/plain;charset=utf-8' }));
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setAbrindo(false);
    }
  };
  return (
    <button type="button" onClick={() => void abrirTexto()} disabled={abrindo} className={className}>
      <span>{abrindo ? 'Abrindo...' : 'Ver texto'}</span>
      <ExternalLink size={tamanho} aria-hidden="true" />
    </button>
  );
}

function formatarTamanhoBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export default function PlacasManuais() {
  const { profile } = useAuth();
  const idBase = useId();

  const papel = profile?.role;
  const atorNome = profile?.full_name || 'Escritório BRV';
  const podeEnviar = ehEscritorioOuAdminPlaca(papel);
  const podeExcluir = papel === 'admin';

  const [busca, setBusca] = useState('');
  const [fabricante, setFabricante] = useState('');

  const [todosManuais, setTodosManuais] = useState<PlacaManual[]>([]);
  const [manuais, setManuais] = useState<PlacaManual[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [chaveRecarga, setChaveRecarga] = useState(0);

  const [avisoSucesso, setAvisoSucesso] = useState<string | null>(null);

  // Modal Enviar Manual (`admin` e `escritorio`)
  const [modalEnviarAberto, setModalEnviarAberto] = useState(false);
  const [novoFabricante, setNovoFabricante] = useState('');
  const [novoTitulo, setNovoTitulo] = useState('');
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  // Modal Excluir (`admin` somente)
  const [manualExcluir, setManualExcluir] = useState<PlacaManual | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    let cancelado = false;
    listarManuais()
      .then((lista) => {
        if (!cancelado) setTodosManuais(lista);
      })
      .catch(() => {
        // silencioso
      });
    return () => {
      cancelado = true;
    };
  }, [chaveRecarga]);

  useEffect(() => {
    let cancelado = false;
    Promise.resolve()
      .then(() => {
        if (cancelado) return null;
        setCarregando(true);
        setErroCarga(null);
        return listarManuais({ busca, fabricante });
      })
      .then((lista) => {
        if (cancelado || !lista) return;
        setManuais(lista);
      })
      .catch((err) => {
        if (!cancelado) {
          setErroCarga(err instanceof Error ? err.message : 'Erro ao carregar manuais.');
        }
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [busca, fabricante, chaveRecarga]);

  const fabricantesDisponiveis = useMemo(() => {
    const unicos = new Set<string>();
    for (const m of todosManuais) {
      if (m.manufacturer.trim()) unicos.add(m.manufacturer.trim());
    }
    return [...unicos].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [todosManuais]);

  const handleEscolherArquivo = (e: ChangeEvent<HTMLInputElement>) => {
    const arq = e.target.files?.[0] ?? null;
    setArquivoSelecionado(arq);
    if (arq && !novoTitulo.trim()) {
      setNovoTitulo(arq.name.replace(/\.(pdf|txt)$/i, '').replace(/[_-]+/g, ' '));
    }
  };

  const handleConfirmarEnvio = async (e: FormEvent) => {
    e.preventDefault();
    setErroEnvio(null);

    if (!novoFabricante.trim()) {
      setErroEnvio('Informe o fabricante do manual.');
      return;
    }
    if (!novoTitulo.trim()) {
      setErroEnvio('Informe o título ou linha de modelos coberta pelo manual.');
      return;
    }
    if (!arquivoSelecionado) {
      setErroEnvio('Selecione um arquivo PDF ou TXT.');
      return;
    }

    setEnviando(true);
    try {
      const criado = await enviarManual(
        arquivoSelecionado,
        { manufacturer: novoFabricante.trim(), title: novoTitulo.trim() },
        atorNome,
      );
      setModalEnviarAberto(false);
      setNovoFabricante('');
      setNovoTitulo('');
      setArquivoSelecionado(null);
      setAvisoSucesso(`Manual "${criado.title}" enviado com sucesso.`);
      setChaveRecarga((c) => c + 1);
    } catch (err) {
      setErroEnvio(err instanceof Error ? err.message : 'Erro ao enviar o manual.');
    } finally {
      setEnviando(false);
    }
  };

  const handleConfirmarExclusao = async () => {
    if (!manualExcluir || !podeExcluir) return;
    setExcluindo(true);
    try {
      await excluirManual(manualExcluir.id, papel ?? 'admin');
      setManualExcluir(null);
      setAvisoSucesso('Manual excluído.');
      setChaveRecarga((c) => c + 1);
    } catch {
      setManualExcluir(null);
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div className="space-y-5">
      <NavegacaoPlacas />

      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brv-navy text-white">
            <FolderOpen size={18} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
              Manuais técnicos
            </h1>
            <p className="text-xs text-slate-500">
              Acervo de manuais de serviço (PDF e TXT) usados na bancada e nas consultas de erro.
            </p>
          </div>
        </div>

        {podeEnviar && (
          <button
            type="button"
            onClick={() => {
              setErroEnvio(null);
              setModalEnviarAberto(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-brv-navy px-4 py-2.5 text-xs font-semibold text-white shadow-2xs hover:bg-slate-800 sm:text-sm"
          >
            <Plus size={16} aria-hidden="true" />
            <span>Enviar manual</span>
          </button>
        )}
      </div>

      {avisoSucesso && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900"
        >
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600" aria-hidden="true" />
            {avisoSucesso}
          </span>
          <button
            type="button"
            onClick={() => setAvisoSucesso(null)}
            className="text-emerald-800 hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Busca e filtro por fabricante */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs md:grid-cols-3">
        <div className="relative md:col-span-2">
          <label htmlFor={`${idBase}-busca`} className="sr-only">
            Buscar manual por fabricante, título ou nome do arquivo
          </label>
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            id={`${idBase}-busca`}
            type="search"
            autoCorrect="off"
            spellCheck={false}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar manual por fabricante, linha, modelo ou arquivo..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50/70 py-2 pr-8 pl-9 text-sm focus:border-blue-600 focus:bg-white focus:outline-none"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca('')}
              aria-label="Limpar busca"
              className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        <div>
          <label htmlFor={`${idBase}-fab`} className="sr-only">
            Filtrar por fabricante
          </label>
          <select
            id={`${idBase}-fab`}
            value={fabricante}
            onChange={(e) => setFabricante(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
          >
            <option value="">Todos os fabricantes</option>
            {fabricantesDisponiveis.map((fab) => (
              <option key={fab} value={fab}>
                {fab}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de manuais */}
      {carregando ? (
        <div className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white py-16 text-slate-500">
          <Loader2 size={24} className="animate-spin text-blue-600" aria-hidden="true" />
          <p className="text-sm font-medium">Carregando manuais técnicos...</p>
        </div>
      ) : erroCarga ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 py-12 text-center"
        >
          <p className="text-sm font-semibold text-rose-900">{erroCarga}</p>
          <button
            type="button"
            onClick={() => setChaveRecarga((c) => c + 1)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span>Tentar de novo</span>
          </button>
        </div>
      ) : manuais.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-slate-200 bg-white py-14 text-center">
          <Inbox size={28} className="text-slate-400" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-800">Nenhum manual encontrado</p>
          <p className="max-w-md text-xs text-slate-500">
            Altere os termos da pesquisa ou envie um novo manual PDF/TXT para alimentar o acervo.
          </p>
        </div>
      ) : (
        <>
          {/* Cartões no celular */}
          <div className="space-y-2.5 md:hidden">
            {manuais.map((m) => (
              <div
                key={m.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-700">
                      {m.manufacturer}
                    </span>
                    <h2 className="text-sm font-bold text-slate-900">{m.title}</h2>
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      m.file_type === 'PDF'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    {m.file_type}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span>{formatarTamanhoBytes(m.file_size_bytes)}</span>
                  <span>·</span>
                  <span>{formatarData(m.created_at)}</span>
                  <span>·</span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      m.has_extracted_text
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    {m.has_extracted_text ? 'Texto extraído' : 'Sem texto extraído'}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                  <AbrirManual
                    manual={m}
                    rotulo="Abrir em nova aba"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    tamanho={13}
                  />

                  {podeExcluir && (
                    <button
                      type="button"
                      onClick={() => setManualExcluir(m)}
                      aria-label={`Excluir ${m.title}`}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Tabela semântica no computador */}
          <div
            role="region"
            aria-label="Lista de manuais técnicos"
            tabIndex={0}
            className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs md:block"
          >
            <table className="w-full text-left text-xs">
              <caption className="sr-only">
                Manuais técnicos de fabricantes com formato, tamanho, situação de extração de texto e ações
              </caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Fabricante
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Título / Modelo
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Tipo
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold text-right">
                    Tamanho
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Data
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Indexação IA
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {manuais.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-bold text-blue-800">{m.manufacturer}</td>
                    <th scope="row" className="px-4 py-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <FileText size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
                        <div>
                          <p>{m.title}</p>
                          <p className="font-mono text-[11px] font-normal text-slate-400">
                            {m.file_name}
                          </p>
                        </div>
                      </div>
                    </th>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          m.file_type === 'PDF'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {m.file_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-slate-600">
                      {formatarTamanhoBytes(m.file_size_bytes)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {formatarData(m.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                          m.has_extracted_text
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-amber-200 bg-amber-50 text-amber-800'
                        }`}
                      >
                        {m.has_extracted_text ? 'Texto extraído' : 'Sem texto extraído'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <AbrirManual
                          manual={m}
                          rotulo="Abrir"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          tamanho={12}
                        />
                        {podeExcluir && (
                          <button
                            type="button"
                            onClick={() => setManualExcluir(m)}
                            aria-label={`Excluir ${m.title}`}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal: Enviar manual */}
      <ModalDialogoPlacas
        aberto={modalEnviarAberto}
        onFechar={() => setModalEnviarAberto(false)}
        titulo="Enviar manual técnico"
        subtitulo="O arquivo ficará disponível para consulta na bancada e extração de texto para códigos de erro."
        fecharAoClicarFora={false}
      >
        <form onSubmit={handleConfirmarEnvio} noValidate className="space-y-4">
          <div>
            <label
              htmlFor={`${idBase}-env-fab`}
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Fabricante *
            </label>
            <input
              id={`${idBase}-env-fab`}
              type="text"
              value={novoFabricante}
              onChange={(e) => setNovoFabricante(e.target.value)}
              placeholder="Ex.: Midea, LG, Daikin, Samsung"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor={`${idBase}-env-tit`}
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Título / Linha de modelos *
            </label>
            <input
              id={`${idBase}-env-tit`}
              type="text"
              value={novoTitulo}
              onChange={(e) => setNovoTitulo(e.target.value)}
              placeholder="Ex.: Manual de Serviço Dual Inverter Voice 9k-24k R-32"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <span className="mb-1 block text-xs font-semibold text-slate-700">
              Arquivo PDF ou TXT *
            </span>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs hover:border-blue-400">
              <span className="truncate font-medium text-slate-700">
                {arquivoSelecionado
                  ? `${arquivoSelecionado.name} (${formatarTamanhoBytes(arquivoSelecionado.size)})`
                  : 'Clique para selecionar arquivo .pdf ou .txt (máx. 20 MB)'}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1 font-semibold text-blue-700 shadow-2xs">
                <Upload size={13} aria-hidden="true" />
                Escolher
              </span>
              <input
                type="file"
                accept=".pdf,.txt,application/pdf,text/plain"
                onChange={handleEscolherArquivo}
                className="sr-only"
              />
            </label>
          </div>

          {erroEnvio && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-800"
            >
              {erroEnvio}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalEnviarAberto(false)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brv-navy px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {enviando && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              <span>Enviar manual</span>
            </button>
          </div>
        </form>
      </ModalDialogoPlacas>

      {/* Modal: Excluir manual (`admin` somente) */}
      <ModalDialogoPlacas
        aberto={!!manualExcluir}
        onFechar={() => setManualExcluir(null)}
        titulo="Excluir manual técnico?"
      >
        {manualExcluir && (
          <div className="space-y-4 text-sm text-slate-700">
            <p>
              Confirma a exclusão de{' '}
              <strong>
                {manualExcluir.manufacturer} — {manualExcluir.title}
              </strong>
              ?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setManualExcluir(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={excluindo}
                onClick={() => void handleConfirmarExclusao()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {excluindo && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
                <span>Excluir manual</span>
              </button>
            </div>
          </div>
        )}
      </ModalDialogoPlacas>
    </div>
  );
}

