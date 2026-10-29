import { useState } from 'react';
import ColaboradoresTab from '../components/equipe/ColaboradoresTab';
import UsuariosTab from '../components/equipe/UsuariosTab';
import { useAuth } from '../contexts/useAuth';

type Aba = 'colaboradores' | 'usuarios';

export default function Equipe() {
  const { profile } = useAuth();
  const ehAdmin = profile?.role === 'admin';
  const [aba, setAba] = useState<Aba>('colaboradores');

  const abas: { id: Aba; rotulo: string }[] = [
    { id: 'colaboradores', rotulo: 'Colaboradores' },
    ...(ehAdmin ? [{ id: 'usuarios' as const, rotulo: 'Usuários e acessos' }] : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Equipe</h1>
        <p className="mt-1 text-xs text-slate-500">
          Colaboradores de campo (aparecem na linha do tempo) e usuários que acessam o sistema.
        </p>
      </div>

      <nav className="flex space-x-8 border-b border-slate-200">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            className={`relative py-3 text-sm font-medium transition-colors ${
              aba === a.id ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {a.rotulo}
            {aba === a.id && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-blue-600" />}
          </button>
        ))}
      </nav>

      {aba === 'colaboradores' && <ColaboradoresTab />}
      {aba === 'usuarios' && ehAdmin && <UsuariosTab />}
    </div>
  );
}
