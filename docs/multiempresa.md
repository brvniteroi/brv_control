# Multiempresa e módulos vendáveis (plano, rascunho de 2026-11-17)

Objetivo: vender o BRV Control para outras empresas de serviço de campo (foco em climatização). Cada empresa
só enxerga os próprios dados, e o que ela paga (módulos) liga ou desliga recursos, **no banco e não só no menu**.
O PMOC é o primeiro módulo pago à parte. **Nada aqui foi decidido nem construído**; é para o usuário revisar.

## 1. Situação de hoje (levantado no código em 2026-11-17)
- ~56 tabelas em `public`, ~115 funções, 54 migrations. Nenhuma tabela tem `empresa_id`.
- Papéis em `profiles.role` (`admin`, `escritorio`, `tecnico`, `oficina`, `cliente`); helpers `eh_admin()`, `eh_escritorio()`,
  `eh_oficina()`, `meu_cliente_id()`, `tem_financeiro_placas()`. As políticas RLS são escritas em cima desses helpers.
- Dados específicos da BRV fixos no código: `src/components/pmoc/empresa.ts` (capa, responsável técnico, frase legal), textos jurídicos
  das placas, domínio `control.brvniteroi.com.br`, remetente `avaliacao@brvniteroi.com.br`, pasta de upload da HostGator,
  etiqueta da Elgin, agente de impressão e de backup, Firebase/APK com um único `applicationId`.
- Segredos globais: Gemini, Firebase, `AVALIACAO_SEGREDO`, `EQUIPAMENTOS_SEGREDO`, chaves VAPID.

## 2. Decisão de arquitetura (a tomar primeiro)
| Opção | Como é | Prós | Contras |
|---|---|---|---|
| A. **Um banco, `empresa_id` em tudo** | Todas as empresas no mesmo projeto Supabase, RLS filtra | Uma instalação, uma atualização, custo baixo | Reescrever todas as políticas e funções; erro de RLS vaza dado entre clientes |
| B. **Uma instalação por empresa** | Projeto Supabase + deploy próprio para cada cliente | Isolamento total, nenhuma reescrita de RLS, licença = o que se instala | Cada migration roda N vezes; suporte e custo (Supabase, domínio, HostGator) crescem com o número de clientes |

Recomendação provisória: **B para as primeiras 3 a 5 empresas** (rápido, seguro, valida o preço) e **A quando passar disso**.
Para não perder o caminho, desde já seguir as regras da seção 6 em todo código novo. Se o usuário quiser vender como serviço de assinatura aberto
(cadastro sozinho), só a opção A serve.

## 3. Módulos e licença
Módulos candidatos: **Base** (clientes, equipamentos, OS, linha do tempo, app de campo, avaliações, relatórios), **PMOC**, **Oficina**, **Placas**,
**Financeiro** (futuro), **Portal do Cliente**, **Mapa/rastreio**.
- Tabela `modulos_ativos(empresa_id, modulo, ate DATE NULL)` (na opção B, `empresa_config` com a lista, uma linha só).
- Função `modulo_ativo(modulo TEXT) RETURNS BOOLEAN` (stable, security definer) lida pelas **políticas RLS e pelas funções `pmoc_*`**:
  quem não contratou recebe erro do banco, não só menu escondido.
- Front: `useModulos()` esconde menu, rotas e tópicos da ajuda F1; `MOSTRAR_MENU_*` de hoje viram essa consulta.
- Prazo (`ate`): módulo vencido vira somente leitura, não some com os dados do cliente.

## 4. O que muda para o PMOC virar módulo
1. `empresa.ts` vira cadastro (`empresa_config`: razão social, CNPJ, logo, telefone, endereço) e `responsáveis técnicos` (nome, registro CFT/CRT, cargo)
   escolhidos por plano, em vez de "sempre o Braulio".
2. Frase legal e normas como texto editável por versão (a RE 09 já foi revogada uma vez; a norma muda).
3. Modelos de tarefa por tipo de equipamento (`pmoc_task_templates`): entregar com um modelo padrão revisado (Cassete, Piso-Teto e VRF ainda
   têm as 22 tarefas genéricas) e deixar a empresa editar.
