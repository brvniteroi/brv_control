import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { carregarDashboard, type DadosDashboard } from '../services/dashboard';
import CardsResumo from '../components/dashboard/CardsResumo';
import AtividadesHoje from '../components/dashboard/AtividadesHoje';
import PrecisamAtencao from '../components/dashboard/PrecisamAtencao';

function formatarDataHojeExtenso(): string {
  try {
    const formatador = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' });
    const texto = formatador.format(new Date());
    // Coloca a primeira letra maiúscula (ex.: "Quinta-feira, 29 de outubro de 2026")
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  } catch {
    return '';
  }
}

export default function Dashboard() {
  const { profile, user } = useAuth();
  const [dados, setDados] = useState<DadosDashboard | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const primeiroNome =
    profile?.full_name?.trim().split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'Usuário';

  const buscarDados = (ehRecarregamento: boolean) => {
    if (ehRecarregamento) {
      setAtualizando(true);
    } else {
      setCarregando(true);
    }
    setErro(null);

    carregarDashboard()
      .then((resultado) => {
        setDados(resultado);
      })
      .catch((err) => {
        console.error('Erro ao buscar dados do dashboard:', err);
        setErro(
          'Não foi possível carregar os dados do dashboard. Verifique sua conexão e tente novamente.',
        );
      })
      .finally(() => {
        setCarregando(false);
        setAtualizando(false);
      });
  };

  useEffect(() => {
    let ativo = true;

    carregarDashboard()
      .then((resultado) => {
        if (!ativo) return;
        setDados(resultado);
      })
      .catch((err) => {
        if (!ativo) return;
        console.error('Erro ao carregar dashboard:', err);
        setErro(
          'Não foi possível carregar os dados do dashboard. Verifique sua conexão e tente novamente.',
        );
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const dataHoje = formatarDataHojeExtenso();

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Olá, {primeiroNome}
          </h1>
          {dataHoje && <p className="mt-1 text-xs text-slate-500">{dataHoje}</p>}
        </div>

        <button
          type="button"
          onClick={() => buscarDados(true)}
          disabled={carregando || atualizando}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={`text-slate-500 ${atualizando ? 'animate-spin' : ''}`}
          />
          {atualizando ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {/* Estado de Erro */}
      {erro && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-red-600" />
            <span>{erro}</span>
          </div>
          <button
            type="button"
            onClick={() => buscarDados(false)}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 font-semibold text-red-700 transition hover:bg-red-100"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {/* Estado Carregando */}
      {carregando ? (
        <div className="flex h-72 w-full items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <span className="text-xs font-medium">Carregando painel do dia...</span>
          </div>
        </div>
      ) : dados ? (
        <>
          {/* Cartões Numéricos e Resumo de OS */}
          <CardsResumo resumo={dados.resumo} />

          {/* Seções em Duas Colunas (Atividades de Hoje e Precisam de Atenção) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <AtividadesHoje atividades={dados.atividadesHoje} />
            <PrecisamAtencao ordens={dados.precisamAtencao} />
          </div>
        </>
      ) : null}
    </div>
  );
}
