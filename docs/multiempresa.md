# Bancada Pro: produto de Placas para outras oficinas (plano, rascunho de 2026-11-17)

**Decisões do usuário até aqui (2026-11-17):**
- Oficina e Placas **não** entram como módulos do BRV Control. O BRV Control fica **só para a BRV**.
- O que se vende é um **produto novo, limpo e multiempresa desde a primeira tabela**.
- O público já existe e é para o módulo **Placas**: **oficinas de reparo de placa como a BRV** (tocam o próprio balcão: recebem placa,
  orçamentam, consertam, entregam, controlam o financeiro). Não é um portal de parceiro.
- **Nome do produto: "Bancada Pro"** (decidido em 2026-11-17). Falta conferir domínio no Registro.br e marca no INPI antes de investir em identidade visual.
- FSM completo e PMOC ficam para depois, se o produto de Placas der certo (ver seção 9).

Nada disso foi construído. Este arquivo é o rascunho para o usuário revisar.

## 1. Por que começar por Placas
- No BRV Control o módulo já é isolado: tabelas `board_*` próprias, cadastro de clientes próprio, número próprio `OS-DDMMAA-NNN`, financeiro próprio.
  A única ligação com o resto é `placasDoClienteControl` (placas do cliente de uma OS de campo), que o produto novo não precisa.
- Já está testado em uso real (81 placas importadas, 63 entregues, etiquetas, orçamento por link, garantia, apoio técnico).
- Escopo de multiempresa pequeno: ~6 tabelas de negócio, perfis, textos e etiqueta, em vez das 56 tabelas do sistema inteiro.

## 2. Arquitetura
**Um projeto Supabase só, com `empresa_id` em todas as tabelas** (assinatura aberta, cadastro sozinho). Com o escopo pequeno, vale fazer assim desde o início
(reescrever depois é que seria caro). Regras:
- `empresas` (id, nome, CNPJ, logo, contato, textos legais, plano) e `membros` (usuário, empresa, papel). Um usuário pertence a uma empresa (começar simples).
- Todo `board_*` com `empresa_id NOT NULL`; **RLS sempre por `empresa_id = minha_empresa()`**, nunca confiar no front. Função `minha_empresa()` security definer.
- Funções públicas por token (acompanhamento, orçamento) buscam pelo token e devolvem a marca da empresa dona.
- Numeração da OS **por empresa** (`OS-DDMMAA-NNN` com trava por empresa).
- Papéis: `dono` (tudo, inclusive financeiro e dados da empresa), `balcao` (cadastro, orçamento, entrega), `bancada` (diagnóstico e reparo). O financeiro vira
  permissão por membro (hoje é `profiles.board_finance_access` só do Braulio).
- **Verificação SQL com 2 empresas** (como as de `supabase/verificacao/`): nenhuma consulta, função ou link de uma enxerga dado da outra. Obrigatória antes de qualquer cliente.
- Opção descartada: uma instalação por cliente (cada migration × N clientes, suporte pesado).

## 3. O que portar do BRV Control (copiar e adaptar, não reescrever)
Telas e regras: quadro Entrada → Diagnóstico → Em Reparo/Aguardando Peça → Pronto → Entregue; "Placa sem defeito"; orçamento (sinal de 50% acima de um limite
configurável, validade, aprovação por link `/orcamento-placa/:token`); acompanhamento público `/placa/:token`; garantia de 90 dias só impressa na retirada, retorno
em garantia com a placa original; financeiro (faturamento, reembolso, dashboard); fotos; histórico imutável; etiqueta; apoio técnico (fichas, manuais, códigos de erro).
Fica de fora: importadores do Equipamentos, `field_control_id`, vínculo com OS de campo, papel `oficina`, tudo da BRV.
Ajuda F1 e manual vão junto, **sem citar a BRV** (regra fixa: módulo só está pronto com a ajuda feita).

## 4. Pontos que dependem de decisão técnica (o que quebra ao vender)
| Ponto | Hoje na BRV | No produto |
|---|---|---|
| Fotos | HostGator (`upload.php`, token do Supabase) | Armazenamento em nuvem (Supabase Storage ou Cloudflare R2), pasta por empresa, limite por plano |
| Etiqueta | Elgin + agente Node no servidor da loja + fila `print_jobs` | A oficina cliente não vai instalar agente. Alternativa: etiqueta em PDF pelo navegador (tamanho configurável); agente fica como opção avançada |
| Apoio técnico (Gemini) | `apoio-tecnico`, 40 consultas/hora por pessoa, chave da BRV | Chave da plataforma com **cota mensal por empresa/plano** (tem custo por uso) |
| Textos jurídicos | Orçamento e garantia em `textosJuridicosPlacas.ts` | Modelo-padrão revisado por advogado + campos editáveis por empresa (prazo da garantia, cláusulas, validade) |
| Marca | BRV fixa | Logo, nome, CNPJ, endereço e contato da empresa em orçamento, termo, etiqueta e páginas públicas |
| E-mail | `mail()` da HostGator | Serviço transacional (Resend, Postmark...), remetente do produto |
| Backup | Script no PC da BRV | Supabase Pro (backup diário) e exportação dos dados pela própria empresa |
| Supabase | Plano gratuito | **Pro obrigatório** (backup, sem pausa, mais egress); custo entra no preço |
| Cobrança | — | Assinatura mensal (Asaas, Stripe ou similar), bloqueio gentil quando inadimplente (somente leitura, nunca apagar) |
| LGPD | Uso interno | Termos de uso, política de privacidade, contrato de operador de dados, exportar e excluir dados da empresa |
| Onboarding | — | Cadastro da empresa, importação por planilha CSV (clientes e placas antigas) |
| Domínio | control.brvniteroi.com.br | Domínio e nome próprios do produto; subdomínio por empresa é opcional |

