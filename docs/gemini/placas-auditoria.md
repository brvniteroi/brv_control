# Auditoria do Claude: módulo Placas (telas do Gemini), 2026-11-09

Auditado contra `docs/gemini/placas-briefing.md`, `docs/placas.md` e o sistema antigo (`D:\BRV_Equipamentos\frontend\src\pages\Reparos\`).
Resumo do Gemini: `docs/gemini/placas.md`.

## Conferido (ok)
- `npm run typecheck`, `npm run lint` (0 avisos, 0 erros) e `npm run build` passam.
- **Escopo respeitado:** nada em `supabase/`, `src/services/`, `src/contexts/`, `ProtectedRoute`, `components/campo/`, `pages/campo/`, `public/`, `android/`, `scripts/`, `src/ajuda/`.
  Só alterou `App.tsx` (rotas) e `Sidebar.tsx` (grupo Placas). Nenhuma biblioteca nova.
- **Financeiro só com `podeVerFinanceiroPlacas`** (menu, tela, valor cobrado, reembolso, eventos financeiros do histórico). `oficina` não vê valores nem orçamento.
- **Textos copiados:** PIX `brvloja@brvniteroi.com.br`, sinal de 50% e a cláusula de abandono de 90 dias conferem com `ModalOrcamentoPlaca.jsx` e `ModalComprovanteEntrada.jsx`.
- Dados de demonstração fictícios; faixa "Dados de demonstração" presente.

## Divergências que precisam de decisão do Braulio
1. **Regra de etapa nova (não estava no briefing nem no sistema antigo):** o front **bloqueia** mover a placa para Aguardando Peça, Em Reparo, Teste, Pronto ou Entregue sem `quote_status = 'aprovado'`
   (exceto garantia). No sistema antigo o Kanban movia livre. Pode ser boa regra, mas trava o Gustavo se o escritório esquecer de registrar a resposta. **Manter, tirar ou só avisar?**
2. **"Sem Conserto / Devolvido" no dashboard:** no antigo, entra como **reembolso** (valor do reembolso, ou o do orçamento). No do Gemini, sem conserto **fica fora** da receita e **não entra em reembolsos** (só `refunded = true`).
   Os totais de reembolso vão diferir dos do sistema atual. **Qual vale?**
3. **Encalhada (≥ 4 dias):** antigo conta **todas** as placas em aberto, inclusive Pronto; o Gemini exclui Pronto (foi o que o briefing pediu). Para o laboratório, placa Pronta parada é a que mais atrasa a entrega. **Incluir Pronto como no antigo?**
4. **Placas arquivadas:** antigo conta receita de "arquivadas" mesmo que o status não seja Entregue; o Gemini só conta `status = 'entregue'`. Conferir na migração (as 78 OS) se há arquivadas fora de Entregue.
5. **Rankings de marcas e defeitos:** antigo conta **todas** as placas (sem filtro de ano); o Gemini filtra pelo ano selecionado. Provavelmente melhor, mas os números do ano atual diferem.
6. **Receita:** antigo usa `valor_orcamento`; o Gemini usa `charged_amount ?? quote_amount` (campo novo "valor efetivamente cobrado"). Na migração, `charged_amount` = `valor_orcamento` das entregues.

## O que fica comigo (TODO(Claude))
Banco (migration `board_*`, RLS, `tem_financeiro_placas()` nas colunas financeiras, número `OS-DDMMAA-NNN` com trava, tokens públicos, RPC pública do acompanhamento), `services/placas.ts` e a troca de `fonteDeDados.ts`,
PDF do orçamento e do termo (biblioteca ou impressão), QR no comprovante, ZPL da etiqueta de placa e fila da Elgin, Edge Functions de IA (`extrair-ficha`, `consultar-erro`, `assistente-tecnico`) com login, envio e
extração de texto dos manuais, importador (placas, clientes 1:1, fotos, fichas e manuais) com `--simular`, texto da ajuda F1 (`src/ajuda/`, tópicos listados na seção 9 do resumo) e "Recolher placa" no app de campo.

## Riscos para a ligação ao banco
- O Gemini supôs **colunas em inglês** (seção 3.2 do resumo) que viram o schema; revisar antes da migration (ex.: `unaccent`, `customer_address` como texto, `board_events.visibility`).
- **RLS por coluna** não existe: `quote_amount`, `charged_amount` e `refund_*` precisam de visão/função que omita colunas para `oficina` e para quem não tem `tem_financeiro_placas()` (o resumo já alerta).
- `buscarAcompanhamentoPublico(token)` deve ser RPC `security definer` que devolve só o necessário, com limite de tentativas; token longo e revogável.
- Menu **Placas oculto** em `Sidebar.tsx` (`MOSTRAR_MENU_PLACAS = false`) até ligar ao banco; as rotas abrem por URL. Para ver as telas: entrar em `/placas` (demo) logado como Administrador BRV.

## Decisões do Braulio (2026-11-09)
1. Bloqueio de etapa: **mantido** por enquanto.
2. Sem conserto **não** gera reembolso. Reembolso = caixa de marcar + valor (devolução do que o cliente pagou), sai do financeiro. Como já estava no Gemini.
3. Dias contados **desde a entrada**, sem zerar na troca de etapa; encalhada inclui Pronto (`diasDesdeEntrada`, `days_since_entry`). Ajustado pelo Claude.
Também: a `oficina` (Gustavo) não tem acesso às Placas (menu e `ProtectedRoute` ajustados). Pontos 4 a 6 ficam para conferir na migração.

## Próximos passos (ordem)
1. ~~Braulio testa as telas em `/placas` (demo) e decide os 3 pontos acima~~ (decididos; testar as telas segue valendo).
2. Ajustes visuais ao Gemini, se houver.
3. Claude: migration + services + ligação, ajuda F1, importador em simulação, IA e manuais; depois virada.
