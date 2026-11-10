import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import LinhaDoTempo from './pages/LinhaDoTempo';
import Calendario from './pages/Calendario';
import Mapa from './pages/Mapa';
import Equipe from './pages/Equipe';
import OrdensServico from './pages/OrdensServico';
import Estoque from './pages/Estoque';
import Oficina from './pages/Oficina';
import Equipamentos from './pages/Equipamentos';
import Formularios from './pages/Formularios';
import TiposServico from './pages/TiposServico';
import Etiquetas from './pages/Etiquetas';
import Cargos from './pages/Cargos';
import RelatorioAtividades from './pages/RelatorioAtividades';
import RelatorioGraficos from './pages/RelatorioGraficos';
import RelatorioTiposServico from './pages/RelatorioTiposServico';
import RelatorioGarantia from './pages/RelatorioGarantia';
import Pmoc from './pages/Pmoc';
import PmocEditorPage from './pages/PmocEditorPage';
import PmocModelo from './pages/PmocModelo';
import PlacasKanban from './pages/PlacasKanban';
import PlacasClientes from './pages/PlacasClientes';
import PlacasFinanceiro from './pages/PlacasFinanceiro';
import PlacasFichas from './pages/PlacasFichas';
import PlacasErros from './pages/PlacasErros';
import PlacasAssistente from './pages/PlacasAssistente';
import PlacasManuais from './pages/PlacasManuais';
import AcompanhamentoPlaca from './pages/AcompanhamentoPlaca';
import PortalRoute from './components/portal/PortalRoute';
import Avaliar from './pages/Avaliar';
import Ajuda from './pages/Ajuda';
import PortalLogin from './pages/portal/PortalLogin';
import PortalHome from './pages/portal/PortalHome';
import CampoLayout from './components/campo/CampoLayout';
import CampoAgenda from './pages/campo/CampoAgenda';
import CampoAtividade from './pages/campo/CampoAtividade';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/portal/login" element={<PortalLogin />} />
        {/* Avaliação do atendimento: pública, o cliente abre pelo link do WhatsApp */}
        <Route path="/avaliar/:token" element={<Avaliar />} />
        {/* Acompanhamento público de reparo de placa (sem login, link do comprovante) */}
        <Route path="/placa/:token" element={<AcompanhamentoPlaca />} />
        <Route path="/portal" element={<PortalRoute />}>
          <Route index element={<PortalHome />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          {/* App do técnico (celular) */}
          <Route path="campo" element={<CampoLayout />}>
            <Route index element={<CampoAgenda />} />
            <Route path="atividade/:id" element={<CampoAtividade />} />
          </Route>

          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="linha-do-tempo" element={<LinhaDoTempo />} />
            <Route path="calendario" element={<Calendario />} />
            <Route path="mapa" element={<Mapa />} />
            <Route path="ordens-de-servico" element={<OrdensServico />} />
            <Route path="pmoc" element={<Pmoc />} />
            <Route path="pmoc/modelo" element={<PmocModelo />} />
            <Route path="pmoc/novo" element={<PmocEditorPage />} />
            <Route path="pmoc/:id" element={<PmocEditorPage />} />
            <Route path="estoque" element={<Estoque />} />
            <Route path="oficina" element={<Oficina />} />
            <Route path="placas" element={<PlacasKanban />} />
            <Route path="placas/clientes" element={<PlacasClientes />} />
            <Route path="placas/financeiro" element={<PlacasFinanceiro />} />
            <Route path="placas/fichas" element={<PlacasFichas />} />
            <Route path="placas/erros" element={<PlacasErros />} />
            <Route path="placas/assistente" element={<PlacasAssistente />} />
            <Route path="placas/manuais" element={<PlacasManuais />} />
            <Route path="equipamentos" element={<Equipamentos />} />
            <Route path="formularios" element={<Formularios />} />
            <Route path="tipos-de-servico" element={<TiposServico />} />
            <Route path="etiquetas" element={<Etiquetas />} />
            <Route path="cargos" element={<Cargos />} />
            <Route path="relatorios/atividades" element={<RelatorioAtividades />} />
            <Route path="relatorios/graficos" element={<RelatorioGraficos />} />
            <Route path="relatorios/tipos-de-servico" element={<RelatorioTiposServico />} />
            <Route path="relatorios/garantia-brv" element={<RelatorioGarantia />} />
            <Route path="equipe" element={<Equipe />} />
            <Route path="ajuda" element={<Ajuda />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