## 4b. Preço (hipótese, a validar com 3 a 5 oficinas)
- Referência do usuário: pagava ao Field Control **R$ 5.850 por ano (≈ R$ 487,50 por mês)** por um FSM completo, para uma equipe com vários técnicos. É o teto da categoria; Placas tem escopo menor.
- Hipótese inicial: plano único de **R$ 149 a R$ 199 por mês** (até R$ 249 a 299 com mais de um usuário), preço de lançamento menor para as primeiras oficinas, teste de 14 a 30 dias, sem fidelidade.
- Custo direto estimado por oficina: R$ 10 a 30 por mês (Supabase Pro dividido, fotos, e-mail, IA com cota). Só o piso.
- Validar com duas perguntas sem sugerir valor: "a partir de quanto seria caro demais?" e "a partir de quanto desconfiaria de ser bom demais?". Pergunta aberta: o Field cobrava por usuário ou valor fechado?
- Se um dia houver FSM + PMOC vendável, a referência é a faixa do Field (R$ 400 a 500 por mês).

## 5. Regras de negócio da BRV que viram configuração
Limite sem sinal (R$ 250,00), % do sinal (50%), validade do orçamento, dias de garantia (90), cláusulas de perda da garantia, política de execução, etapas
(manter as mesmas no início), "técnico de bancada" (hoje só o Braulio), quem vê o financeiro. Começar com os padrões da BRV como valores iniciais editáveis.

## 6. Fases
0. **Decisões do usuário** (seção 8) e validação do preço com 3 a 5 oficinas.
1. **Fundação:** repositório novo, Vite/React/Tailwind/Supabase como o atual, `empresas`/`membros`/`minha_empresa()`, cadastro e login por empresa, RLS e verificação com 2 empresas.
2. **Núcleo de Placas:** clientes, placas, quadro, orçamento, links públicos, fotos na nuvem, histórico, garantia, entrega, etiqueta em PDF. Ajuda F1.
3. **Financeiro e apoio técnico:** financeiro, dashboard, fichas, manuais, códigos de erro com cota de IA.
4. **Piloto:** 1 oficina conhecida usando de verdade por ~1 mês (a BRV pode ser a empresa nº 1 de teste, em paralelo ao BRV Control), corrigir o que quebrar.
5. **Comercial:** cobrança, termos, site de venda, onboarding por CSV, suporte.

Estimativa: não dou prazo exato; a fase 2 é a maior, mas a maior parte é adaptar código que já funciona.

## 7. Regras para o BRV Control enquanto isso
- Não gastar esforço de multiempresa nele. Correções e melhorias continuam normais.
- Mudança de regra nas Placas da BRV: anotar aqui se for algo que o produto novo também deve ter (evitar divergência silenciosa).

## 8. Perguntas em aberto para o usuário
1. **Quantas oficinas, mais ou menos, e você já conversou com alguma?** Quanto pagariam por mês? (Define o preço mínimo e o custo aceitável de nuvem e IA.)
2. ~~Nome do produto~~ **decidido: "Bancada Pro"**. Falta: domínio (Registro.br), busca de marca no INPI, logo e identidade (briefing para o Gemini).
3. **Etiqueta:** essas oficinas têm impressora térmica? Se sim, qual modelo (Elgin L42, Zebra, Argox...)? Se a maioria não tem, PDF para A4/etiqueta adesiva resolve.
4. **Apoio técnico com IA entra no preço base ou é um adicional?** (tem custo por uso)
5. **A BRV vira a empresa nº 1 do produto** (usando o produto novo no dia a dia) ou segue só com o BRV Control?
6. **Quem presta o suporte** (você, o Claude no código e alguém para atendimento)?
7. **Quem emite nota e cobra** a assinatura (CNPJ da BRV ou outro)?

## 9. Depois de Placas (não decidido)
FSM completo (clientes, equipamentos, OS, linha do tempo, app de campo) e **PMOC** como módulos de um segundo produto, também multiempresa desde o início, portados do BRV Control.
O PMOC é o candidato mais forte a módulo pago, mas precisa de responsável técnico por plano, texto legal editável e modelos de tarefa revisados por tipo de aparelho.
