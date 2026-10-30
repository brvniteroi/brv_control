import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import LinhaDoTempo from './pages/LinhaDoTempo';
import Calendario from './pages/Calendario';
import Equipe from './pages/Equipe';
import OrdensServico from './pages/OrdensServico';
import Estoque from './pages/Estoque';
import Equipamentos from './pages/Equipamentos';
import Formularios from './pages/Formularios';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="linha-do-tempo" element={<LinhaDoTempo />} />
            <Route path="calendario" element={<Calendario />} />
            <Route path="ordens-de-servico" element={<OrdensServico />} />
            <Route path="estoque" element={<Estoque />} />
            <Route path="equipamentos" element={<Equipamentos />} />
            <Route path="formularios" element={<Formularios />} />
            <Route path="equipe" element={<Equipe />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