4. Políticas RLS e funções `pmoc_*` passam a exigir `modulo_ativo('pmoc')`.
5. Etiqueta: tamanho do rolo e impressora por empresa (hoje 100 x 50 mm na Elgin da BRV).
6. Páginas públicas (`/relatorio-pmoc/:token`, `/equipamento/:token`) mostram a marca da empresa dona do dado.

## 5. Pontos que quebram ao vender (checklist)
- **Upload de fotos:** `upload.php` e a pasta `api/uploads/` são da BRV. Cada empresa precisa de hospedagem própria ou de Supabase Storage/S3.
  (Hoje fora do Supabase para economizar espaço; revisar o custo.)
- **E-mail de avaliação:** remetente, SPF/DKIM/DMARC por domínio de cada empresa.
- **APK:** um `applicationId` e um Firebase para todos (com token por empresa) ou um APK por empresa (white-label). O mais simples: um app só, URL do servidor escolhida no primeiro acesso.
- **Backup:** `scripts/backup` é do PC da BRV; para clientes, backup contratado (Supabase Pro) ou rotina nossa.
- **Segredos:** Gemini (limite de uso por empresa, custo repassado?), Google Maps (chave por empresa por causa do referenciador HTTP).
- **Importadores** (Field Control, Equipamentos): são da BRV; para clientes novos, importação por planilha CSV genérica.
- **LGPD:** contrato com a empresa como operadora dos dados; política de privacidade e termos de uso; exclusão e exportação de dados do cliente.
- **Suporte:** a ajuda F1 e o manual precisam falar sem citar a BRV.

## 6. Regras para todo código novo (desde já, sem esperar o plano)
- Nada de nome, CNPJ, domínio ou texto da BRV dentro de componente: ler de um lugar só (`empresa.ts` hoje, `empresa_config` depois).
- Tabela nova: pensar na coluna `empresa_id` (na opção A) e escrever as políticas só pelos helpers (`eh_admin()`...), nunca com `profiles.role` direto, para trocar num lugar só.
- Funções `security definer` novas de módulo pago: já chamar um ponto único, ex. `public.exige_modulo('pmoc')`, que hoje retorna TRUE.
- Recurso de módulo pago atrás de uma flag única (`modulos.ts`), não espalhada.

## 7. Fases sugeridas
0. **Decisão** (opção A ou B) + preço e modelo de cobrança (mensalidade base + módulos, ou por aparelho/plano ativo; pesquisar concorrentes). Usuário.
1. **Preparar sem quebrar nada:** `exige_modulo()` e `useModulos()` retornando "tudo ligado"; mover dados da BRV para `empresa_config`; responsável técnico por plano.
2. **Piloto:** instalar para 1 empresa conhecida (opção B), anotar o que quebra, ajustar a lista da seção 5.
3. **Multiempresa de verdade (opção A):** `empresa_id` em todas as tabelas + backfill com a BRV + reescrita das políticas + testes de vazamento entre empresas
   (verificação SQL com 2 empresas, como as de `supabase/verificacao/`). É a fase mais arriscada: exige verificação automatizada.
4. **Comercial:** cadastro/ativação de empresas, cobrança, termos de uso, página de venda, onboarding (importação CSV).

## 8. Perguntas para o usuário
1. Vender como **instalação por cliente** (B) ou **assinatura aberta** (A)? Quantas empresas em 1 ano?
2. Quem seriam os primeiros clientes (climatização? outros ramos de campo)? Isso define se Oficina e Placas entram na venda ou ficam só da BRV.
3. A BRV passa a ser cliente do próprio sistema (empresa nº 1) ou continua com instalação separada?
4. Cobrança: mensalidade fixa, por usuário/técnico, por aparelho PMOC ativo? Quem emite a nota e cobra?
5. Suporte: você presta o suporte (e a ajuda F1 reflete isso) ou só vende a licença?
6. Marca: "BRV Control" continua como nome do produto ou vira outro nome para o mercado?
