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
import Equipamentos from './pages/Equipamentos';
import Formularios from './pages/Formularios';
import TiposServico from './pages/TiposServico';
import Etiquetas from './pages/Etiquetas';
import PortalRoute from './components/portal/PortalRoute';
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
            <Route path="estoque" element={<Estoque />} />
            <Route path="equipamentos" element={<Equipamentos />} />
            <Route path="formularios" element={<Formularios />} />
            <Route path="tipos-de-servico" element={<TiposServico />} />
            <Route path="etiquetas" element={<Etiquetas />} />
            <Route path="equipe" element={<Equipe />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
