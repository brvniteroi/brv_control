# BRV Control: regras para o Gemini

Sistema de gestão de serviços de campo (clientes, OS, técnicos, fotos). Leia também o `CLAUDE.md` (contexto e estado atual).
Idioma: português em tudo (textos da tela, comentários, nomes, mensagens de commit).

## O que você faz
Telas e componentes visuais: layout, formulários, tabelas, estados vazios, responsividade, cores, textos.
Stack: React 19, TypeScript, Tailwind 4, lucide-react. Não adicione bibliotecas sem avisar.

## Padrão visual (obrigatório; o Braulio reclamou de telas "com cara de IA" em 2026-11-24)
Tela nova tem que parecer feita pela mesma mão das que já existem. **Copie a estrutura e as classes destes modelos, não invente outra:**
- **Lista:** `src/pages/Clientes.tsx` e `src/pages/OrdensServico.tsx`. **Painel/formulário por cima:** `src/components/ordens/OrdemDetalhes.tsx`
  (`fixed inset-0 z-50 overflow-y-auto bg-slate-50`). **Modal pequeno:** `src/components/linhaDoTempo/NovaAtividadeModal.tsx`.
  **Documento A4 e página pública:** `src/components/placas/FolhaOrcamentoPlaca.tsx` e `src/pages/OrcamentoPlacaPublico.tsx`.

Regras:
1. **Cabeçalho da página** igual ao de Clientes: `<div className="space-y-6">`, `h1` `text-2xl font-bold tracking-tight text-slate-900`, no máximo **uma** linha
   de subtítulo `text-xs text-slate-500`, e o botão principal ao lado (`rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white`). **Sem**
   cartão em volta do título, **sem** ícone em quadradinho ao lado do título, título **sem** cor da marca.
2. **Filtros** numa barra só, como em Clientes: busca + controle segmentado (`flex rounded-xl bg-slate-100 p-1`) ou `<select>`. **Sem** pílulas com contador.
3. **Nada de enfeite:** sem faixas/caixas de aviso informativas no topo (vá para a ajuda F1), sem fileira de cartões de resumo (um total no rodapé da
   tabela basta, se o briefing pedir), sem gradiente, `backdrop-blur`, `shadow-lg`/`xl`, animação (só o `Loader2` girando ao carregar) nem emoji.
4. **Pouco texto:** rótulo curto no campo e placeholder; **sem** frase explicativa embaixo de cada campo ou seção. Só fica texto que muda a decisão do
   usuário (um aviso de erro, um bloqueio). Títulos curtos: "Catálogo", não "Catálogo de Serviços, Peças e Aparelhos".
5. **Mesmas peças:** tabela com o `thead` de Clientes, selos de situação no formato de `STATUS_OS` (`utils/ordens.ts`), campos com a classe `INPUT` de
   `OrdemDetalhes.tsx`, `rounded-xl`/`rounded-lg` como lá (o `rounded-2xl` só nos cartões de bloco). Cores: as do sistema (azul `blue-600` nas ações,
   `slate` no resto, verde/âmbar/vermelho só em situação).
6. **Navegação** do módulo pelo menu lateral; sem barra extra de abas no topo da página. Seletor de demonstração ("Ver como") só como um controle
   pequeno e discreto, e só enquanto `FONTE_DADOS_DEMO` for `true`.
7. **Setas do teclado** (pedido do Braulio, 2026-11-24): toda lista de escolha ligada a uma busca (cliente, produto, conta, categoria...) usa o hook
   `src/hooks/useNavegacaoLista.ts` (↓/↑ marcam, Enter escolhe, Esc fecha; modelo em `components/ordens/SeletorCliente.tsx`). Para escolher cliente, use o
   próprio `SeletorCliente`. Escolha entre poucos valores fixos: `<select>` nativo (já aceita as setas).
8. **Listas de itens com valores** (produtos, parcelas, lançamentos): tabela compacta, **uma linha por item**, campos editáveis dentro da célula, sem
   cartão por item nem rótulo repetido em cada campo. Itens de venda/orçamento: use `components/vendas/TabelaItensVenda.tsx`.
Antes de entregar, abra a tela nova lado a lado com `Clientes.tsx`/`OrdemDetalhes.tsx` e tire o que não existe lá.

## O que você NÃO altera (peça ao Claude)
- `supabase/migrations/*` e `supabase/functions/*` (banco, regras de acesso/RLS, funções do servidor)
- `src/services/*` (consultas ao banco): use as funções que já existem; se faltar uma, descreva o que falta
- `src/contexts/*` e `ProtectedRoute` (login e permissões)
- `scripts/field-control/*` e qualquer `.env`
- Nunca coloque chaves, senhas ou dados de clientes no código.

## Regras de código
- Dados vêm só das funções de `src/services/*`; telas não chamam o Supabase direto.
- Toda lista: busca/filtro, estado de carregando, estado de erro com "Tentar de novo" e estado vazio.
- Formulários: validar antes de salvar e mostrar erro em português, sem mensagem técnica.
- Telefone com `formatarTelefone`, datas com `utils/ordens.ts`, CPF/CNPJ com `utils/documento.ts`.
- Funciona no celular (a equipe de campo usa).

## Antes de entregar
Rode `npm run typecheck` e `npm run lint` (os dois devem passar sem erro nem aviso) e `npm run build`.
Não faça push: avise o Braulio, que pede ao Claude uma revisão rápida antes do deploy.
