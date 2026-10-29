import { Menu } from 'lucide-react';

interface HeaderProps {
  onAbrirMenu: () => void;
}

export default function Header({ onAbrirMenu }: HeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6">
      <button
        type="button"
        onClick={onAbrirMenu}
        className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 md:hidden"
        aria-label="Abrir menu"
      >
        <Menu size={22} />
      </button>
      {/* Busca global, notificações e usuário logado entram aqui */}
    </header>
  );
}
