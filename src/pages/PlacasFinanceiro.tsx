import FinanceiroPlacas from '../components/placas/FinanceiroPlacas';
import NavegacaoPlacas from '../components/placas/NavegacaoPlacas';

export default function PlacasFinanceiro() {
  return (
    <div className="space-y-5">
      <NavegacaoPlacas />
      <FinanceiroPlacas />
    </div>
  );
}

