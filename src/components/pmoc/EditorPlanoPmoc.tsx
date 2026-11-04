import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CalendarCheck2,
  CalendarRange,
  CheckCircle2,
  FileText,
  Layers,
  Loader2,
  Printer,
  RefreshCw,
  Save,
  Settings2,
  Snowflake,
  X,
} from 'lucide-react';
import AbaAmbientesPmoc from './AbaAmbientesPmoc';
import AbaCronogramaPmoc from './AbaCronogramaPmoc';
import AbaEquipamentosPmoc from './AbaEquipamentosPmoc';
import AbaExecucaoPmoc from './AbaExecucaoPmoc';
import AbaGeralPmoc from './AbaGeralPmoc';
import DocumentoPmoc from './DocumentoPmoc';
import FaixaDadosDemo from './FaixaDadosDemo';
import { EMPRESA_BRV } from './empresa';
import {
  buscarCronograma,
  buscarPlano,
  listarAmbientes,
  listarEquipamentosDoPlano,
  listarExecucoes,
  listarModelosDeTarefa,
  salvarAmbientes,
  salvarCronograma,
  salvarEquipamentosDoPlano,
  salvarPlano,
} from './fonteDeDados';
import {
  calcularSituacaoPlano,
  hojeLocalIso,
  rotuloTermoResponsabilidade,
  sugerirFimVigencia,
} from './regrasPmoc';
import type {
  PmocEnvironment,
  PmocEquipmentMonthExecution,
  PmocEquipmentTask,
  PmocPlan,
  PmocPlanEquipment,
  PmocTaskTemplate,
} from '../../types/pmoc';
import { documentoValido } from '../../utils/documento';

export type AbaEditorPmoc =
  | 'geral'
  | 'ambientes'
  | 'equipamentos'
  | 'cronograma'
  | 'execucao'
  | 'documento';

interface EditorPlanoPmocProps {
  /** ID do plano existente na URL (`/pmoc/:id`), ou `null` em `/pmoc/novo`. */
  planIdUrl: string | null;
}

function criarPlanoVazio(): PmocPlan {
  const hoje = hojeLocalIso();
  const agora = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    code: 'Novo plano',
    customer_id: '',
    customer_name: '',
    customer_trade_name: null,
    customer_person_type: 'PJ',
    customer_document: null,
    customer_email: null,
    customer_phone: null,
    address_id: null,
    address_snapshot: null,
    start_date: hoje,
    end_date: sugerirFimVigencia(hoje),
    status: 'rascunho',
    responsible_employee_id: null,
    responsible_name: '',
    responsible_cpf: null,
    responsible_email: EMPRESA_BRV.email,
    responsible_phone: EMPRESA_BRV.telefone,
    registration_type: 'CFT',
    registration_number: '',
    responsibility_term_number: '',
    trt_attachment_url: null,
    trt_attachment_name: null,
    trt_attachment_mime: null,
    elaborated_by: EMPRESA_BRV.razaoSocial,
    notes: null,
    created_at: agora,
    updated_at: agora,
  };
}

