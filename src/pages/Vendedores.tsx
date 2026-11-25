import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import {
  listarLoginsVendedores,
  salvarVendedor,
  type LoginVendedor,
  type NivelVendedor,
} from '../services/vendedores';

const ROTULO_PAPEL: Record<string, string> = { admin: 'Administrador', escritorio: 'Escritório' };

/** Cadastro de vendedores (só admin): quem entra em Vendas, Orçamentos e Catálogo e com que nível. */
export default function Vendedores() {
  const { profile, refreshProfile } = useAuth();
  const [logins, setLogins] = useState<LoginVendedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gravando, setGravando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  /** Nome digitado para quem ainda não tem funcionário ligado ao login. */
  const [nomes, setNomes] = useState<Record<string, string>>({});

  const carregar = useCallback(() => listarLoginsVendedores().then(setLogins), []);

  useEffect(() => {
    carregar()
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'))
      .finally(() => setCarregando(false));
  }, [carregar]);

  const gravar = async (login: LoginVendedor, vende: boolean, nivel: NivelVendedor) => {
    setErro(null);
    setGravando(login.profile_id);
    try {
      await salvarVendedor(login.profile_id, vende, nivel, nomes[login.profile_id]);
      await carregar();
      if (login.profile_id === profile?.id) await refreshProfile();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setGravando(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Vendedores</h1>
        <p className="mt-1 max-w-3xl text-xs text-slate-500">
          Só vendedores entram em Vendas, Orçamentos e Catálogo. O administrador sempre entra; marcar um administrador serve
          para o nome dele aparecer no campo “Vendedor(a)”.
        </p>
      </div>

      {erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{erro}</div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
        {carregando ? (
          <div className="flex h-40 items-center justify-center text-slate-500">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Login</th>
                <th className="px-4 py-3">Vendedor(a)</th>
                <th className="px-4 py-3">Nome no orçamento</th>
                <th className="px-4 py-3">Nível</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logins.map((l) => {
                const admin = l.role === 'admin';
                const nivel: NivelVendedor = l.financial_access === 'completo' ? 'completo' : 'caixa';
                const ocupado = gravando !== null;
                return (
                  <tr key={l.profile_id} className={l.active ? '' : 'opacity-60'}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{l.full_name}</div>
                      <div className="text-xs text-slate-500">
                        {ROTULO_PAPEL[l.role] ?? l.role} · {l.email}
                        {!l.active && ' · bloqueado'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={l.sales_access}
                          disabled={ocupado || !l.active}
                          onChange={(e) => void gravar(l, e.target.checked, nivel)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
                        />
                        {l.sales_access ? 'Sim' : 'Não'}
                        {gravando === l.profile_id && <Loader2 size={13} className="animate-spin" />}
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      {l.employee_id ? (
                        <span className="text-slate-700">
                          {l.seller_name}
                          {l.employee_active === false && <span className="text-xs text-red-600"> (inativo em Equipe)</span>}
                        </span>
                      ) : (
                        <input
                          type="text"
                          value={nomes[l.profile_id] ?? l.full_name}
                          disabled={ocupado || l.sales_access}
                          onChange={(e) => setNomes((n) => ({ ...n, [l.profile_id]: e.target.value }))}
                          aria-label={`Nome no orçamento de ${l.full_name}`}
                          className="w-full max-w-56 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {admin ? (
                        <span className="text-xs text-slate-500">completo (administrador)</span>
                      ) : l.sales_access ? (
                        <select
                          value={nivel}
                          disabled={ocupado}
                          onChange={(e) => void gravar(l, true, e.target.value as NivelVendedor)}
                          aria-label={`Nível de ${l.full_name}`}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                        >
                          <option value="caixa">caixa</option>
                          <option value="completo">completo</option>
                        </select>
                      ) : (
                        <span className="text-xs text-slate-400">sem acesso (entra como caixa ao marcar)</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
        <li>
          <strong>caixa</strong>: faz orçamentos e vendas e registra pagamentos. Não vê custo, não cancela venda e não dá
          desconto acima de 10%.
        </li>
        <li>
          <strong>completo</strong>: tudo, inclusive custo, cancelamento, desconto maior e os cadastros do financeiro.
        </li>
        <li>O nome no orçamento é o do funcionário ligado ao login. Depois de criado, altere em Cadastros &gt; Equipe.</li>
      </ul>
    </div>
  );
}
