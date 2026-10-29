import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import LinhaDoTempo from './pages/LinhaDoTempo';
import OrdensServico from './pages/OrdensServico';
import Estoque from './pages/Estoque';
import Equipamentos from './pages/Equipamentos';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="linha-do-tempo" element={<LinhaDoTempo />} />
        <Route path="ordens-de-servico" element={<OrdensServico />} />
        <Route path="estoque" element={<Estoque />} />
        <Route path="equipamentos" element={<Equipamentos />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