export default function EditorPlanoPmoc({ planIdUrl }: EditorPlanoPmocProps) {
  const navigate = useNavigate();

  const [idSalvo, setIdSalvo] = useState<string | null>(planIdUrl);
  const ehNovo = idSalvo === null;

  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [planoInexistente, setPlanoInexistente] = useState(false);

  const [plano, setPlano] = useState<PmocPlan>(criarPlanoVazio);
  const [ambientes, setAmbientes] = useState<PmocEnvironment[]>([]);
  const [equipamentos, setEquipamentos] = useState<PmocPlanEquipment[]>([]);
  const [tarefas, setTarefas] = useState<PmocEquipmentTask[]>([]);
  const [execucoes, setExecucoes] = useState<PmocEquipmentMonthExecution[]>([]);
  const [modelos, setModelos] = useState<PmocTaskTemplate[]>([]);

  const [abaAtiva, setAbaAtiva] = useState<AbaEditorPmoc>('geral');
  const [temAlteracoes, setTemAlteracoes] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroFormulario, setErroFormulario] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [modalDocumentoAberto, setModalDocumentoAberto] = useState(false);

  // Carrega dados iniciais sem chamar setState de forma síncrona no corpo do efeito
  useEffect(() => {
    let ativo = true;

    if (!planIdUrl) {
      listarModelosDeTarefa()
        .then((listaModelos) => {
          if (!ativo) return;
          setModelos(listaModelos);
        })
        .catch((e) => {
          if (!ativo) return;
          setErroCarregar(
            e instanceof Error ? e.message : 'Não foi possível carregar os modelos de tarefas.',
          );
        })
        .finally(() => {
          if (ativo) setCarregando(false);
        });

      return () => {
        ativo = false;
      };
    }

    Promise.all([
      buscarPlano(planIdUrl),
      listarAmbientes(planIdUrl),
      listarEquipamentosDoPlano(planIdUrl),
      buscarCronograma(planIdUrl),
      listarExecucoes(planIdUrl),
      listarModelosDeTarefa(),
    ])
      .then(([planoEncontrado, ambs, eqs, tars, execs, listaModelos]) => {
        if (!ativo) return;
        if (!planoEncontrado) {
          setPlanoInexistente(true);
          return;
        }
        setIdSalvo(planoEncontrado.id);
        setPlano(planoEncontrado);
        setAmbientes(ambs);
        setEquipamentos(eqs);
        setTarefas(tars);
        setExecucoes(execs);
        setModelos(listaModelos);
      })
      .catch((e) => {
        if (!ativo) return;
        setErroCarregar(
          e instanceof Error ? e.message : 'Não foi possível carregar os dados deste plano PMOC.',
        );
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [planIdUrl]);

  const tentarCarregarNovamente = () => {
    setCarregando(true);
    setErroCarregar(null);
    setPlanoInexistente(false);

    if (!planIdUrl) {
      listarModelosDeTarefa()
        .then((listaModelos) => setModelos(listaModelos))
        .catch((e) =>
          setErroCarregar(
            e instanceof Error ? e.message : 'Não foi possível carregar os modelos de tarefas.',
          ),
        )
        .finally(() => setCarregando(false));
      return;
    }

    Promise.all([
      buscarPlano(planIdUrl),
      listarAmbientes(planIdUrl),
      listarEquipamentosDoPlano(planIdUrl),
      buscarCronograma(planIdUrl),
      listarExecucoes(planIdUrl),
      listarModelosDeTarefa(),
    ])
      .then(([planoEncontrado, ambs, eqs, tars, execs, listaModelos]) => {
        if (!planoEncontrado) {
          setPlanoInexistente(true);
          return;
        }
        setIdSalvo(planoEncontrado.id);
        setPlano(planoEncontrado);
        setAmbientes(ambs);
        setEquipamentos(eqs);
        setTarefas(tars);
        setExecucoes(execs);
        setModelos(listaModelos);
      })
      .catch((e) =>
        setErroCarregar(
          e instanceof Error ? e.message : 'Não foi possível carregar os dados deste plano PMOC.',
        ),
      )
      .finally(() => setCarregando(false));
  };

  // Proteção contra fechamento/atualização acidental da aba do navegador
  useEffect(() => {
    if (!temAlteracoes) return;
    const aoSairDaJanela = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
      evento.returnValue = '';
    };
    window.addEventListener('beforeunload', aoSairDaJanela);
    return () => window.removeEventListener('beforeunload', aoSairDaJanela);
  }, [temAlteracoes]);

  const confirmarSaidaSeNecessario = useCallback((): boolean => {
    if (!temAlteracoes) return true;
    return window.confirm(
      'Existem alterações não salvas neste plano PMOC. Deseja sair mesmo assim?',
    );
  }, [temAlteracoes]);

  const navegarComConfirmacao = (destino: string) => {
    if (!confirmarSaidaSeNecessario()) return;
    navigate(destino);
  };

  const atualizarPlano = (parcial: Partial<PmocPlan>) => {
    setPlano((anterior) => ({ ...anterior, ...parcial }));
    setTemAlteracoes(true);
    setMensagemSucesso(null);
  };

  const atualizarAmbientes = (novosAmbientes: PmocEnvironment[]) => {
    const idsMantidos = new Set(novosAmbientes.map((a) => a.id));
    setAmbientes(novosAmbientes);
    // Se um ambiente foi removido, limpa imediatamente o vínculo nos equipamentos do rascunho
    setEquipamentos((atuais) =>
      atuais.map((eq) =>
        eq.environment_id && !idsMantidos.has(eq.environment_id)
          ? { ...eq, environment_id: null }
          : eq,
      ),
    );
    setTemAlteracoes(true);
    setMensagemSucesso(null);
  };

  const atualizarEquipamentos = (novosEquipamentos: PmocPlanEquipment[]) => {
    const idsMantidos = new Set(novosEquipamentos.map((e) => e.id));
    setEquipamentos(novosEquipamentos);
    // Remove do rascunho as tarefas de aparelhos excluídos
    setTarefas((atuais) => atuais.filter((t) => idsMantidos.has(t.plan_equipment_id)));
    setTemAlteracoes(true);
    setMensagemSucesso(null);
  };

  const inicializarTarefasDosNovosEquipamentos = (adicionados: PmocPlanEquipment[]) => {
    if (adicionados.length === 0 || modelos.length === 0) return;

    setTarefas((atuais) => {
      const jaComTarefa = new Set(atuais.map((t) => t.plan_equipment_id));
      const criadas: PmocEquipmentTask[] = [];

      for (const eq of adicionados) {
        if (jaComTarefa.has(eq.id)) continue;
        const tipoNorm = eq.equipment_type.trim().toLowerCase();
        const modelo =
          modelos.find((m) => m.equipment_type.trim().toLowerCase() === tipoNorm) ?? modelos[0];
        if (!modelo) continue;

        modelo.tasks.forEach((item, idx) => {
          criadas.push({
            id: crypto.randomUUID(),
            plan_id: plano.id,
            plan_equipment_id: eq.id,
            template_item_id: item.id,
            description: item.description,
            periodicity: item.periodicity,
            start_month_offset: item.relative_start_month,
            requires_measurement: item.requires_measurement,
            measurement_fields: [...item.measurement_fields],
            sort_order: idx + 1,
            active: true,
          });
        });
      }

      return criadas.length > 0 ? [...atuais, ...criadas] : atuais;
    });
  };

  const atualizarTarefas = (novasTarefas: PmocEquipmentTask[]) => {
    setTarefas(novasTarefas);
    setTemAlteracoes(true);
    setMensagemSucesso(null);
  };

  const recarregarExecucoes = useCallback(async () => {
    if (!idSalvo) return;
    const lista = await listarExecucoes(idSalvo);
    setExecucoes(lista);
  }, [idSalvo]);

  // Validação completa em português antes de persistir
  const validarAntesDeSalvar = (): { erro: string; aba: AbaEditorPmoc } | null => {
    if (!plano.customer_id || !plano.customer_name.trim()) {
      return { erro: 'Selecione o cliente contratante do plano na aba Geral.', aba: 'geral' };
    }

    if (
      plano.customer_document &&
      !documentoValido(plano.customer_document, plano.customer_person_type)
    ) {
      return {
        erro: 'O CPF ou CNPJ do cliente informado na aba Geral não é válido.',
        aba: 'geral',
      };
    }

    if (!plano.start_date || !plano.end_date) {
      return {
        erro: 'Preencha as datas de início e fim da vigência na aba Geral.',
        aba: 'geral',
      };
    }

    if (plano.end_date < plano.start_date) {
      return {
        erro: 'A data de fim da vigência não pode ser anterior à data de início.',
        aba: 'geral',
      };
    }

    if (plano.responsible_cpf && !documentoValido(plano.responsible_cpf, 'PF')) {
      return {
        erro: 'O CPF do responsável técnico informado na aba Geral não é válido.',
        aba: 'geral',
      };
    }

    if (plano.status !== 'rascunho') {
      if (!plano.address_snapshot || !plano.address_snapshot.street.trim()) {
        return {
          erro: 'Selecione o endereço atendido pelo plano antes de marcá-lo como vigente.',
          aba: 'geral',
        };
      }
      if (!plano.responsible_name.trim()) {
        return {
          erro: 'Informe o nome do responsável técnico na aba Geral.',
          aba: 'geral',
        };
      }
      if (!plano.registration_number.trim()) {
        return {
          erro: `Informe o número do registro no ${plano.registration_type} na aba Geral.`,
          aba: 'geral',
        };
      }
      if (!plano.responsibility_term_number.trim()) {
        return {
          erro: `Informe o número do ${rotuloTermoResponsabilidade(plano.registration_type)} na aba Geral.`,
          aba: 'geral',
        };
      }
    }

    // Validação da aba Ambientes
    const nomesAmbientes = new Set<string>();
    const siglasAmbientes = new Set<string>();

    for (let i = 0; i < ambientes.length; i++) {
      const amb = ambientes[i];
      const nomeLimpo = amb.name.trim();
      const siglaLimpa = amb.code.trim().toUpperCase();

      if (!nomeLimpo) {
        return {
          erro: `Preencha o nome do ambiente na linha ${i + 1} (aba Ambientes).`,
          aba: 'ambientes',
        };
      }
      if (!/^[A-Z]{2,3}$/.test(siglaLimpa)) {
        return {
          erro: `O ambiente "${nomeLimpo}" precisa de uma sigla de 2 a 3 letras (ex.: SR, REC).`,
          aba: 'ambientes',
        };
      }

      const chaveNome = nomeLimpo.toLowerCase();
      if (nomesAmbientes.has(chaveNome)) {
        return {
          erro: `O nome de ambiente "${nomeLimpo}" está repetido. Cada ambiente deve ter nome único no plano.`,
          aba: 'ambientes',
        };
      }
      nomesAmbientes.add(chaveNome);

      if (siglasAmbientes.has(siglaLimpa)) {
        return {
          erro: `A sigla "${siglaLimpa}" está repetida em mais de um ambiente. Use siglas diferentes para evitar colisão nos códigos dos aparelhos.`,
          aba: 'ambientes',
        };
      }
      siglasAmbientes.add(siglaLimpa);
    }

    // Validação da aba Equipamentos
    const codigosEquipamentos = new Set<string>();
    const idsAmbientesValidos = new Set(ambientes.map((a) => a.id));

    for (let i = 0; i < equipamentos.length; i++) {
      const eq = equipamentos[i];
      const nomeLimpo = eq.name.trim();
      const tipoLimpo = eq.equipment_type.trim();
      const codigoLimpo = eq.identifier.trim().toUpperCase();

      if (!nomeLimpo) {
        return {
          erro: `Preencha o nome do equipamento na linha ${i + 1} (aba Equipamentos).`,
          aba: 'equipamentos',
        };
      }
      if (!tipoLimpo) {
        return {
          erro: `Informe o tipo do equipamento "${nomeLimpo}" (aba Equipamentos).`,
          aba: 'equipamentos',
        };
      }
      if (!codigoLimpo) {
        return {
          erro: `Informe o identificador (ex.: AR-SR-0001) do equipamento "${nomeLimpo}".`,
          aba: 'equipamentos',
        };
      }
      if (codigosEquipamentos.has(codigoLimpo)) {
        return {
          erro: `O identificador "${codigoLimpo}" está duplicado no plano. Cada equipamento deve ter um código único.`,
          aba: 'equipamentos',
        };
      }
      codigosEquipamentos.add(codigoLimpo);

      if (
        plano.status === 'vigente' &&
        eq.active &&
        (!eq.environment_id || !idsAmbientesValidos.has(eq.environment_id))
      ) {
        return {
          erro: `Escolha o ambiente do equipamento "${nomeLimpo}" antes de salvar o plano como vigente.`,
          aba: 'equipamentos',
        };
      }
    }

    // Validação da aba Cronograma
    const idsEquipamentosAtivos = new Set(equipamentos.filter((e) => e.active).map((e) => e.id));
    for (const tarefa of tarefas) {
      if (!idsEquipamentosAtivos.has(tarefa.plan_equipment_id)) continue;
      if (tarefa.active && !tarefa.description.trim()) {
        return {
          erro: 'Preencha a descrição de todas as tarefas ativas no cronograma (ou desative a tarefa em branco).',
          aba: 'cronograma',
        };
      }
    }

    return null;
  };

  const handleSalvar = async () => {
    if (salvando) return;
    setErroFormulario(null);
    setMensagemSucesso(null);

    const falha = validarAntesDeSalvar();
    if (falha) {
      setErroFormulario(falha.erro);
      setAbaAtiva(falha.aba);
      return;
    }

    setSalvando(true);
    try {
      const planoGravado = await salvarPlano({
        id: idSalvo ?? undefined,
        customer_id: plano.customer_id,
        customer_name: plano.customer_name.trim(),
        customer_trade_name: plano.customer_trade_name?.trim() || null,
        customer_person_type: plano.customer_person_type,
        customer_document: plano.customer_document?.trim() || null,
        customer_email: plano.customer_email?.trim() || null,
        customer_phone: plano.customer_phone?.trim() || null,
        address_id: plano.address_id,
        address_snapshot: plano.address_snapshot,
        start_date: plano.start_date,
        end_date: plano.end_date,
        status: plano.status,
        responsible_employee_id: plano.responsible_employee_id,
        responsible_name: plano.responsible_name.trim(),
        responsible_cpf: plano.responsible_cpf?.trim() || null,
        responsible_email: plano.responsible_email?.trim() || null,
        responsible_phone: plano.responsible_phone?.trim() || null,
        registration_type: plano.registration_type,
        registration_number: plano.registration_number.trim(),
        responsibility_term_number: plano.responsibility_term_number.trim(),
        trt_attachment_url: plano.trt_attachment_url,
        trt_attachment_name: plano.trt_attachment_name,
        trt_attachment_mime: plano.trt_attachment_mime,
        elaborated_by: plano.elaborated_by.trim() || EMPRESA_BRV.razaoSocial,
        notes: plano.notes?.trim() || null,
      });

      const idDefinitivo = planoGravado.id;

      const ambientesGravados = await salvarAmbientes(
        idDefinitivo,
        ambientes.map((a) => ({
          id: a.id,
          name: a.name,
          code: a.code,
          fixed_occupants: a.fixed_occupants,
          floating_occupants: a.floating_occupants,
          area_m2: a.area_m2,
        })),
      );

      const equipamentosGravados = await salvarEquipamentosDoPlano(
        idDefinitivo,
        equipamentos.map((eq) => ({
          id: eq.id,
          equipment_id: eq.equipment_id,
          environment_id: eq.environment_id,
          equipment_type: eq.equipment_type,
          name: eq.name,
          brand: eq.brand,
          model: eq.model,
          serial_number: eq.serial_number,
          capacity_btu: eq.capacity_btu,
          identifier: eq.identifier,
          photo_url: eq.photo_url,
          photo_attachment_id: eq.photo_attachment_id,
          active: eq.active,
        })),
      );

      // Se já existirem tarefas editadas na tela, grava-as; caso contrário busca as inicializadas pela camada
      let tarefasGravadas: PmocEquipmentTask[];
      if (tarefas.length > 0) {
        tarefasGravadas = await salvarCronograma(
          idDefinitivo,
          tarefas.map((t) => ({ ...t, plan_id: idDefinitivo })),
        );
      } else {
        tarefasGravadas = await buscarCronograma(idDefinitivo);
      }

      const eraNovo = idSalvo === null;
      setIdSalvo(idDefinitivo);
      setPlano(planoGravado);
      setAmbientes(ambientesGravados);
      setEquipamentos(equipamentosGravados);
      setTarefas(tarefasGravadas);
      setTemAlteracoes(false);
      setMensagemSucesso('Plano PMOC salvo com sucesso.');

      if (eraNovo) {
        navigate(`/pmoc/${idDefinitivo}`, { replace: true });
      }
    } catch (e) {
      setErroFormulario(
        e instanceof Error
          ? e.message
          : 'Não foi possível salvar o plano PMOC. Verifique os dados e tente de novo.',
      );
    } finally {
      setSalvando(false);
    }
  };

  const infoSituacao = useMemo(
    () => calcularSituacaoPlano(plano.status, plano.end_date),
    [plano.end_date, plano.status],
  );

  const qtdSemAmbiente = useMemo(() => {
    const idsAmb = new Set(ambientes.map((a) => a.id));
    return equipamentos.filter(
      (e) => e.active && (!e.environment_id || !idsAmb.has(e.environment_id)),
    ).length;
  }, [ambientes, equipamentos]);

  if (carregando) {
    return (
      <div className="space-y-4">
        <FaixaDadosDemo />
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-20 text-slate-500">
          <Loader2 size={28} className="animate-spin text-blue-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">Carregando plano PMOC...</p>
        </div>
      </div>
    );
  }

  if (erroCarregar) {
    return (
      <div className="space-y-4">
        <FaixaDadosDemo />
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <AlertCircle size={32} className="mx-auto text-rose-600" aria-hidden="true" />
          <h2 className="mt-2 text-base font-semibold text-rose-900">
            Falha ao carregar o plano PMOC
          </h2>
          <p className="mt-1 text-sm text-rose-700">{erroCarregar}</p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/pmoc')}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Voltar para a lista
            </button>
            <button
              type="button"
              onClick={tentarCarregarNovamente}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
            >
              <RefreshCw size={14} aria-hidden="true" />
              Tentar de novo
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (planoInexistente) {
    return (
      <div className="space-y-4">
        <FaixaDadosDemo />
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <FileText size={36} className="mx-auto text-slate-300" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold text-slate-900">
            Plano PMOC não encontrado
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            O plano solicitado não existe ou foi removido desta sessão.
          </p>
          <button
            type="button"
            onClick={() => navigate('/pmoc')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brv-navy px-4 py-2 text-xs font-semibold text-white hover:bg-brv-navy-light"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Voltar para os planos PMOC
          </button>
        </div>
      </div>
    );
  }

  const abas: Array<{
    id: AbaEditorPmoc;
    rotulo: string;
    icone: typeof Settings2;
    contador?: number;
    alerta?: boolean;
  }> = [
    { id: 'geral', rotulo: 'Geral', icone: Settings2 },
    { id: 'ambientes', rotulo: 'Ambientes', icone: Layers, contador: ambientes.length },
    {
      id: 'equipamentos',
      rotulo: 'Equipamentos',
      icone: Snowflake,
      contador: equipamentos.filter((e) => e.active).length,
      alerta: qtdSemAmbiente > 0,
    },
    { id: 'cronograma', rotulo: 'Cronograma', icone: CalendarRange },
    { id: 'execucao', rotulo: 'Execução', icone: CalendarCheck2 },
    { id: 'documento', rotulo: 'Documento', icone: FileText },
  ];

  return (
    <div className="space-y-4 pb-10">
      <FaixaDadosDemo />

      {/* Cabeçalho do editor */}
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5 print:hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => navegarComConfirmacao('/pmoc')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Planos PMOC
            </button>

            <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
              <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">
                {plano.customer_name.trim() || 'Novo plano PMOC'}
              </h1>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${infoSituacao.classeSelo}`}
              >
                {infoSituacao.rotulo}
              </span>
              {temAlteracoes && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
                  Alterações não salvas
                </span>
              )}
            </div>

            <p className="mt-0.5 text-xs text-slate-500">
              <span className="font-mono font-medium text-slate-700">{plano.code}</span>
              {plano.address_snapshot
                ? ` · ${plano.address_snapshot.street}${plano.address_snapshot.number ? `, ${plano.address_snapshot.number}` : ''} — ${plano.address_snapshot.city}/${plano.address_snapshot.state}`
                : ' · Endereço ainda não selecionado'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setModalDocumentoAberto(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            >
              <Printer size={15} aria-hidden="true" />
              Documento (imprimir/PDF)
            </button>

            <button
              type="button"
              disabled={salvando}
              onClick={() => void handleSalvar()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brv-navy px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-brv-navy-light focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {salvando ? (
                <>
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save size={15} aria-hidden="true" />
                  Salvar
                </>
              )}
            </button>
          </div>
        </div>

        {/* Alertas de validação ou confirmação de gravação */}
        {erroFormulario && (
          <div
            role="alert"
            className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"
          >
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-600" aria-hidden="true" />
              <span className="font-medium">{erroFormulario}</span>
            </div>
            <button
              type="button"
              onClick={() => setErroFormulario(null)}
              aria-label="Fechar mensagem de erro"
              className="rounded p-0.5 hover:bg-rose-100"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}

        {mensagemSucesso && (
          <div
            role="status"
            className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-600" aria-hidden="true" />
              <span className="font-medium">{mensagemSucesso}</span>
            </div>
            <button
              type="button"
              onClick={() => setMensagemSucesso(null)}
              aria-label="Fechar aviso de confirmação"
              className="rounded p-0.5 hover:bg-emerald-100"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Navegação por abas */}
        <div
          role="tablist"
          aria-label="Seções do plano PMOC"
          className="mt-4 flex gap-1 overflow-x-auto border-t border-slate-100 pt-3"
        >
          {abas.map((aba) => {
            const Icone = aba.icone;
            const selecionada = abaAtiva === aba.id;
            return (
              <button
                key={aba.id}
                type="button"
                role="tab"
                id={`pmoc-tab-${aba.id}`}
                aria-selected={selecionada}
                aria-controls={`pmoc-painel-${aba.id}`}
                onClick={() => setAbaAtiva(aba.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                  selecionada
                    ? 'bg-brv-navy text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icone size={14} aria-hidden="true" />
                <span>{aba.rotulo}</span>
                {aba.contador !== undefined && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      selecionada ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                    }`}
                  >
                    {aba.contador}
                  </span>
                )}
                {aba.alerta && (
                  <AlertTriangle
                    size={13}
                    className={selecionada ? 'text-amber-300' : 'text-amber-500'}
                    aria-label="Há equipamentos sem ambiente selecionado"
                  />
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Conteúdo da aba ativa */}
      <div
        role="tabpanel"
        id={`pmoc-painel-${abaAtiva}`}
        aria-labelledby={`pmoc-tab-${abaAtiva}`}
      >
        {abaAtiva === 'geral' && (
          <AbaGeralPmoc
            plano={plano}
            onChange={atualizarPlano}
            onErroUpload={(msg) => setErroFormulario(msg)}
          />
        )}

        {abaAtiva === 'ambientes' && (
          <AbaAmbientesPmoc
            planId={plano.id}
            ambientes={ambientes}
            onChange={atualizarAmbientes}
          />
        )}

        {abaAtiva === 'equipamentos' && (
          <AbaEquipamentosPmoc
            planId={plano.id}
            customerId={plano.customer_id}
            ambientes={ambientes}
            equipamentos={equipamentos}
            onChange={atualizarEquipamentos}
            onInicializarTarefasDosNovos={inicializarTarefasDosNovosEquipamentos}
            onIrCadastroEquipamentos={() => navegarComConfirmacao('/equipamentos')}
            onErro={(msg) => setErroFormulario(msg)}
          />
        )}

        {abaAtiva === 'cronograma' && (
          <AbaCronogramaPmoc
            planId={plano.id}
            startDate={plano.start_date}
            equipamentos={equipamentos}
            tarefas={tarefas}
            modelos={modelos}
            onChange={atualizarTarefas}
          />
        )}

        {abaAtiva === 'execucao' && (
          <AbaExecucaoPmoc
            planId={plano.id}
            ehNovo={ehNovo}
            temAlteracoesNaoSalvas={temAlteracoes}
            startDate={plano.start_date}
            ambientes={ambientes}
            equipamentos={equipamentos}
            tarefas={tarefas}
            execucoes={execucoes}
            onRecarregarExecucoes={recarregarExecucoes}
          />
        )}

        {abaAtiva === 'documento' && (
          <DocumentoPmoc
            plano={plano}
            ambientes={ambientes}
            equipamentos={equipamentos}
            tarefas={tarefas}
            modo="embutido"
            ativarPortalImpressao={!modalDocumentoAberto}
          />
        )}
      </div>

      {/* Modal em tela cheia para visualização/impressão A4 a partir do botão do cabeçalho */}
      {modalDocumentoAberto && (
        <DocumentoPmoc
          plano={plano}
          ambientes={ambientes}
          equipamentos={equipamentos}
          tarefas={tarefas}
          modo="modal"
          onFechar={() => setModalDocumentoAberto(false)}
        />
      )}
    </div>
  );
}

