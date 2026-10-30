import { useState } from 'react';
import { Menu, LogOut, User, KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import type { ProfileRole } from '../types/fsm';
import AlterarSenhaModal from './AlterarSenhaModal';

interface HeaderProps {
  onAbrirMenu: () => void;
}

const papelRotulo: Record<ProfileRole, string> = {
  admin: 'Administrador',
  escritorio: 'Escritório',
  tecnico: 'Técnico',
  cliente: 'Cliente',
};

const papelCor: Record<ProfileRole, string> = {
  admin: 'bg-purple-100 text-purple-700 border-purple-200',
  escritorio: 'bg-blue-100 text-blue-700 border-blue-200',
  tecnico: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cliente: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function Header({ onAbrirMenu }: HeaderProps) {
  const { profile, user, signOut } = useAuth();
  const [alterandoSenha, setAlterandoSenha] = useState(false);

  const nomeExibicao = profile?.full_name || user?.email?.split('@')[0] || 'Usuário';
  const papel = profile?.role || 'tecnico';

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onAbrirMenu}
          className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label="Abrir menu"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Usuário logado e botão de logout */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <User size={16} />
          </div>
          <div className="hidden text-left sm:block">
            <div className="text-sm font-medium text-slate-900 leading-none">{nomeExibicao}</div>
            <span
              className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-tight ${papelCor[papel]}`}
            >
              {papelRotulo[papel]}
            </span>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200" />

        <button
          type="button"
          onClick={() => setAlterandoSenha(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-blue-600"
          title="Alterar minha senha"
        >
          <KeyRound size={14} />
          <span className="hidden sm:inline">Senha</span>
        </button>

        <button
          type="button"
          onClick={() => signOut()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-red-600"
          title="Sair da conta"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
      {alterandoSenha && <AlterarSenhaModal onFechar={() => setAlterandoSenha(false)} />}
    </header>
  );
}
