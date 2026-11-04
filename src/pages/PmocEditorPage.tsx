import { Lock } from 'lucide-react';
import { useParams } from 'react-router-dom';
import EditorPlanoPmoc from '../components/pmoc/EditorPlanoPmoc';
import { useAuth } from '../contexts/useAuth';

export default function PmocEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const podeGerenciar = profile?.role === 'admin' || profile?.role === 'escritorio';

  if (!podeGerenciar) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <Lock size={32} className="mx-auto text-slate-300" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-slate-700">
          Apenas a equipe do escritório e administradores podem editar planos PMOC.
        </p>
      </div>
    );
  }

  return <EditorPlanoPmoc key={id ?? 'novo'} planIdUrl={id ?? null} />;
}

