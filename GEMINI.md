# BRV Control: regras para o Gemini

Sistema de gestão de serviços de campo (clientes, OS, técnicos, fotos). Leia também o `CLAUDE.md` (contexto e estado atual).
Idioma: português em tudo (textos da tela, comentários, nomes, mensagens de commit).

## O que você faz
Telas e componentes visuais: layout, formulários, tabelas, estados vazios, responsividade, cores, textos.
Siga o padrão das telas existentes: `src/pages/Clientes.tsx` (lista) e `src/components/ordens/OrdemDetalhes.tsx` (formulário).
Stack: React 19, TypeScript, Tailwind 4, lucide-react. Não adicione bibliotecas sem avisar.

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
