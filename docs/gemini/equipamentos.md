# Tarefa para o Gemini: tela de Equipamentos

Leia antes: `GEMINI.md` e `CLAUDE.md`. Siga as regras do `GEMINI.md` (português, sem mexer em services/migrations, typecheck + lint + build).

## Objetivo
Trocar o placeholder `src/pages/Equipamentos.tsx` (hoje só `EmConstrucao`) por uma tela completa: lista de equipamentos instalados nos clientes, com busca, filtro, paginação e um painel/modal para criar e editar.

## Padrão a copiar
- Lista, busca, filtro de status, paginação e painel lateral: `src/pages/Clientes.tsx` e `src/components/clientes/ClienteDetalhes.tsx`.
- Formulário: `src/components/ordens/OrdemDetalhes.tsx`.
- Componentes novos em `src/components/equipamentos/`.

## Dados: use somente `src/services/equipamentos.ts` (já pronto)
- `listarEquipamentos(termo, filtro, pagina, clienteId?)` devolve `{ itens, total }`. Cada item traz `customer: { id, name }`. 50 por página (`EQUIPAMENTOS_POR_PAGINA`). Filtro: `'ativos' | 'inativos' | 'todos'`.
- `buscarEquipamento(id)`
- `salvarEquipamento(dados, id?)`: sem `id` cria, com `id` atualiza.
- `definirEquipamentoAtivo(id, ativo)`: **não existe excluir**; "Desativar/Reativar" no lugar.
- `buscarClientesParaSeletor(termo)`: usar num campo de busca com resultados (combobox) para escolher o cliente. Debounce de ~300 ms.
- `listarEnderecosDoCliente(clienteId)`: select "Local de instalação" depois de escolher o cliente (opcional).
- Se faltar alguma função, **descreva o que falta ao Braulio**, não crie.

## Campos do formulário (tipo `Equipment` em `src/types/fsm.ts`)
| Campo | Rótulo | Obrigatório | Observação |
|---|---|---|---|
| `customer_id` | Cliente | sim | combobox; trava (não editável) ao editar |
| `address_id` | Endereço de instalação | não | só aparece após escolher o cliente |
| `category` | Categoria | sim | texto com sugestões: Split Hi-Wall, Split Piso Teto, Cassete, VRF, Chiller, Quadro Elétrico |
| `brand` | Marca | não | |
| `model` | Modelo | não | |
| `serial_number` | Nº de série | não | |
| `capacity_btu` | Capacidade (BTU) | não | número inteiro > 0 |
| `voltage` | Tensão | não | select: 127V, 220V, 380V |
| `refrigerant` | Gás refrigerante | não | select: R-410A, R-32, R-22 |
| `location` | Local no imóvel | não | ex.: "Sala de reunião - 2º andar" |
| `installed_at` | Data de instalação | não | |
| `warranty_until` | Garantia até | não | mostrar selo "Em garantia" / "Garantia vencida" na lista |
| `qr_code` | Etiqueta / QR | não | único: se der erro de duplicado, mostrar "Esta etiqueta já está em uso" |
| `notes` | Observações | não | |
| `active` | Ativo | — | via botão Desativar/Reativar, não no formulário |

Campos de BTU/gás/tensão só fazem sentido para ar-condicionado: pode esconder quando a categoria for "Quadro Elétrico".

## Lista
Colunas (desktop): Categoria + marca/modelo, Cliente, Local, Garantia, Status. No celular vira cartões. Linha clicável abre o painel de edição. Botão "Novo equipamento".

## Regras e estados
- Busca por categoria, marca, modelo, série, etiqueta ou local (o serviço já faz).
- Carregando, erro com "Tentar de novo", vazio ("Nenhum equipamento encontrado") e vazio sem filtro com chamada para cadastrar.
- Validar antes de salvar; erros em português simples. Erros de RLS/permissão: "Você não tem permissão para esta ação."
- Datas com `utils/ordens.ts`.
- Perfil técnico pode ver e cadastrar, mas não vê o botão Desativar (usar `useAuth` como em `Clientes.tsx` para checar o papel; só `admin` e `escritorio` desativam).

## Fora do escopo (não fazer)
Histórico de OS do equipamento, QR code gerado, importação, mapa. Ficam para depois.

## Entrega
`npm run typecheck`, `npm run lint` e `npm run build` sem erro nem aviso. Não faça push nem commit de nada fora de `src/pages/Equipamentos.tsx` e `src/components/equipamentos/`. Avise o Braulio ao terminar.
