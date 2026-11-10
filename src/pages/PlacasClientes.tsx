import ClientesPlacas from '../components/placas/ClientesPlacas';
import NavegacaoPlacas from '../components/placas/NavegacaoPlacas';

export default function PlacasClientes() {
  return (
    <div className="space-y-5">
      <NavegacaoPlacas />
      <ClientesPlacas />
    </div>
  );
}

