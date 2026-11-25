/**
 * Conteúdo da ajuda do operador (F1). Só o escritório e o admin veem.
 *
 * Ao mudar uma tela (nome de botão, regra, campo), atualizar o tópico aqui no mesmo commit.
 *
 * Formato do `texto`, uma linha por item:
 *   "1. ..."  passo numerado          "- ..."  item de lista
 *   "> ..."   dica (caixa azul)       "! ..."  atenção (caixa amarela)
 *   "## ..."  subtítulo               outra linha = parágrafo
 *   **negrito** dentro da linha (use para nomes de botões e menus)
 */

export type TelaAjuda =
  | 'geral'
  | 'dashboard'
  | 'clientes'
  | 'cliente'
  | 'os-lista'
  | 'os'
  | 'nova-atividade'
  | 'linha-do-tempo'
  | 'calendario'
  | 'mapa'
  | 'equipamentos'
  | 'cadastros'
  | 'relatorios'
  | 'equipe'
  | 'oficina'
  | 'item-oficina'
  | 'placas'
  | 'placa'
  | 'placas-clientes'
  | 'placas-financeiro'
  | 'placas-fichas'
  | 'placas-erros'
  | 'placas-manuais'
  | 'pmoc'
  | 'pmoc-plano'
  | 'pmoc-modelo'
  | 'catalogo'
  | 'orcamentos'
  | 'orcamento'
  | 'vendas'
  | 'venda'
  | 'financeiro-cadastros'
  | 'vendedores';

export interface Topico {
  id: string;
  titulo: string;
  /** Grupo do manual completo. */
  secao: string;
  /** Telas em que o F1 mostra este tópico (na ordem da lista). */
  telas: TelaAjuda[];
  /** Sinônimos para a busca (o que o operador digitaria). */
  palavras?: string;
  texto: string;
  /** Ids de tópicos relacionados. */
  veja?: string[];
}

/** Ordem das seções no manual completo. */
export const SECOES = [
  'Primeiros passos',
  'Clientes',
  'Ordens de serviço',
  'Agenda dos técnicos',
  'Avaliação do cliente',
  'Vendas',
  'Financeiro',
  'Oficina',
  'Placas',
  'PMOC',
  'Cadastros',
  'Relatórios',
  'Equipe e acessos',
  'Dúvidas comuns',
];

export const NOME_TELA: Record<TelaAjuda, string> = {
  geral: 'Ajuda',
  dashboard: 'Dashboard',
  clientes: 'Clientes',
  cliente: 'Cadastro do cliente',
  'os-lista': 'Ordens de Serviço',
  os: 'Ordem de serviço',
  'nova-atividade': 'Nova atividade',
  'linha-do-tempo': 'Linha do tempo',
  calendario: 'Calendário',
  mapa: 'Mapa',
  equipamentos: 'Equipamentos',
  cadastros: 'Cadastros',
  relatorios: 'Relatórios',
  equipe: 'Equipe',
  oficina: 'Oficina',
  'item-oficina': 'Item na oficina',
  placas: 'Placas (Kanban)',
  placa: 'Placa',
  'placas-clientes': 'Clientes de placas',
  'placas-financeiro': 'Financeiro das placas',
  'placas-fichas': 'Fichas técnicas',
  'placas-erros': 'Códigos de erro',
  'placas-manuais': 'Manuais',
  pmoc: 'PMOC',
  'pmoc-plano': 'Plano PMOC',
  'pmoc-modelo': 'Modelo de tarefas PMOC',
  catalogo: 'Catálogo',
  orcamentos: 'Orçamentos',
  orcamento: 'Orçamento',
  vendas: 'Vendas',
  venda: 'Venda',
  'financeiro-cadastros': 'Cadastros do financeiro',
  vendedores: 'Vendedores',
};

export const TOPICOS: Topico[] = [
  // ───────────── Primeiros passos ─────────────
  {
    id: 'usar-ajuda',
    titulo: 'Como usar esta ajuda',
    secao: 'Primeiros passos',
    telas: ['geral'],
    palavras: 'f1 manual tutorial',
    texto: `
Aperte **F1** em qualquer tela para abrir a ajuda daquela tela. O botão **Ajuda** (ícone ?) no alto da página faz o mesmo.
- Os tópicos da tela onde você está aparecem primeiro.
- Digite na busca para achar qualquer assunto, por exemplo "e-mail", "cancelar" ou "foto".
- **Esc** fecha a ajuda.
- **Manual completo** mostra todos os tópicos numa página só, para ler ou imprimir.
`,
  },
  {
    id: 'ditado-voz',
    titulo: 'Ditar texto pelo microfone',
    secao: 'Primeiros passos',
    telas: ['geral'],
    palavras: 'voz microfone ditar falar digitar texto diagnostico relato observacao',
    texto: `
Em qualquer campo de texto grande (diagnóstico de bancada, relato, observações, parecer...) aparece um **microfone** no canto do campo quando você clica nele.
1. Clique no campo, no ponto onde o texto deve entrar.
2. Clique no **microfone** (fica vermelho enquanto ouve) e fale.
3. Clique no **quadrado** vermelho para parar. O texto entra onde estava o cursor, e você pode corrigir digitando.
- Funciona no Chrome e no Edge, com internet. Na primeira vez o navegador pede permissão para usar o microfone: clique em **Permitir**.
- Pontuação não vem sozinha: diga o texto e acrescente vírgulas e pontos digitando.
! No Chrome o áudio é processado pelo serviço de voz do Google. Não dite dados sensíveis do cliente (CPF, senhas).
- Se o microfone não aparece, o navegador não tem esse recurso. No app Android dos técnicos, use o microfone do próprio teclado do celular.
`,
  },
  {
    id: 'setas-teclado',
    titulo: 'Escolher na lista com as setas do teclado',
    secao: 'Primeiros passos',
    telas: ['geral'],
    palavras: 'teclado setas seta enter esc atalho selecionar escolher lista busca cliente produto material',
    texto: `
Nas buscas que abrem uma lista para escolher (cliente da OS, da oficina, do PMOC, do orçamento e da venda; produtos e materiais do catálogo; OS ou cliente da nova atividade; cliente da nova placa; etiquetas; busca desta ajuda), dá para escolher sem o mouse:
- **↓** e **↑** andam pela lista; o item marcado fica azul.
- **Enter** escolhe o item marcado. Assim que você digita, o primeiro da lista já vem marcado.
- **Esc** fecha a lista sem escolher.
- Nas **etiquetas**, o Enter marca ou desmarca a etiqueta escolhida pelas setas; sem usar as setas, o Enter cria a etiqueta com o nome digitado.
- Nas caixas de seleção comuns (Técnico, Tipo de serviço, Situação...), as setas também funcionam: clique na caixa ou chegue nela com **Tab** e use ↓ e ↑.
`,
  },
  {
    id: 'menu',
    titulo: 'O menu e as telas do sistema',
    secao: 'Primeiros passos',
    telas: ['geral', 'dashboard'],
    palavras: 'navegar onde fica menu lateral',
    texto: `
O menu fica à esquerda. No celular, toque no ícone ☰ no alto para abrir.
- **Dashboard**: resumo do dia, com OS em aberto, atividades de hoje e o que precisa de atenção.
- **Serviços**: **Linha do Tempo**, **Calendário**, **Mapa** e **Ordens de Serviço**.
- **Cadastros**: **Clientes**, **Equipamentos**, **Tipos de Serviço**, **Etiquetas**, **Cargos**, **Modelos de Formulários** e **Equipe** (funcionários e, para o administrador, os usuários do sistema).
- **Relatórios**: atividades por técnico, gráficos, tipos de serviço e Garantia BRV.
- **Oficina**: equipamentos recolhidos para conserto na loja, da entrada à devolução.
- **Placas**: reparo de placas eletrônicas do laboratório (Kanban, clientes de placas e, só para quem tem acesso, o financeiro) e o apoio técnico (fichas, códigos de erro e manuais).
Clique no nome de um grupo (Serviços, Cadastros, Relatórios, Placas) para abrir ou fechar a lista.
`,
  },
  {
    id: 'senha',
    titulo: 'Trocar a minha senha',
    secao: 'Primeiros passos',
    telas: ['geral'],
    palavras: 'senha alterar mudar login',
    texto: `
1. No alto da página, clique em **Senha**.
2. Digite a **Senha atual**, a **Nova senha** (mínimo 8 caracteres) e repita a nova senha.
3. Confirme.
> Esqueceu a senha? Peça ao administrador: ele gera uma senha temporária em **Equipe > Usuários e acessos**.
`,
  },
  {
    id: 'dashboard',
    titulo: 'O que o Dashboard mostra',
    secao: 'Primeiros passos',
    telas: ['dashboard'],
    palavras: 'inicio painel resumo hoje',
    texto: `
- **Cartões do alto**: clique em um cartão (OS em aberto, Em andamento etc.) para abrir a lista de OS já filtrada.
- **Atividades de Hoje**: todas as visitas do dia. Nas concluídas aparecem as estrelas da avaliação, por onde o cliente respondeu (e-mail ou WhatsApp) e o comentário. Quando o cliente ainda não respondeu, aparece "Avaliação pedida..., aguardando".
- **Precisam de Atenção**: OS em aberto com o prazo vencido. Clique para abrir.
> A página se atualiza sozinha a cada 2 minutos e quando você volta para a aba.
## Backup do sistema (só administrador)
No fim do Dashboard, o administrador vê o cartão **Backup do sistema**:
- **Último backup concluído**: data, hora e se foi o **agendado** (segunda a sexta, 9h) ou **pedido pelo botão**. Fica vermelho se o último falhou ou se passou de 4 dias sem backup.
- **PC da empresa online/offline**: o backup roda no PC da empresa e só funciona com ele ligado.
- **Fazer backup agora**: pede um backup na hora (banco e fotos). O botão mostra **Aguardando o PC...** e depois **Backup em andamento...**; o resultado aparece sozinho, em geral em menos de um minuto. Só um pedido por vez.
- Se falhar, use **Ver detalhes da falha** e avise o suporte.
! O arquivo do backup fica no PC da empresa (pasta de backups). Este botão não envia o arquivo para outro lugar.
`,
  },

  // ───────────── Clientes ─────────────
  {
    id: 'cadastrar-cliente',
    titulo: 'Cadastrar um cliente',
    secao: 'Clientes',
    telas: ['clientes', 'cliente'],
    palavras: 'novo cliente incluir criar cadastro',
    texto: `
1. No menu, clique em **Cadastros > Clientes**.
2. Clique em **Adicionar cliente**.
3. Escolha pessoa física ou jurídica e preencha **Nome** (obrigatório) e CPF/CNPJ.
4. Preencha o **Endereço Principal do Cliente**. O CEP completa a rua, o bairro e a cidade.
5. Em **Ponto de Referência para o Técnico**, escreva o que ajuda a achar o local (interfone, portaria, loja ao lado).
6. Em contatos, clique em **Adicionar contato** e informe telefone e **e-mail**.
7. Clique em **Salvar**.
! Sempre peça o e-mail. Sem e-mail, o cliente não recebe o pedido de avaliação quando o serviço termina.
> O CPF/CNPJ é conferido ao salvar. Se aparecer erro, revise os números.
`,
    veja: ['contatos-cliente', 'enderecos-cliente'],
  },
  {
    id: 'buscar-cliente',
    titulo: 'Encontrar um cliente',
    secao: 'Clientes',
    telas: ['clientes'],
    palavras: 'procurar pesquisar localizar',
    texto: `
1. Em **Cadastros > Clientes**, digite na busca: nome, nome fantasia, e-mail, telefone, CPF/CNPJ ou **endereço** (rua, número, bairro, CEP ou o apelido do endereço).
2. Clique em **Abrir** na linha do cliente.
- A busca ignora acentos: "joao" encontra "João".
- Pelo endereço, digite um pedaço e/ou várias palavras em qualquer ordem: "tavares 121" ou "icarai macedo". O cliente aparece se **qualquer** um dos endereços dele (inclusive o antigo) combinar.
- Para ver o endereço sem abrir o cadastro, **passe o mouse sobre a linha do cliente**: aparece a dica com o endereço (se houver mais de um, todos, o principal primeiro).
- Os filtros **Ativos**, **Arquivados** e **Todos** mudam quais clientes aparecem.
`,
  },
  {
    id: 'contatos-cliente',
    titulo: 'Contatos do cliente (telefone e e-mail)',
    secao: 'Clientes',
    telas: ['cliente'],
    palavras: 'telefone email whatsapp contato principal editar',
    texto: `
1. No cadastro do cliente, aba **Geral**, vá até os contatos.
2. Clique em **Adicionar contato**, ou no lápis (**Editar contato**) para mudar um contato que já existe.
3. Informe o nome (ex.: "Karina, zeladora"), o tipo (Celular, WhatsApp, Comercial...), o telefone e/ou o e-mail. Basta um dos dois.
4. Marque **Definir como contato principal** se for a pessoa que responde pelo cliente.
5. Clique em **Salvar contato** e depois em **Salvar** no alto do cadastro.
- O telefone e o e-mail do contato principal são os usados pelo sistema: WhatsApp de confirmação e e-mail de avaliação.
- Se o principal não tiver e-mail, o pedido de avaliação vai para o e-mail de outro contato do cliente.
`,
  },
  {
    id: 'enderecos-cliente',
    titulo: 'Cliente com mais de um endereço',
    secao: 'Clientes',
    telas: ['cliente', 'os', 'nova-atividade'],
    palavras: 'endereco outro local filial casa praia',
    texto: `
1. Abra o cadastro do cliente.
2. Em **Outros endereços de atendimento**, clique em **Adicionar endereço**.
3. Preencha e clique em **Salvar endereço**.
- Ao criar uma OS ou uma atividade para esse cliente, o sistema pergunta em qual endereço é o serviço.
- **Desativar** esconde o endereço das próximas OS sem apagar o histórico.
> O mapa do cadastro mostra a localização dos endereços. Se o alfinete ficou no lugar errado, confira o número e o CEP.
`,
  },
  {
    id: 'historico-cliente',
    titulo: 'Ver os atendimentos de um cliente',
    secao: 'Clientes',
    telas: ['cliente'],
    palavras: 'historico os anteriores servicos feitos aba atendimento',
    texto: `
1. Abra o cadastro do cliente.
2. Clique na aba **Atendimento**.
3. Aparecem todas as OS do cliente, com o relato do técnico e as avaliações.
4. Clique em uma OS para abrir. Ela abre por cima do cadastro; ao fechar, você volta para o cliente.
`,
  },
  {
    id: 'vendas-cliente',
    titulo: 'Ver as vendas de um cliente (SicWeb)',
    secao: 'Clientes',
    telas: ['cliente'],
    palavras: 'vendas compras historico sicweb comprou produtos valor pagamento balcao',
    texto: `
1. Abra o cadastro do cliente.
2. Clique na aba **Vendas**. Ela só aparece para o **administrador**.
3. Aparecem as vendas feitas no SicWeb até 24/11/2026: data, tipo, nota, valor, quanto foi pago e se foi cancelada. No alto está o total vendido e a data da última venda.
4. Clique em uma venda para ver os **itens** (produto ou serviço, quantidade e valor) e a **forma de pagamento**.
5. Se o cliente tem mais de um endereço (casa e consultório, por exemplo), a lista mostra em qual **endereço** cada venda foi feita.
! Vendas antigas não têm a forma de pagamento registrada: aparecem só com os itens.
> As vendas de balcão (cliente avulso) ficam no cadastro **Cliente Balcão**, que está arquivado: abra Clientes > Arquivados. Ele mostra só as 300 vendas mais recentes.
`,
  },
  {
    id: 'arquivar-cliente',
    titulo: 'Arquivar ou reativar um cliente',
    secao: 'Clientes',
    telas: ['cliente', 'clientes'],
    palavras: 'excluir apagar desativar inativo',
    texto: `
1. Abra o cadastro do cliente.
2. Clique em **Arquivar** no alto. Para trazer de volta, abra pelo filtro **Arquivados** e clique em **Reativar**.
- Arquivar tira o cliente da lista do dia a dia, mas mantém todo o histórico de OS e fotos.
`,
  },
  {
    id: 'field-antigo',
    titulo: '"Endereço antigo no Field" e observações antigas',
    secao: 'Clientes',
    telas: ['cliente'],
    palavras: 'field control importado antigo',
    texto: `
Os clientes vieram do sistema antigo (Field Control). No cadastro, o bloco **Endereço antigo no Field** mostra o endereço e as observações exatamente como estavam lá.
- Serve só para consulta. Se algo ali estiver mais correto, copie para os campos do cadastro e salve.
`,
  },

  // ───────────── Ordens de serviço ─────────────
  {
    id: 'criar-os',
    titulo: 'Abrir uma ordem de serviço (OS)',
    secao: 'Ordens de serviço',
    telas: ['os-lista', 'os'],
    palavras: 'nova os abrir chamado servico',
    texto: `
Jeito mais rápido: pela **Linha do Tempo**, em **Nova atividade**. Ali você cria a OS e já agenda o técnico de uma vez (veja "Agendar um técnico").
Pela lista de OS:
1. No menu, clique em **Serviços > Ordens de Serviço**.
2. Clique em **Nova OS**.
3. Escolha o **Cliente** (busque pelo nome, CPF/CNPJ ou telefone).
4. Se o cliente tiver mais de um endereço, escolha o **Endereço do atendimento**.
5. Escolha o **Tipo de OS** e, se quiser, o **Prazo**. Ao lado da Situação aparece o **Telefone do cliente** (o do contato principal; para mudar, use **Abrir cadastro do cliente**).
6. Em **Solicitação do cliente / descrição**, escreva o que o cliente pediu. O técnico vê esse texto.
7. Em **Observações internas**, escreva o que só o escritório deve ver.
8. Clique em **Salvar**. Depois de salva, aparece o botão **Nova atividade** para agendar o técnico.
`,
    veja: ['agendar', 'situacao-os'],
  },
  {
    id: 'buscar-os',
    titulo: 'Encontrar uma OS',
    secao: 'Ordens de serviço',
    telas: ['os-lista'],
    palavras: 'procurar pesquisar filtro numero',
    texto: `
1. Em **Serviços > Ordens de Serviço**, digite na busca o **número da OS** ou o **nome do cliente**.
2. Use os filtros de situação, tipo e etiqueta para restringir a lista.
3. Clique na OS para abrir.
> Para buscar por telefone ou CPF, procure o cliente em **Clientes** e veja a aba **Atendimento**.
`,
  },
  {
    id: 'situacao-os',
    titulo: 'Situação da OS: por que mudou sozinha?',
    secao: 'Ordens de serviço',
    telas: ['os', 'os-lista'],
    palavras: 'status situacao agendada andamento concluida automatica',
    texto: `
A situação da OS segue a atividade do técnico. Você não precisa mudar à mão:
- Técnico **a caminho** ou **em execução**: OS **Em andamento**.
- Atividade **agendada**: OS **Agendada**.
- Atividade **impedida** (o técnico foi ao local e não conseguiu atender): OS **Impedida**, até você reagendar (veja "Visita impedida").
- Atividade **concluída**: OS **Concluída**.
O único caso que é sempre manual é o cancelamento (veja "Cancelar uma OS").
`,
    veja: ['cancelar-os', 'visita-impedida'],
  },
  {
    id: 'visita-impedida',
    titulo: 'Visita impedida (cliente ausente)',
    secao: 'Ordens de serviço',
    telas: ['os', 'os-lista', 'linha-do-tempo', 'calendario'],
    palavras: 'impedida impedimento cliente ausente nao atendeu portao fechado remarcar reagendar',
    texto: `
Quando o técnico vai ao local e não consegue atender (cliente saiu, portão fechado...):
1. No celular, na atividade, o técnico toca em **Não consegui atender** e escreve o **motivo**.
2. A atividade fica **Impedida** (vermelho-rosado) na Linha do tempo e no Calendário, com o tempo da visita. Passe o mouse para ver o motivo; na OS o motivo aparece na atividade.
3. A OS também fica **Impedida**, e a agenda do técnico segue para a próxima atividade.

Pelo escritório: no lápis da atividade, **Situação = Impedida** e preencha o **Motivo do impedimento** (obrigatório).

Para reagendar: no lápis da atividade, mude a **Situação** para **Agendada** e escolha a nova data, hora e técnico (o motivo é apagado). Só o escritório tira a atividade de Impedida.
! Impedida não é concluída: não entra nos relatórios de atividades realizadas e não gera pedido de avaliação. Para desistir do atendimento, cancele a atividade e a OS.
`,
    veja: ['situacao-os', 'cancelar-os'],
  },
  {
    id: 'cancelar-os',
    titulo: 'Cancelar uma OS',
    secao: 'Ordens de serviço',
    telas: ['os'],
    palavras: 'cancelamento desistiu cliente cancelou',
    texto: `
1. Abra a OS.
2. Em **Situação**, escolha **Cancelada**.
3. Preencha o **Motivo do cancelamento** (obrigatório).
4. Clique em **Salvar**.
! Cancelar a OS não cancela a atividade do técnico. Se havia visita marcada, cancele também a atividade (lápis na atividade, Situação = cancelada), senão ela continua na agenda do técnico.
`,
  },
  {
    id: 'etiquetas-os',
    titulo: 'Etiquetas na OS (ex.: "Aguardando pagamento")',
    secao: 'Ordens de serviço',
    telas: ['os', 'os-lista', 'cadastros'],
    palavras: 'etiqueta tag marcar pago pagamento',
    texto: `
1. Abra a OS e clique em **Adicionar etiqueta** (ou **Alterar**, se já tiver alguma).
2. Marque as etiquetas. Para criar uma nova, digite o nome e clique em **Criar**.
3. Para tirar, clique no × da etiqueta.
- As etiquetas aparecem na lista de OS (com filtro), na linha do tempo e no calendário.
- Só o escritório vê. O técnico e o cliente não veem.
`,
  },
  {
    id: 'fotos-os',
    titulo: 'Fotos da OS',
    secao: 'Ordens de serviço',
    telas: ['os'],
    palavras: 'foto imagem anexo galeria',
    texto: `
- As fotos que o técnico tira no celular aparecem sozinhas na OS.
- Para incluir fotos pelo escritório, use **Tirar foto** (abre a câmera do celular) ou **Galeria** (dá para escolher várias de uma vez; só imagens).
- Clique numa foto para ampliar. Use as setas para passar as fotos.
- Só o administrador pode excluir foto (X vermelho). Não dá para desfazer.
`,
  },
  {
    id: 'comentarios-os',
    titulo: 'Comentários internos da OS',
    secao: 'Ordens de serviço',
    telas: ['os'],
    palavras: 'comentario anotacao recado',
    texto: `
Use os comentários para recados entre o pessoal do escritório sobre aquela OS (ex.: "cliente pediu para ligar antes").
- Só o escritório vê. O técnico não recebe estes comentários.
- Para passar uma instrução ao técnico, use **Instruções para o técnico** na atividade ou a **Solicitação do cliente** da OS.
`,
  },
  {
    id: 'historico-os',
    titulo: 'Histórico de atendimentos (dentro da OS)',
    secao: 'Ordens de serviço',
    telas: ['os'],
    palavras: 'historico anteriores voltou garantia',
    texto: `
1. Na OS, clique em **Histórico de atendimentos**, logo abaixo do número.
2. Aparecem as outras OS do mesmo cliente, com o relato do técnico.
- Se o cliente tem **mais de um endereço**, a lista ganha a coluna **Endereço** com o apelido de cada um (ou rua e bairro, se não tiver apelido). Dá o mesmo na aba **Atendimento** do cadastro do cliente. Dê apelidos curtos aos endereços (ex.: Icaraí, Pendotiba) em **Endereços adicionais**.
3. Abrir outra OS dali não perde o que você estava editando: **Voltar** ou **Esc** retorna à OS de origem.
`,
  },
  {
    id: 'cliente-pela-os',
    titulo: 'Corrigir o cadastro do cliente sem sair da OS',
    secao: 'Ordens de serviço',
    telas: ['os'],
    palavras: 'cadastro cliente email aviso sem email',
    texto: `
- Clique em **Abrir cadastro do cliente**, ao lado do campo Cliente. O cadastro abre por cima da OS.
- Se aparecer o aviso amarelo **Cliente sem e-mail cadastrado**, clique em **Cadastrar e-mail**, inclua o e-mail num contato e salve. Ao fechar, o aviso some.
! O cliente de uma OS já salva não pode ser trocado. Se foi aberta para o cliente errado, cancele e abra outra.
`,
  },
  {
    id: 'formularios-os',
    titulo: 'Formulários preenchidos (orçamento, carga de gás...)',
    secao: 'Ordens de serviço',
    telas: ['os'],
    palavras: 'formulario laudo orcamento pdf imprimir',
    texto: `
- O técnico preenche os formulários no celular. Eles aparecem na OS, junto da atividade.
- Clique no formulário para ver. Dá para imprimir ou salvar como PDF pelo navegador.
- Se o técnico adicionou o formulário errado, o escritório pode excluir pela lixeira.
`,
  },

  // ───────────── Agenda dos técnicos ─────────────
  {
    id: 'agendar',
    titulo: 'Agendar um técnico (nova atividade)',
    secao: 'Agenda dos técnicos',
    telas: ['linha-do-tempo', 'calendario', 'nova-atividade', 'os'],
    palavras: 'agendar marcar visita tecnico atividade nova',
    texto: `
1. No menu, clique em **Serviços > Linha do Tempo** e depois em **Nova atividade**.
2. Em **Ordem de serviço ou cliente**, digite o número da OS ou o nome do cliente:
- **OS 1234 · cliente**: agenda numa OS que ainda não tem atividade.
- **Nova OS para (cliente)**: cria a OS junto. Escolha o **Tipo de serviço** e, se houver mais de um, o **Endereço do serviço**.
- **Cadastrar "..." como novo cliente**: cliente que ainda não existe. Abre o cadastro completo.
3. Preencha **Título**, **Técnico**, **Data**, **Hora de início** e **Duração prevista (min)**.
4. Se quiser, preencha **Solicitação do cliente** e **Observações internas**.
5. Clique em **Criar atividade**.
- Dentro de uma OS, o botão **Nova atividade** faz o mesmo para aquela OS.
- Se a atividade for para hoje, o técnico recebe aviso no celular.
`,
    veja: ['uma-atividade', 'confirmar-whatsapp'],
  },
  {
    id: 'uma-atividade',
    titulo: 'Retorno ou segundo técnico: por que não aparece "Nova atividade"?',
    secao: 'Agenda dos técnicos',
    telas: ['os', 'nova-atividade', 'linha-do-tempo'],
    palavras: 'retorno voltar segunda visita dois tecnicos outra atividade',
    texto: `
Cada OS tem **uma atividade só**. Por isso o botão **Nova atividade** some da OS depois que ela já tem uma.
- **Retorno** (voltar outro dia): abra uma **OS nova** para o cliente.
- **Dois técnicos**: uma OS para cada técnico.
- Atividade **cancelada** não conta: dá para reagendar na mesma OS.
`,
  },
  {
    id: 'linha-do-tempo',
    titulo: 'Usar a Linha do Tempo',
    secao: 'Agenda dos técnicos',
    telas: ['linha-do-tempo'],
    palavras: 'agenda dia grade timeline arrastar',
    texto: `
Cada linha é um técnico e cada barra é uma atividade, na cor da situação.
- Use as setas ou o campo de data para mudar o dia. **Hoje** volta para o dia atual.
- **Técnicos** filtra quem aparece. **Canceladas** mostra ou esconde as canceladas.
- As lupas aumentam ou diminuem o zoom das horas.
- **Clique** numa barra para abrir a OS.
- **Arraste** a barra para mudar o horário ou passar para outro técnico. Arraste a ponta da barra para mudar a duração. **Esc** cancela o arraste.
- Hoje, a bolinha ao lado do nome do técnico indica se o app dele está online (verde) ou não (cinza). Passe o mouse para ver há quanto tempo.
> Na atividade concluída, arrastar corrige o horário real de início e término. Atividade a caminho ou em execução não pode ser passada para outro técnico.
`,
    veja: ['agendar', 'remarcar'],
  },
  {
    id: 'remarcar',
    titulo: 'Remarcar, trocar o técnico ou cancelar uma atividade',
    secao: 'Agenda dos técnicos',
    telas: ['linha-do-tempo', 'os', 'calendario'],
    palavras: 'remarcar mudar horario trocar tecnico cancelar visita',
    texto: `
Jeito rápido: na **Linha do Tempo**, arraste a barra para o novo horário ou para a linha de outro técnico.
Pela OS:
1. Abra a OS e clique no lápis da atividade.
2. Mude **Técnico**, **Data**, **Hora** ou **Situação** (para cancelar, escolha cancelada).
3. Clique em **Salvar atividade**.
- Se a mudança envolver hoje, o técnico recebe aviso no celular.
> Técnico iniciou por engano? Abra a atividade e volte a **Situação** para agendada. Os horários reais são apagados.
`,
  },
  {
    id: 'confirmar-whatsapp',
    titulo: 'Confirmar o agendamento pelo WhatsApp',
    secao: 'Agenda dos técnicos',
    telas: ['os'],
    palavras: 'confirmar whatsapp avisar cliente mensagem',
    texto: `
1. Abra a OS. Na atividade agendada, clique em **Confirmar pelo WhatsApp**.
2. O WhatsApp abre com a mensagem pronta (saudação, data e serviço) para o celular do cliente.
3. Confira e envie.
- O número usado é o do contato principal. Se estiver errado, corrija em **Abrir cadastro do cliente**.
`,
  },
  {
    id: 'calendario',
    titulo: 'Usar o Calendário',
    secao: 'Agenda dos técnicos',
    telas: ['calendario'],
    palavras: 'mes semana calendario',
    texto: `
O Calendário mostra o mês inteiro, com as atividades de cada dia.
- Clique num dia para ver a lista e criar uma **Nova atividade** naquela data.
- Do dia aberto dá para ir direto para a **Linha do Tempo** daquele dia.
- Use **Buscar cliente** para achar em que dia está a visita de alguém.
`,
  },
  {
    id: 'mapa',
    titulo: 'Usar o Mapa',
    secao: 'Agenda dos técnicos',
    telas: ['mapa'],
    palavras: 'mapa gps localizacao onde esta tecnico',
    texto: `
- Os alfinetes são os atendimentos do dia: a cor é a situação, o contorno é a cor do técnico e o número é a ordem da visita no dia.
- O ícone de cada técnico mostra a última posição enviada pelo celular dele.
- Ao lado do nome: **Online** (app aberto há menos de 3 min) ou **Offline · há X**.
- Posição com mais de 15 minutos aparece apagada: o técnico pode ter fechado o app ou apagado a tela.
- Use o filtro de técnico e o botão de enquadrar para ver todos os pontos.
`,
  },
  {
    id: 'ordem-execucao',
    titulo: '"Não consigo iniciar ou concluir a atividade"',
    secao: 'Agenda dos técnicos',
    telas: ['linha-do-tempo', 'os'],
    palavras: 'erro bloqueado nao deixa iniciar concluir anterior ordem',
    texto: `
O técnico faz as visitas **na ordem do dia**. Uma atividade só sai de agendada (a caminho, em execução ou concluída) quando a **anterior do mesmo técnico, no mesmo dia, está concluída ou cancelada**. Essa regra vale também para o escritório.
1. Veja na **Linha do Tempo** qual atividade do técnico vem antes.
2. Conclua ou cancele essa atividade, ou arraste-a para depois.
3. Tente de novo.
- O técnico só consegue iniciar atividades de **hoje**.
`,
  },

  // ───────────── Avaliação do cliente ─────────────
  {
    id: 'avaliacao',
    titulo: 'Como funciona a avaliação do cliente',
    secao: 'Avaliação do cliente',
    telas: ['os', 'dashboard'],
    palavras: 'avaliacao estrelas nota email pesquisa satisfacao',
    texto: `
Quando a OS é concluída, o sistema **manda sozinho um e-mail** pedindo a avaliação (de avaliacao@brvniteroi.com.br). O cliente dá as estrelas e um comentário, sem precisar de login.
O e-mail **não** é enviado quando:
- o cliente não tem e-mail em nenhum contato;
- a OS já foi avaliada ou já teve pedido por e-mail;
- o cliente já recebeu um pedido (e-mail ou WhatsApp) nas últimas 72 horas, mesmo de outra OS;
- a OS foi concluída há mais de 24 horas.
No quadro **Avaliação do cliente** da OS aparece o que aconteceu: enviado, falhou ou não enviado, com o motivo.
`,
    veja: ['avaliacao-whatsapp', 'cliente-pela-os'],
  },
  {
    id: 'avaliacao-whatsapp',
    titulo: 'Pedir a avaliação pelo WhatsApp',
    secao: 'Avaliação do cliente',
    telas: ['os'],
    palavras: 'avaliacao whatsapp link copiar',
    texto: `
Use quando o cliente não tem e-mail ou não respondeu.
1. Abra a OS concluída.
2. No quadro **Avaliação do cliente**, clique em **Enviar avaliação pelo WhatsApp** (ou **Copiar link** para mandar por outro meio).
3. O WhatsApp abre com a mensagem e o link. Envie.
- Depois de um e-mail, esses botões ficam bloqueados por 72 horas, para não incomodar o cliente. Depois disso aparece **Pedir de novo pelo WhatsApp**.
- A resposta aparece na OS, na aba Atendimento do cliente, no Dashboard e na média do técnico em Equipe.
`,
  },

  // ───────────── Cadastros ─────────────
  {
    id: 'tipos-servico',
    titulo: 'Tipos de serviço',
    secao: 'Cadastros',
    telas: ['cadastros'],
    palavras: 'tipo servico instalacao manutencao limpeza garantia',
    texto: `
1. No menu, clique em **Cadastros > Tipos de Serviço**.
2. Clique em **Novo tipo**, dê o nome e, se quiser, a duração padrão. Ela já vem preenchida ao agendar.
- Tipo que não se usa mais: edite e desmarque ativo, em vez de excluir, para não afetar as OS antigas.
! Não renomeie o tipo **"Garantia BRV"**: o relatório de Garantia BRV reconhece o tipo por esse nome.
`,
  },
  {
    id: 'etiquetas',
    titulo: 'Cadastro de etiquetas',
    secao: 'Cadastros',
    telas: ['cadastros'],
    palavras: 'etiqueta cor tag',
    texto: `
1. No menu, clique em **Cadastros > Etiquetas**.
2. Clique em **Nova etiqueta**, dê o nome, escolha a cor e salve.
- Também dá para criar direto na OS, em **Adicionar etiqueta**.
- Só o administrador exclui etiqueta do catálogo.
`,
    veja: ['etiquetas-os'],
  },
  {
    id: 'modelos-formularios',
    titulo: 'Modelos de formulários',
    secao: 'Cadastros',
    telas: ['cadastros'],
    palavras: 'formulario modelo pergunta checklist',
    texto: `
Os modelos definem os formulários que o técnico preenche no celular (orçamento, carga de gás etc.).
1. No menu, clique em **Cadastros > Modelos de Formulários**.
2. Clique em **Novo modelo** ou abra um que já existe para editar as perguntas.
- Mudar um modelo não altera os formulários já preenchidos: cada resposta guarda uma cópia das perguntas.
`,
  },
  {
    id: 'equipamentos',
    titulo: 'Equipamentos dos clientes',
    secao: 'Cadastros',
    telas: ['equipamentos', 'cliente'],
    palavras: 'equipamento ar condicionado aparelho modelo serie',
    texto: `
1. No menu, clique em **Cadastros > Equipamentos**.
2. Clique em **Novo equipamento**, escolha o cliente e o endereço e preencha marca, modelo e número de série.
- Os equipamentos do cliente também aparecem no cadastro dele, em **Equipamentos Instalados**.
- Equipamento retirado: marque como inativo. Não exclua, para manter o histórico.
`,
  },

  // ───────────── Oficina ─────────────
  {
    id: 'oficina-como-funciona',
    titulo: 'Como funciona a Oficina',
    secao: 'Oficina',
    telas: ['oficina', 'item-oficina'],
    palavras: 'oficina bancada kanban conserto recolhido evaporadora condensadora janela acj etapas',
    texto: `
A **Oficina** acompanha o equipamento (ou parte dele) que a equipe trouxe do cliente para consertar na loja.
O item usa o **número da OS** em que foi recolhido: "OS 17300". Se saiu mais de uma peça da mesma OS: "OS 17300 · item 2".
## As etapas (aba Em andamento)
1. **Em trânsito**: o técnico recolheu e ainda está trazendo. Ele registra no app de campo, na atividade, pelo botão **Recolher equipamento** (com o que levou, defeito e fotos). O item aparece sozinho nesta coluna.
2. **Entrada / Diagnóstico** (uma coluna só): chegou na loja (imprima a etiqueta) e o técnico da oficina analisa e registra o que precisa ser feito. Ao arrastar um item em trânsito para cá ele entra como **Entrada**; os demais, como **Diagnóstico**. Para voltar um item a **Entrada**, abra o item e use **Mover etapa**.
3. **Aguardando peça / Reparo** (uma coluna só): conserto em andamento. Ao arrastar, o item entra em **Em reparo**; para marcar **Aguardando peça**, abra o item e use **Mover etapa**.
4. **Pronto**: pronto para voltar ao cliente (consertado ou recusado sem conserto).
A coluna **Aguardando orçamento** fica sempre visível: arraste para lá o equipamento que o atendimento precisa orçar no SicWeb (vale direto da Entrada). **Aguardando cliente** só aparece se ainda houver itens nela (a aprovação do cliente não é exigida).
Depois de entregue, descartado ou cancelado, o item vai para a aba **Finalizados**.
- Arraste o cartão para outra coluna ou abra o item e use **Mover etapa**. No celular, use **Mover para...** no cartão.
- **Cartão com fundo azul claro** = entrada de balcão (o cliente trouxe à loja, sem técnico de retirada). Os outros foram recolhidos em campo: passe o mouse no cartão para ver o técnico que recolheu.
- No computador, para ver as colunas que ficam à direita, **segure o botão do mouse num espaço vazio do quadro** (fora dos cartões) e **arraste para o lado**: o quadro anda junto, como uma mãozinha.
- A coluna fica apagada quando o item não pode ir para ela, e o motivo aparece (ex.: "Falta registrar a aprovação do cliente").
- **Garantia**: retorno de serviço anterior. Não passa por orçamento.
- Cartão com os dias em **vermelho**: está há 15 dias ou mais na loja.
> Tudo o que muda fica no **Histórico** do item: quem fez, quando e o que estava antes. Ninguém apaga o histórico.
`,
    veja: ['oficina-nova-entrada', 'oficina-orcamento', 'oficina-devolucao'],
  },
  {
    id: 'oficina-nova-entrada',
    titulo: 'Registrar a entrada de um equipamento',
    secao: 'Oficina',
    telas: ['oficina'],
    palavras: 'entrada receber chegou recolher balcao cliente trouxe nova',
    texto: `
1. Em **Oficina**, clique em **Nova entrada**.
2. Escolha a origem:
- **Da OS**: o equipamento saiu de uma visita. Digite o **Número da OS** e clique em **Buscar OS**. Cliente, técnico e relato vêm sozinhos.
- **Balcão (sem visita)**: o cliente trouxe na loja. Escolha o **Cliente** e o **Endereço do cliente**. Cliente novo: digite o nome na busca e clique em **Cadastrar "nome" como novo cliente**; ao salvar o cadastro, ele já volta selecionado. O sistema cria a OS junto.
3. Preencha **Tipo de equipamento**, **O que veio** (evaporadora, condensadora, as duas, aparelho inteiro), marca, modelo, tensão, **Acessórios** (controle, suporte...) e o **Defeito relatado**.
4. Em **Conferência na chegada**, anote o estado em que chegou (amassado, sem tampa...).
5. Deixe **Já chegou na loja** marcado se o equipamento está aqui. Desmarcado, ele fica **Em trânsito**.
6. Marque **Retorno em garantia** se for o caso.
7. Clique em **Salvar entrada**. O item abre com a etiqueta pronta para imprimir.
- Item **Em trânsito** que chegou: abra e clique em **Receber na loja (Entrada)**, ou arraste para **Entrada**.
! Balcão só para o escritório. O técnico da oficina registra apenas pela OS.
`,
    veja: ['oficina-etiqueta'],
  },
  {
    id: 'oficina-etiqueta',
    titulo: 'Imprimir a etiqueta na Elgin',
    secao: 'Oficina',
    telas: ['oficina', 'item-oficina'],
    palavras: 'etiqueta impressora elgin imprimir zpl qr code segunda via termica',
    texto: `
1. Abra o item e clique em **Etiqueta**.
2. Confira a pré-visualização. Escolha a **Largura da etiqueta** (**100 mm (padrão)** ou **80 mm**) e as **Cópias**.
3. Clique em **Imprimir na Elgin**. A situação aparece na tela: "Na fila..." → "Imprimindo..." → "Impressa".
- Dá para imprimir de qualquer lugar, até do celular fora da loja: o pedido vai para o servidor da loja, que imprime.
- O **QR** da etiqueta abre o item no sistema (pede login).
- No alto da tela Oficina: **Elgin pronta** (bolinha verde) ou **Servidor da loja sem sinal** (cinza).
- Sem sinal, use **Imprimir pelo navegador**. No Chrome, em **Margens** escolha **Nenhuma**.
- Pedido que fica mais de 30 minutos na fila (servidor desligado) não sai mais: peça de novo.
- **Histórico de impressões deste item**: quem pediu e quando. **Cancelar** tira da fila um pedido que ainda não saiu.
> Para conferir a impressora sem um item: botão **...** no alto da tela Oficina > **Imprimir etiqueta de teste**.
`,
    veja: ['oficina-elgin-sem-sinal'],
  },
  {
    id: 'oficina-comprovante',
    titulo: 'Comprovante de entrada e link para o cliente',
    secao: 'Oficina',
    telas: ['item-oficina', 'oficina'],
    palavras: 'comprovante recibo entrada whatsapp link acompanhamento cliente imprimir a4 balcao',
    texto: `
Administrador e escritório: abra o item e clique em **Comprovante**.
- A folha A4 traz o cliente, o telefone, o equipamento (tipo, marca, modelo, série, BTU, tensão), os acessórios, o defeito relatado, a conferência da entrada, o link de acompanhamento, as condições de guarda e garantia e as linhas de assinatura.
- **Imprimir**: para entregar no balcão e o cliente assinar.
- **Enviar o link pelo WhatsApp**: abre o WhatsApp no telefone do cadastro do cliente com a mensagem pronta e o link. Cliente sem telefone: o WhatsApp abre para você escolher o contato.
- **Copiar link**: para mandar por outro meio.
O cliente abre o link no celular, sem senha, e vê a etapa atual, a linha do tempo e, depois de devolvido, a garantia de 90 dias. Ele **não** vê diagnóstico, valores, observações internas nem fotos.
> O link de cada item é fixo: pode reenviar o mesmo quantas vezes precisar. Item cancelado não tem página.
`,
  },
  {
    id: 'oficina-bancada',
    titulo: 'Diagnóstico, conserto, fotos e anotações',
    secao: 'Oficina',
    telas: ['item-oficina', 'oficina'],
    palavras: 'diagnostico bancada peca conserto reparo foto anotacao historico gustavo',
    texto: `
Abra o item clicando no cartão.
- **Equipamento**: corrija os dados do aparelho e clique em **Salvar equipamento**.
- **Oficina**: **Técnico da oficina**, **Situação das peças**, **Diagnóstico**, **Peças necessárias** e **Serviço executado**. Clique em **Salvar oficina**.
- No celular, os botões **Salvar** aparecem também no fim de cada parte, e os textos longos (como o relato do técnico de campo) abrem inteiros.
- **Fotos**: use **Tirar foto** (câmera do celular) ou **Galeria** (pode escolher várias). A **Categoria das próximas fotos** já vem sugerida pela etapa (antes na chegada, depois no conserto).
- **Histórico**: escreva em **Anotar no histórico** e clique em **Salvar anotação**. Em uma alteração, **Ver antes e depois** mostra o valor antigo.
- Diagnóstico pronto: mova para **Aguardando orçamento**. O atendimento é avisado pelo quadro.
> O técnico da oficina não mexe em orçamento, resposta do cliente, descarte, devolução nem cancelamento. Isso é do escritório.
`,
  },
  {
    id: 'oficina-orcamento',
    titulo: 'Orçamento e resposta do cliente',
    secao: 'Oficina',
    telas: ['item-oficina', 'oficina'],
    palavras: 'orcamento sicweb valor aprovado recusado aprovar cliente respondeu whatsapp',
    texto: `
> **Por enquanto esta fase está desligada** (2026-11-10): o item segue do diagnóstico direto para **Em reparo** ou **Aguardando peça**, sem registrar orçamento nem resposta do cliente, e a oficina também faz esse passo. O orçamento continua sendo feito no SicWeb, fora do sistema. Os botões abaixo voltam quando a fase for religada.

O orçamento é feito no **SicWeb**. No sistema fica só a referência e a resposta do cliente.
1. Abra o item e, em **Orçamento e cliente**, clique em **Registrar orçamento**.
2. Preencha o **Nº do orçamento no SicWeb** e o **Valor do orçamento (R$)**. Com **Já enviado ao cliente** marcado, o item vai para **Aguardando cliente**.
3. **Avisar pelo WhatsApp** abre a conversa com o cliente já com o texto do orçamento.
4. Quando o cliente responder, clique em **Registrar resposta do cliente**:
- **Aprovado**: marque **Falta peça?** se precisar comprar. O item vai para **Aguardando peça** ou **Em reparo**.
- **Recusado**: o item vai para **Pronto**, para devolver sem conserto.
5. Escolha o **Canal da resposta** (WhatsApp, telefone, pessoalmente, e-mail), escreva uma observação se quiser e clique em **Salvar resposta**.
- Fica registrado quem anotou a resposta e quando.
`,
    veja: ['oficina-descarte'],
  },
  {
    id: 'oficina-descarte',
    titulo: 'Cliente autorizou o descarte',
    secao: 'Oficina',
    telas: ['item-oficina'],
    palavras: 'descarte descartar jogar fora sucata recusou autorizou',
    texto: `
Quando o cliente não quer o conserto e **autoriza** a BRV a descartar o equipamento:
1. Abra o item e clique em **Cliente autorizou o descarte**.
2. Escolha o **Canal da autorização** e escreva em **Quem autorizou e como** (ex.: "O próprio cliente, João, por WhatsApp às 14h").
3. Se tiver, anexe o print da conversa em **Anexar print da conversa**.
4. Clique em **Confirmar descarte**.
! Não pode ser desfeito. A autorização fica registrada no item, no histórico e como comentário na **OS de origem**.
- Sem autorização do cliente, não descarte: registre a recusa e devolva (o item vai para **Pronto**).
`,
  },
  {
    id: 'oficina-devolucao',
    titulo: 'Devolver ao cliente (OS de devolução)',
    secao: 'Oficina',
    telas: ['item-oficina', 'oficina', 'os'],
    palavras: 'devolver devolucao entregar instalar levar buscou loja entregue',
    texto: `
Com o item em **Pronto**, abra-o e veja a parte **Devolução**:
- **Criar OS de devolução**: a equipe leva e instala. Escolha o **Tipo de serviço**, marque outros itens prontos da mesma OS para irem juntos e clique em **Criar OS de devolução**. A OS nasce sem atividade: **agende a visita pela Linha do Tempo**.
- Quando a atividade da OS de devolução for **concluída**, o item passa para **Entregue** sozinho.
- **Cliente buscou na loja**: marca como **Entregue** na hora, sem OS de devolução.
- **Dar baixa (já devolvido)** (só administrador): para equipamento que já foi devolvido ao cliente fora do sistema. Passa para **Entregue** e anota no histórico.
- Na OS, o bloco **Na oficina** mostra os itens recolhidos nela (ou "Devolução de: OS X · item Y"). Clique em **Ver na oficina** para abrir.
- No cadastro do cliente, aba **Atendimento**, o bloco **Oficina** lista tudo o que já passou pela loja.
`,
    veja: ['agendar'],
  },
  {
    id: 'oficina-cancelar',
    titulo: 'Entrada errada: cancelar ou reabrir',
    secao: 'Oficina',
    telas: ['item-oficina'],
    palavras: 'cancelar errado engano reabrir desfazer finalizado',
    texto: `
- **Cancelar entrada** (escritório): para registro feito por engano. Informe o **Motivo do cancelamento** e clique em **Confirmar cancelamento**.
- **Reabrir** (só administrador): item entregue, descartado ou cancelado volta para **Pronto**.
- Item finalizado fica só para consulta, mas a **Etiqueta** continua disponível para segunda via.
- Etapa errada: mova de volta. O histórico guarda as duas mudanças.
`,
  },
  {
    id: 'oficina-elgin-sem-sinal',
    titulo: 'A etiqueta não saiu na Elgin',
    secao: 'Dúvidas comuns',
    telas: ['oficina', 'item-oficina', 'geral'],
    palavras: 'etiqueta nao imprimiu impressora elgin servidor sem sinal travou papel',
    texto: `
- **Servidor da loja sem sinal**: o computador servidor da loja está desligado ou sem internet. Ligue e espere 1 minuto. Enquanto isso, use **Imprimir pelo navegador**.
- **Não imprimiu: <motivo>**: leia o motivo. Os mais comuns: Elgin desligada, sem etiqueta ou com a tampa aberta. Resolva e clique em **Tentar de novo**.
- **O servidor da loja não respondeu**: o pedido ficou na fila. Confira o servidor e peça de novo.
- Etiqueta saiu cortada ou torta: confira o rolo (100 x 50 mm) e teste a largura **80 mm**.
> Para testar sem um item: botão **...** no alto da tela Oficina > **Imprimir etiqueta de teste**.
`,
  },

  // ───────────── Placas ─────────────
  {
    id: 'placas-como-funciona',
    titulo: 'Como funciona o reparo de placas',
    secao: 'Placas',
    telas: ['placas', 'placa'],
    palavras: 'placas laboratorio eletronica reparo kanban simulador instalador parceiro etapas numero os',
    texto: `
O menu **Placas** cuida das placas eletrônicas de ar-condicionado que chegam ao laboratório, quase sempre de **instaladores parceiros**.
Cada placa tem um número próprio com a data de entrada, por exemplo **OS-101126-001** (dia 10/11/26, primeira do dia). Esse número não é o da OS do BRV Control: só placas retiradas pela equipe de campo têm também uma OS do Control.
## As etapas
1. **Entrada / Triagem**: a placa chegou; confira, registre e imprima o comprovante.
2. **Diagnóstico / Orçamento**: análise na bancada e orçamento para o cliente.
3. **Em Reparo / Aguardando Peça**: a placa está na bancada, inclusive quando espera uma peça (o teste no simulador faz parte desta etapa).
4. **Pronto para Entrega**.
Depois de **Entregue / Faturado** ou **Sem Conserto / Devolvido**, a placa vai para a aba **Finalizadas**.
- Arraste o cartão para outra coluna, use as setas ← → do cartão ou abra a placa. No celular, mostra uma coluna por vez.
- No computador, para ver as colunas que ficam à direita, **segure o botão do mouse num espaço vazio do quadro** (fora dos cartões) e **arraste para o lado**: o quadro anda junto, como uma mãozinha. A barra de rolagem de baixo também funciona.
- **Parceiro** ou **Final** no cartão diz o tipo de cliente. **Garantia** é retorno de um reparo anterior.
- **Encalhada**: a placa está em aberto há **4 dias ou mais desde a entrada** (a contagem não zera quando muda de etapa).
! O banco não deixa seguir para **Em Reparo / Aguardando Peça**, **Pronto** ou **Entregue** sem o **orçamento aprovado** (exceto garantia e **Placa sem defeito**). Só uma placa em **Pronto** pode ser entregue.
## Placa sem defeito
Testou em bancada e a placa **não tem defeito**? Abra a placa (ainda em **Entrada** ou **Diagnóstico**) e clique em **Placa sem defeito**:
1. Digite o **valor da avaliação em bancada** (retorno em garantia não cobra).
2. Clique em **Liberar em Pronto e avisar no WhatsApp**.
A placa vai **direto para Pronto**, sem orçamento e sem aprovação do cliente, e o WhatsApp abre com a mensagem: a placa não apresentou defeito, o valor da avaliação e que já pode ser retirada. O cartão ganha o selo **Sem defeito** e o valor fica como sugestão ao registrar a saída. Se a aba do WhatsApp não abrir, use **Reenviar mensagem pelo WhatsApp** na própria placa. Para voltar atrás (achou defeito depois), mova a placa de volta para **Diagnóstico**: a marca some e o orçamento normal volta a valer.
> Tudo o que muda fica no **Histórico** da placa (quem fez, quando e o que mudou). Ninguém apaga o histórico.
`,
    veja: ['placas-nova-entrada', 'placas-orcamento', 'placas-finalizar'],
  },
  {
    id: 'placas-nova-entrada',
    titulo: 'Registrar a entrada de uma placa',
    secao: 'Placas',
    telas: ['placas'],
    palavras: 'nova placa entrada receber cadastrar balcao portador campo retirada comprovante foto',
    texto: `
1. Em **Placas**, clique em **Nova placa**.
2. Escolha a origem:
- **Balcão / portador**: o parceiro trouxe a placa. Escolha o **Cliente de placas**; se ainda não existe, clique em **Novo cliente** e **Salvar e selecionar cliente**.
- **Retirada pela equipe de campo**: digite o **Número da OS no BRV Control** e clique em **Buscar OS**. O cliente, o endereço e o relato do técnico vêm da OS. Se já existe placa nessa OS, aparece um aviso.
3. Preencha **Tipo de equipamento**, **Marca / modelo**, **Código da placa (part number)**, **Defeito reclamado** e, se souber, o **Código de erro**.
4. Em **Periféricos / acessórios entregues junto** anote o que veio com a placa (sensores, display, chicote, motor).
5. Marque **Sem defeito aparente** se foi deixada só para teste. Marque **Retorno em garantia** e escolha a **Placa original entregue** se for garantia.
6. Use **Tirar foto** ou **Galeria** para as fotos da entrada.
7. Clique em **Registrar entrada e gerar comprovante**.
A placa entra na coluna **Entrada / Triagem** e o **Comprovante de entrada** abre para imprimir ou enviar o link ao cliente.
> Placa de parceiro **não cria OS** no BRV Control. O cliente de placas é um cadastro à parte dos clientes do sistema.
`,
    veja: ['placas-comprovante', 'placas-clientes'],
  },
  {
    id: 'placas-orcamento',
    titulo: 'Fazer e enviar o orçamento da placa',
    secao: 'Placas',
    telas: ['placa'],
    palavras: 'orcamento valor proposta pdf whatsapp link aprovar aprovado recusado resposta cliente parecer validade',
    texto: `
O orçamento da placa é feito aqui no sistema (diferente dos equipamentos, que usam o SicWeb).
1. Abra a placa e vá em **Orçamento**.
2. Preencha **Valor do orçamento (R$)**, **Validade (dias corridos)**, **CPF / CNPJ no orçamento**, **Endereço do cliente (para o PDF)** e o **Parecer técnico para a proposta**.
3. Clique em **Salvar orçamento**.
4. **Ver/Imprimir orçamento** mostra a proposta em A4: use **Imprimir / Salvar PDF** se quiser o arquivo.
5. **Enviar pelo WhatsApp (link para aprovar)** abre a conversa com o resumo do orçamento e um **link**, e marca a placa como **Orçamento enviado**. Não é preciso anexar nada.
6. Pelo link, o cliente vê o mesmo orçamento, salva em PDF e clica em **Aprovar orçamento** (informa o nome e marca que concorda com as condições). A placa passa para **Aprovado** sozinha, com o canal **Link do orçamento** e o nome no histórico.
7. Se o cliente responder de outro jeito (mensagem, telefone, balcão), clique em **Registrar resposta**: **Aprovado** ou **Recusado**, o **Canal da resposta** e **Salvar resposta**.
- **Aprovado**: a placa pode seguir para **Em Reparo / Aguardando Peça** e as próximas etapas.
- **Recusado**: finalize como **Sem Conserto / Devolvido**.
! O link só aceita aprovação dentro da **validade** (conta a partir do envio). Vencido, o cliente vê o aviso e fala com a BRV; reenvie o orçamento para renovar a data.
! Pelo link o cliente só aprova. Recusa e dúvidas chegam pelo WhatsApp (botão na página) e você registra em **Registrar resposta**.
- Quando o cliente aprova o orçamento pelo link, o quadro atualiza sozinho: a placa ganha borda verde e o selo **Aprovado, iniciar reparo** (enquanto estiver em Entrada ou Diagnóstico). Ao mover para o reparo, o destaque some.
! O link do orçamento é diferente do link de acompanhamento do comprovante: o de acompanhamento não mostra valores.
! Retorno em **garantia** não tem orçamento.
! Só administrador e escritório veem o orçamento e o valor.
`,
    veja: ['placas-finalizar'],
  },
  {
    id: 'placas-finalizar',
    titulo: 'Entregar, finalizar sem conserto, arquivar ou cancelar',
    secao: 'Placas',
    telas: ['placa'],
    palavras: 'entregue faturado sem conserto devolvido arquivar cancelar reabrir pronto saida',
    texto: `
No rodapé da placa:
- **Entregue / Faturado**: só com a placa em **Pronto**. Informe a data de saída (hoje, por padrão; dá para escolher um dia anterior, desde a entrada da placa, mas não um dia futuro). A garantia de 90 dias conta daqui.
- **Sem Conserto / Devolvido**: o cliente recusou o orçamento ou não há conserto. Informe o **motivo**. Sem conserto **não gera reembolso**.
- **Arquivar**: tira da lista sem apagar o histórico.
- **Cancelar entrada**: registro feito por engano. Informe o motivo.
- **Reabrir** (só administrador): placa finalizada volta para **Pronto** (entregue) ou **Diagnóstico** (sem conserto).
- Placa finalizada fica só para consulta.
> Na aba **Finalizadas** há filtro por desfecho (**Entregue / Faturado**, **Sem Conserto / Devolvido**) e por **Ano**.
`,
  },
  {
    id: 'placas-garantia',
    titulo: 'Garantia de 90 dias e retorno em garantia',
    secao: 'Placas',
    telas: ['placa'],
    palavras: 'garantia termo 90 dias retorno voltou defeito de novo validade',
    texto: `
- Toda placa **entregue** tem **garantia de 90 dias** a contar da data de saída. A validade aparece na placa (**Garantia vigente** ou **Garantia expirada**) e na página de acompanhamento do cliente.
- **Termo de garantia**: abre o termo em A4 com os componentes trocados, a validade e as condições. Ao confirmar a entrega, ele **abre sozinho** pronto para imprimir (e fica no botão depois). Use **Imprimir termo** e entregue na retirada, com a assinatura do cliente (o termo não vai pelo WhatsApp).
- Preencha **Componentes trocados (sai no Termo de Garantia)** na seção Bancada antes de entregar.
- Se a placa voltar dentro do prazo, registre uma **Nova placa** marcando **Retorno em garantia** e escolhendo a **Placa original entregue** (vale para cliente de balcão e para placa retirada em campo, depois de consultar a OS). Ela não passa por orçamento, e a original abre pelo link **Abrir placa original**.
! Só aparecem placas **entregues com a garantia vigente**. Garantia vencida, ou sem a placa original, entra como placa normal, com orçamento: desmarque **Retorno em garantia**.
! Retorno em garantia é definido na entrada e não muda depois.
- Quando a placa que voltou em garantia é entregue de novo, o serviço refeito ganha **novos 90 dias** a partir da nova saída; o termo dela sai como **Isento (retorno em garantia)** e cita a placa original.
`,
  },
  {
    id: 'placas-comprovante',
    titulo: 'Comprovante de entrada, etiqueta e link de acompanhamento',
    secao: 'Placas',
    telas: ['placa', 'placas'],
    palavras: 'comprovante etiqueta link acompanhamento parceiro pagina publica qr elgin novo link',
    texto: `
Na placa, no alto: **Comprovante** e **Etiqueta**.
- **Comprovante**: documento A4 com os dados da entrada, os termos e o **link de acompanhamento**. **Imprimir comprovante** ou **Enviar o link pelo WhatsApp**.
- **Etiqueta**: escolha **100 × 50 mm** ou **80 × 50 mm**, a **Quantidade de cópias** e clique em **Imprimir na Elgin**. A tela mostra se a Elgin está pronta e, depois, **Etiqueta impressa** ou o motivo da falha. A etiqueta leva o número, o cliente, o telefone, o equipamento, o modelo, o código da placa, o defeito e um QR que abre a placa.
- Sem sinal do servidor da loja (computador desligado ou sem internet), use **Imprimir pelo navegador** (no Chrome, em Margens, escolha **Nenhuma**).
## Link de acompanhamento do parceiro
Na seção **Acompanhamento do cliente**: **Copiar link**, **Enviar pelo WhatsApp**, **Abrir página pública** e **Gerar novo link**.
- O parceiro abre o link, **sem senha**, e vê o número, o equipamento, a etapa atual com as datas, as fotos e a situação do orçamento. **Não** vê valores, diagnóstico interno nem reembolso.
- **Gerar novo link** faz o link antigo parar de funcionar (use se o link foi para a pessoa errada).
> Etiqueta saiu cortada, torta ou com etiqueta em branco no meio? Veja o tópico "A etiqueta não saiu na Elgin" nas Dúvidas comuns.
`,
  },
  {
    id: 'placas-fotos-historico',
    titulo: 'Fotos e histórico da placa',
    secao: 'Placas',
    telas: ['placa'],
    palavras: 'foto anexar antes depois historico nota anotar diagnostico bancada',
    texto: `
- **Fotos**: **Anexar fotos** (várias de uma vez) e filtre por **Antes (entrada)**, **Depois (reparo/teste)** e **Outros**. Clique na foto para ampliar. Cada foto guarda a etapa em que foi tirada.
- **Bancada**: **Código de erro**, **Diagnóstico técnico de bancada** e **Componentes trocados**. Clique em **Salvar bancada**.
- **Histórico**: linha do tempo com tudo o que aconteceu. Use **Anotar no histórico** para escrever uma nota. Notas não podem ser apagadas.
`,
  },
  {
    id: 'placas-clientes',
    titulo: 'Clientes de placas',
    secao: 'Placas',
    telas: ['placas-clientes'],
    palavras: 'cliente parceiro instalador final cadastro telefone excluir',
    texto: `
Cadastro **à parte** dos clientes do sistema, para os instaladores parceiros e os clientes finais do laboratório.
- Busque pelo nome ou telefone (sem acento) e filtre por **Todos**, **Parceiros** ou **Cliente final**.
- **Novo cliente**: nome, telefone, tipo, cidade, CPF/CNPJ, endereço e observações. **Cadastrar cliente** salva; **Salvar alterações** grava a edição.
- **Ver placas** mostra todas as placas do cliente; **Abrir placa** leva ao detalhe.
- **Excluir cadastro** só funciona se o cliente não tiver nenhuma placa.
> A mesma pessoa pode estar aqui e em **Clientes**; os dois cadastros não se misturam.
`,
  },
  {
    id: 'placas-financeiro',
    titulo: 'Financeiro das placas e reembolso',
    secao: 'Placas',
    telas: ['placas-financeiro', 'placa'],
    palavras: 'financeiro faturamento ticket reembolso bancada encalhadas ano mes valor cobrado',
    texto: `
Só quem tem acesso ao financeiro das placas vê esta parte (hoje, só o Braulio). Para os demais, o item **Financeiro das placas** (no menu Placas) não aparece e o valor cobrado e o reembolso ficam escondidos.
## Na tela Financeiro das placas
- Escolha o **Ano de competência**.
- Cartões: **Faturamento do mês**, **Ticket médio do mês**, **Valor na bancada (em aberto)**, **Placas encalhadas** e **Total do ano**.
- O gráfico mostra o faturamento mês a mês; clique num mês e **Ver placas** para ver as placas entregues e os reembolsos daquele mês.
- Rankings das **marcas** e dos **defeitos** mais comuns.
## Na placa
- **Valor efetivamente cobrado (R$)** e **Salvar valor cobrado**: é o que entra no faturamento (sem ele vale o valor do orçamento).
- **Reembolsada (desconta do faturamento líquido)**: marque e informe **Valor reembolsado (R$)**, **Data do reembolso** e **Motivo do reembolso**; clique em **Salvar reembolso**.
! Reembolso é a devolução do dinheiro que o cliente pagou. **Sem conserto não gera reembolso.**
`,
  },
  {
    id: 'placas-fichas',
    titulo: 'Fichas técnicas dos splits',
    secao: 'Placas',
    telas: ['placas-fichas'],
    palavras: 'ficha tecnica split fabricante linha btu gas cobre eletrica imprimir cadastrar ia',
    texto: `
Consulta de fichas técnicas por fabricante, linha, modelo ou capacidade (BTUs). Digite na busca (não precisa de acento) e use os filtros.
- **Abrir ficha completa** mostra as seções **Identificação**, **Linha frigorífica**, **Elétrica** e **Notas**. Campo sem dado aparece como "—".
- **Abrir manual original** abre o arquivo de onde a ficha saiu. **Imprimir ficha A4** imprime a ficha.
- **Cadastrar ficha com IA** (administrador e escritório): **Escolher manual e ler com IA**, envie o PDF ou TXT do manual, **revise** os campos marcados **conferir** e as lacunas, e clique em **Confirmar revisão e salvar ficha**.
- **Editar** e **Excluir** só o administrador.
! Esta tela ainda mostra **fichas de exemplo**. As fichas reais e a leitura por IA entram na próxima etapa.
`,
  },
  {
    id: 'placas-erros',
    titulo: 'Códigos de erro',
    secao: 'Placas',
    telas: ['placas-erros'],
    palavras: 'codigo erro e1 ch05 led piscadas significado causa verificar marca modelo',
    texto: `
1. Preencha **Marca**, o **Modelo (opcional)** e o **Código ou sintoma** (ex.: "E1 Midea Inverter", "CH05 LG").
2. Clique em **Pesquisar código**.
O resultado traz o significado, as causas prováveis, o que verificar, os componentes envolvidos e o aviso de segurança. O selo diz a fonte: **Manual do fabricante** ou **Pesquisa da IA**.
! **Sugestão da IA: confirme na bancada.** Nunca troque componente só pelo que a IA disse.
## Quem pode consultar
- **Administrador e escritório**: em **Placas > Códigos de erro**, até **40 consultas por hora** por pessoa.
- **Técnico da oficina (Gustavo)**: item **Códigos de erro** no menu, até **6 consultas por hora**.
- **Técnicos de campo**: botão **Erros** no alto do app de campo, até **6 consultas por hora**. Precisa de internet (não funciona offline).
Ao atingir o limite, aparece o aviso e a consulta volta a funcionar na hora seguinte.
`,
  },
  {
    id: 'placas-manuais',
    titulo: 'Manuais de fabricantes',
    secao: 'Placas',
    telas: ['placas-manuais'],
    palavras: 'manual pdf txt fabricante enviar texto extraido excluir',
    texto: `
Lista dos manuais usados nas consultas de erro e no cadastro de fichas. Busque por fabricante ou título.
- **Enviar manual** (administrador e escritório): escolha o PDF ou TXT, o fabricante e o título.
- Selo **Texto extraído**: o sistema leu o conteúdo e a consulta de erros pode usá-lo. **Sem texto extraído**: o arquivo só serve para abrir.
- **Abrir em nova aba** mostra o arquivo. **Excluir** só o administrador.
`,
  },

  // ───────────── Relatórios ─────────────
  {
    id: 'relatorios',
    titulo: 'Relatórios',
    secao: 'Relatórios',
    telas: ['relatorios'],
    palavras: 'relatorio produtividade grafico mes tecnico garantia',
    texto: `
No menu **Relatórios**:
- **Atividades**: por técnico no mês, com atividades realizadas, dias trabalhados, média por dia e média das avaliações.
- **Gráficos**: atividades dos últimos 12 meses, com tabela.
- **Tipos de Serviços**: quantas de cada tipo no mês e a porcentagem do total.
- **Garantia BRV**: ranking de técnicos em atendimentos de garantia, por mês ou por ano.
- Conta como realizada a atividade **concluída**, no dia em que terminou. Dia trabalhado é o dia com pelo menos uma concluída.
- A avaliação conta no mês em que o cliente respondeu.
`,
  },

  // ───────────── Equipe ─────────────
  {
    id: 'colaboradores',
    titulo: 'Cadastrar um funcionário',
    secao: 'Equipe e acessos',
    telas: ['equipe'],
    palavras: 'tecnico colaborador funcionario mecanico cor contratar',
    texto: `
1. No menu, clique em **Equipe**, aba **Funcionários**.
2. Clique em **Novo funcionário**.
3. Preencha **Nome completo** e escolha o **Cargo**. Se o cargo não existir, crie antes em **Cadastros > Cargos**.
4. Escolha a **Cor na linha do tempo** e preencha telefone e e-mail.
5. Em **Login de acesso ao app**, ligue o login do técnico. Sem login, ele aparece na agenda mas não usa o app.
6. Clique em **Salvar**.
- Quem tem cargo da categoria **Atende em campo** aparece na linha do tempo e na escolha do técnico.
- Para criar o login, use a aba **Usuários e acessos** (só o administrador).
- Funcionário que saiu da empresa: desmarque **Ativo**. O histórico de atendimentos e avaliações continua.
`,
    veja: ['cargos', 'dados-pessoais'],
  },
  {
    id: 'dados-pessoais',
    titulo: 'Dados pessoais do funcionário (CPF, endereço, carteira de trabalho)',
    secao: 'Equipe e acessos',
    telas: ['equipe'],
    palavras: 'cpf rg endereco ctps carteira trabalho pis nis admissao nascimento cft registro lgpd',
    texto: `
Só o **administrador** vê e preenche estes dados. O escritório e o técnico não enxergam (LGPD).
1. Em **Equipe > Funcionários**, clique no funcionário.
2. Na parte **Dados pessoais**, preencha o que tiver: CPF, RG, nascimento, admissão, PIS/NIS, carteira de trabalho, registro profissional e endereço.
3. Digite o **CEP** para a rua, o bairro e a cidade virem preenchidos.
4. Clique em **Salvar**.
- **Carteira de trabalho digital** (desde 2019): o número é o próprio CPF. Deixe número e série em branco.
- **Registro profissional**: por exemplo, o CFT do responsável técnico, usado no PMOC.
- O CPF é conferido ao salvar e não pode se repetir entre funcionários.
`,
  },
  {
    id: 'cargos',
    titulo: 'Cadastro de cargos',
    secao: 'Cadastros',
    telas: ['cadastros', 'equipe'],
    palavras: 'cargo funcao mecanico refrigeracao ajudante eletricista categoria',
    texto: `
1. No menu, clique em **Cadastros > Cargos**.
2. Clique em **Novo cargo** e dê o nome (ex.: "Mecânico de Refrigeração", "Ajudante", "Eletricista").
3. Escolha a **Categoria**:
- **Atende em campo**: aparece na linha do tempo, na agenda e nos relatórios de técnicos.
- **Atende na oficina**: trabalha na oficina da loja. Não aparece na linha do tempo nem nos relatórios de técnicos.
- **Auxiliar**, **Supervisão** ou **Administrativo**: não recebe atividades próprias.
4. Clique em **Salvar**. O cargo passa a aparecer no cadastro do funcionário.
- Mudar a categoria de um cargo muda todos os funcionários dele.
- Cargo que não se usa mais: desmarque **Ativo**. Só dá para excluir cargo sem funcionários (e só o administrador).
`,
    veja: ['colaboradores'],
  },
  {
    id: 'usuarios',
    titulo: 'Criar usuário, bloquear ou redefinir senha (administrador)',
    secao: 'Equipe e acessos',
    telas: ['equipe'],
    palavras: 'usuario login acesso senha bloquear permissao papel',
    texto: `
Só o administrador vê a aba **Usuários e acessos** em **Equipe**.
1. Clique em **Novo usuário**.
2. Preencha **Nome**, **E-mail** (é o login), **Papel** e, para técnico, o **Colaborador ligado a este login**.
3. Defina a **Senha temporária**, clique em **Criar usuário** e passe a senha para a pessoa. Ela não aparece de novo.
Papéis:
- **Administrador**: tudo, inclusive excluir.
- **Escritório**: clientes, OS, agenda e relatórios.
- **Técnico**: só o app de campo, com as próprias atividades.
- **Oficina**: só a tela **Oficina**. Não vê clientes, OS nem telefones.
- **Bloquear**: abra o usuário e desmarque **Ativo**.
- **Esqueceu a senha**: abra o usuário e clique em **Redefinir senha**.
`,
  },

  // ───────────── Dúvidas comuns ─────────────
  {
    id: 'tecnico-nao-recebeu',
    titulo: 'O técnico não viu a atividade nova',
    secao: 'Dúvidas comuns',
    telas: ['linha-do-tempo', 'os', 'geral'],
    palavras: 'notificacao aviso celular nao chegou push',
    texto: `
- O app de campo mostra só as atividades de **hoje**. Atividade de amanhã aparece amanhã.
- Com o app aberto, a atividade nova aparece destacada com bipe. Com o app fechado, chega uma notificação, se o técnico ativou.
- Em celular Xiaomi, libere o Chrome em bateria "Sem restrições" e em "Início automático".
- Peça ao técnico para fechar e abrir o app de novo.
- Confira se a atividade está no **técnico certo** e na **data certa**.
`,
  },
  {
    id: 'um-aparelho',
    titulo: '"Login usado em 2 aparelhos" e técnico que saiu sozinho do app',
    secao: 'Dúvidas comuns',
    telas: ['mapa', 'equipe', 'geral'],
    palavras: 'senha compartilhada dois celulares aparelho saiu deslogou login outro celular seguranca',
    texto: `
Cada técnico usa o sistema em **um celular só**. Quando ele entra num celular novo, o aparelho anterior sai sozinho em até 1 minuto, com o aviso "Seu login foi aberto em outro aparelho".
- No **Mapa**, o alerta **Login usado em 2 aparelhos nas últimas 24 h** aparece ao lado do técnico.
- Se ele **trocou de celular** ou reinstalou o app, o alerta é normal e some em 24 horas.
- Se **não** trocou, a senha pode ter sido passada para outra pessoa:
1. Fale com o técnico.
2. O administrador troca a senha em **Equipe > Usuários e acessos**, abrindo o usuário e clicando em **Redefinir senha**.
3. Passe a senha nova só para o técnico.
! O navegador (Chrome) e o app BRV Control no mesmo celular contam como **dois aparelhos**. O técnico deve usar só o app.
`,
  },
  {
    id: 'sem-internet-tecnico',
    titulo: 'Técnico sem internet no local',
    secao: 'Dúvidas comuns',
    telas: ['geral', 'mapa'],
    palavras: 'sem sinal offline internet fila pendente',
    texto: `
O app de campo funciona sem sinal: iniciar, concluir e as fotos ficam guardados no celular e sobem sozinhos quando a internet volta.
- Até subir, o escritório não vê a mudança. A OS e o Mapa podem parecer atrasados.
- Os formulários precisam de internet.
`,
  },
  {
    id: 'nao-acho',
    titulo: 'Não encontro uma tela ou um botão',
    secao: 'Dúvidas comuns',
    telas: ['geral'],
    palavras: 'sumiu nao aparece permissao acesso restrito',
    texto: `
- Algumas telas e botões aparecem só para certos papéis. Excluir foto, excluir etiqueta e a aba de usuários são só do administrador.
- Se aparecer **Acesso restrito**, seu usuário não tem permissão para aquela tela.
- No celular, o menu fica escondido no ícone ☰.
- Se uma tela parecer desatualizada, aperte **F5** para recarregar.
`,
  },

  // ───────────── Vendas (catálogo e orçamentos ligados ao banco em 2026-11-25) ─────────────
  {
    id: 'catalogo-como-funciona',
    titulo: 'Catálogo de produtos e serviços',
    secao: 'Vendas',
    telas: ['catalogo'],
    palavras: 'catalogo produto servico preco codigo barras estoque inativar reativar duplicar frequente fabricante custo',
    texto: `
Cada item do catálogo é **Produto** (sai na nota de produto, NFC-e ou NF-e) ou **Serviço** (sai na NFS-e). O orçamento e a venda separam os dois sozinhos.
- **Novo item**: código, nome, tipo, unidade, categoria, **Preço de venda (R$)**, **Fabricante** e **Observações (uso interno)**. O campo **Custo (R$)** só aparece para quem tem acesso financeiro completo.
- Abas **Todos**, **Produtos**, **Serviços** e **Inativos**, e o filtro de categoria. A busca acha por código, código de barras, nome, categoria, fabricante ou observação, sem acento.
- Na linha do item: o lápis edita, **Duplicar** copia e **Inativar** tira o item das buscas do orçamento e da venda. Item nunca se exclui (pode já estar em orçamentos); **Reativar** traz de volta.
- **Item frequente** vira atalho na Nova venda.
- O código não pode repetir (maiúsculas e minúsculas contam como iguais).
- Quando o preço de venda muda, o sistema guarda a data do reajuste.
`,
    veja: ['catalogo-revisar-tipos', 'catalogo-dados-fiscais'],
  },
  {
    id: 'catalogo-revisar-tipos',
    titulo: 'Revisar tipos: produto que na verdade é serviço',
    secao: 'Vendas',
    telas: ['catalogo'],
    palavras: 'revisar tipos mao de obra m.o instalacao converter servico',
    texto: `
O botão **Revisar tipos (N)** aparece quando há produtos com nome de mão de obra ("M.O ...", instalação, manutenção, visita).
1. Clique em **Revisar tipos**: a lista já vem toda marcada.
2. Desmarque o que for produto de verdade.
3. Clique em **Converter em Serviço**.
- A unidade "UN" vira "SRV". O código de serviço e o ISS ficam em branco até serem preenchidos em **Dados fiscais** do item.
`,
    veja: ['catalogo-dados-fiscais'],
  },
  {
    id: 'catalogo-dados-fiscais',
    titulo: 'Dados fiscais do item',
    secao: 'Vendas',
    telas: ['catalogo'],
    palavras: 'ncm cfop csosn origem iss codigo de servico nfse nfce nfe fiscal nota',
    texto: `
Ficam em **Dados fiscais**, no cadastro do item.
- **Produto**: NCM (8 dígitos), **CFOP**, **CSOSN** (no item novo vêm sugeridos 5102 e 102, Simples Nacional), **Origem da mercadoria** e **Unidade tributável**. No item que já existe, campo em branco continua em branco.
- **Serviço**: código de serviço, alíquota de ISS e **Descrição para a NFS-e**.
- O triângulo amarelo na lista avisa que falta dado fiscal.
! A emissão das notas ainda não está ligada (o provedor não foi escolhido). Preencher agora deixa o catálogo pronto para quando estiver.
`,
  },
  {
    id: 'orcamentos-lista',
    titulo: 'Lista de orçamentos e situações',
    secao: 'Vendas',
    telas: ['orcamentos'],
    palavras: 'orcamento lista situacao rascunho enviado aprovado recusado convertido vencido filtro periodo vendedor',
    texto: `
- Situações: **Rascunho** (ainda não foi ao cliente), **Enviado**, **Aprovado**, **Recusado**, **Convertido** (virou venda ou OS) e **Vencido** (enviado com a validade passada).
- Filtros: situação, vendedor, **Produtos e serviços** / **Com serviço** / **Com produto** e o **Período** (data em que o orçamento foi feito).
- A busca acha por número, cliente, contato, vendedor ou nome de item.
- A numeração vai de **ORC-30001** em diante (o SicWeb parou no 28.092: os números nunca se cruzam).
- O total no rodapé soma os orçamentos do filtro.
`,
    veja: ['orcamento-criar'],
  },
  {
    id: 'orcamento-criar',
    titulo: 'Fazer um orçamento',
    secao: 'Vendas',
    telas: ['orcamentos', 'orcamento'],
    palavras: 'novo orcamento item avulso desconto frete validade condicao pagamento textos padrao observacoes vendedor',
    texto: `
1. **Novo orçamento**.
2. **Cliente**: busque pelo nome, CPF/CNPJ ou telefone (setas ↓/↑ e Enter) ou marque **Consumidor final**. O endereço vem do cadastro.
3. **Contato**, **Telefone / WhatsApp** e **Vendedor(a)** (já vem você).
4. **Itens**: na linha de inclusão, digite primeiro a **quantidade** (vazio = 1) e tecle Enter; depois digite código ou nome, escolha com ↓/↑ e Enter. O cursor volta para a quantidade. **Item avulso** para o que não está no catálogo.
5. **Validade (dias)** (padrão 10), **Desconto geral (R$)**, **Frete (R$)** e **Condição de pagamento**.
6. **Observações**: **Textos padrão** insere as observações prontas. **Observações internas (só o escritório)** nunca vão para o cliente.
7. **Salvar**.
- O sistema refaz as contas de cada item e do total ao salvar.
- As observações prontas se cadastram em **Textos padrão**, na lista de orçamentos.
`,
    veja: ['orcamento-enviar-aprovar', 'setas-teclado'],
  },
  {
    id: 'orcamento-enviar-aprovar',
    titulo: 'Enviar pelo WhatsApp e aprovação do cliente',
    secao: 'Vendas',
    telas: ['orcamento'],
    palavras: 'whatsapp link aprovar aprovacao cliente registrar resposta recusado pdf imprimir novo link',
    texto: `
- **Enviar pelo WhatsApp** abre a conversa com o link do orçamento. Ele passa a **Enviado** e a validade conta a partir de hoje.
- O cliente abre o link sem senha, vê o orçamento, pode **Salvar em PDF / Imprimir** e aprova em **Aprovar orçamento**, digitando o nome. O orçamento fica **Aprovado** e o histórico registra quem aprovou.
- Orçamento vencido não se aprova pelo link: o cliente vê o aviso para falar com a BRV.
- Resposta por telefone, WhatsApp ou pessoalmente: **Registrar resposta** (Aprovado ou Recusado, canal e observação).
- **Novo link** troca o link; o anterior para de abrir.
- **Imprimir / PDF** gera a folha A4.
`,
    veja: ['orcamento-alterar', 'orcamento-converter'],
  },
  {
    id: 'orcamento-alterar',
    titulo: 'Alterar, duplicar ou excluir um orçamento',
    secao: 'Vendas',
    telas: ['orcamento'],
    palavras: 'reabrir editar duplicar excluir anotar historico',
    texto: `
- Orçamento enviado ou aprovado não se altera: **Reabrir para editar** volta para rascunho e troca o link (o que o cliente recebeu para de abrir).
- Orçamento convertido não reabre: use **Duplicar**, que cria outro número em rascunho com os mesmos itens.
- **Excluir** só existe no rascunho.
- **Anotar** grava uma nota no **Histórico** (quem e quando). O histórico também registra criação, envio, respostas e conversões.
`,
  },
  {
    id: 'orcamento-converter',
    titulo: 'Converter em venda ou gerar OS',
    secao: 'Vendas',
    telas: ['orcamento'],
    palavras: 'gerar os ordem de servico converter venda convertido agendar',
    texto: `
- **Gerar OS** cria uma OS agendada, ainda sem atividade, com os serviços na **Solicitação do cliente**. Depois agende o técnico pela **Linha do tempo** (Nova atividade).
- O tipo de serviço da OS é escolhido pelo nome dos serviços (instalação, manutenção). Confira na OS e troque se precisar.
- Precisa de cliente cadastrado (Consumidor final não tem OS) e de pelo menos um item de serviço.
- **Converter em venda** abre a Nova venda já com os itens do orçamento.
- Convertido, o orçamento fica só para consulta.
`,
    veja: ['criar-os'],
  },
  {
    id: 'venda-nova',
    titulo: 'Fazer uma venda',
    secao: 'Vendas',
    telas: ['vendas', 'venda'],
    palavras: 'nova venda balcao pdv carrinho pagamento pix cartao dinheiro troco parcelas maquininha a receber consumidor final cpf na nota frete desconto',
    texto: `
1. **Nova venda**.
2. Inclua os itens: digite a **quantidade** (vazio = 1), Enter, e depois o código ou o nome. Com o leitor, é só ler o código de barras no próprio campo da quantidade (entra 1 unidade; para várias, leia de novo ou mude a quantidade na linha). **Item avulso** para o que não está no catálogo.
3. **Cliente**: vazio é **Consumidor final**; para pôr o CPF ou CNPJ na nota, use **CPF/CNPJ na nota**.
4. **Pagamento**: use os atalhos de forma de pagamento ou **Adicionar forma** para dividir. No cartão escolha a **Maquininha** e as **Parcelas**; no PIX, boleto, transferência ou cheque, a **Conta de destino**; no dinheiro, informe o **Recebido (R$)** e veja o troco.
5. **Concluir venda**.
- Venda sem pagamento (**A receber**) ou paga em parte exige cliente cadastrado.
- Registrar pagamento exige acesso financeiro (caixa ou completo). Desconto acima de **10%** exige acesso completo.
- Venda que vem de orçamento traz os itens, o desconto e o frete, e o orçamento fica **Convertido**.
- A venda ainda não baixa o estoque.
`,
    veja: ['venda-receber-cancelar', 'venda-notas', 'setas-teclado'],
  },
  {
    id: 'venda-lista',
    titulo: 'Lista de vendas',
    secao: 'Vendas',
    telas: ['vendas'],
    palavras: 'lista vendas filtro periodo a receber canceladas situacao forma origem nota',
    texto: `
- Abas **Todas**, **A receber** e **Canceladas**; filtros por situação, forma de pagamento, origem, notas e **Período**.
- A busca acha por número, cliente, vendedor, item, orçamento, OS ou número da nota.
- A numeração vai de **VND-30001** em diante.
- As vendas feitas no SicWeb não entram nesta lista: ficam na aba **Vendas** do cadastro do cliente.
`,
    veja: ['venda-nova', 'vendas-cliente'],
  },
  {
    id: 'venda-receber-cancelar',
    titulo: 'Receber o saldo ou cancelar uma venda',
    secao: 'Vendas',
    telas: ['venda'],
    palavras: 'receber saldo parcial cancelar venda estorno motivo recibo imprimir',
    texto: `
- **Receber saldo**: informe uma ou mais formas de pagamento. Pode usar a data de um dia anterior; data futura não é aceita.
- **Cancelar venda** (só acesso financeiro completo): pede o motivo e estorna os lançamentos. Os pagamentos continuam no histórico.
- Venda com nota registrada só cancela depois de a nota ser cancelada.
- O orçamento de uma venda cancelada continua **Convertido**: para vender de novo, **Duplicar** o orçamento ou fazer **Nova venda**.
- **Recibo** abre a folha para imprimir.
! Pagamento no cartão entra na conta no dia útil seguinte (feriado não é considerado), com a taxa da maquininha lançada como tarifa.
`,
    veja: ['venda-nova', 'financeiro-cadastros'],
  },
  {
    id: 'venda-notas',
    titulo: 'Notas fiscais da venda',
    secao: 'Vendas',
    telas: ['venda'],
    palavras: 'nota fiscal nfce nfe nfse registrar numero portal preparar cancelar nota produtos servicos',
    texto: `
Uma venda com produtos e serviços tem **duas notas**. O sistema **ainda não emite nota**: emita no emissor atual e registre o número.
- **Serviços (NFS-e)**: **Preparar para o portal** mostra tomador, descrição e valor, com botão **Copiar** em cada um. Depois de emitir no portal, informe o número e clique em **Registrar NFS-e**.
- **Produtos**: escolha NFC-e ou NF-e e clique em **Registrar número da nota**.
- O desconto geral é repartido entre as duas notas e o frete vai na de produtos: somadas, dão o total da venda.
- **Cancelar nota** (acesso completo) só marca a nota como cancelada. O cancelamento fiscal é feito onde ela foi emitida.
`,
    veja: ['venda-receber-cancelar'],
  },
  {
    id: 'financeiro-cadastros',
    titulo: 'Contas, maquininhas, categorias e fornecedores',
    secao: 'Financeiro',
    telas: ['financeiro-cadastros', 'venda'],
    palavras: 'conta banco caixa saldo inicial maquininha taxa debito credito parcelado prazo categoria fornecedor',
    texto: `
Ficam nos cadastros do Financeiro, só para o acesso completo. Nada se exclui: desative o que não usar.
- **Contas**: dinheiro vai para a conta do tipo caixa; PIX, boleto, transferência e cheque, para um banco.
- **Maquininhas**: **Conta de liquidação**, **Prazo (dias úteis)** e as taxas de débito, crédito à vista e de cada número de parcelas.
! As maquininhas começam com **taxa zero**. Cadastre as taxas reais antes de registrar vendas no cartão: a venda já lançada não é recalculada.
`,
    veja: ['venda-nova'],
  },
  {
    id: 'vendedores',
    titulo: 'Vendedores: quem acessa as vendas',
    secao: 'Vendas',
    telas: ['vendedores', 'vendas', 'orcamentos', 'catalogo'],
    palavras: 'vendedor vendedores acesso restrito permissao nivel caixa completo liberar bloquear quem vende orcamento catalogo nome',
    texto: `
Só **vendedores** e administradores entram em **Orçamentos**, **Vendas** e **Catálogo**. Quem cadastra é o administrador, em **Vendas > Vendedores** (também há o botão **Vendedores** na tela de Vendas).
1. Na linha do login, marque **Vendedor(a)**. Antes de marcar, confira o **Nome no orçamento**: é ele que sai no documento.
2. Escolha o **Nível**: **caixa** (orçamentos, vendas e pagamentos) ou **completo** (também vê custo, cancela venda, dá desconto acima de 10% e mexe nos cadastros do financeiro).
- Desmarcar tira o acesso na hora. Orçamentos e vendas já feitos continuam com o nome de quem vendeu.
- O campo **Vendedor(a)** lista só quem está marcado. O administrador sempre entra; marque-o se o nome dele deve aparecer na lista.
- O login precisa existir antes: crie em **Cadastros > Equipe > Usuários**, com o papel escritório.
! Depois de liberar, a pessoa precisa recarregar a página (F5) para o acesso aparecer.
`,
    veja: ['orcamento-modelos', 'venda-nova'],
  },
  {
    id: 'orcamento-modelos',
    titulo: 'Modelos de orçamento e de venda',
    secao: 'Vendas',
    telas: ['orcamento', 'venda', 'orcamentos', 'vendas'],
    palavras: 'modelo modelos botao pronto instalacao split 9000 12000 18000 kit preencher automatico itens salvar como modelo excluir quantidade em branco',
    texto: `
Os botões em **Modelos**, acima dos itens, incluem de uma vez a lista pronta de um serviço, com o **preço atual do catálogo**.
1. Clique no modelo (ex.: **Inst 9.000**). As quantidades ficam **em branco** (campo amarelo); a mão de obra já vem preenchida.
2. Digite a quantidade e tecle **Enter**: o cursor pula para a próxima em branco.
3. Ao salvar o orçamento ou concluir a venda, os itens que continuaram em branco **ficam de fora** (o sistema mostra quais e pede confirmação).
- Item que já estava na tela não é repetido.
- **Criar um modelo**: monte os itens e clique em **Salvar como modelo**. Produtos são guardados sem quantidade; serviços guardam a quantidade da tela. Usar o nome de um modelo existente substitui os itens dele.
- **Excluir modelo**: clique no botão e depois no modelo. Orçamentos já feitos não mudam.
- Item avulso não entra no modelo, e item inativado no catálogo fica de fora com um aviso.
`,
    veja: ['venda-nova', 'vendedores'],
  },
  // ───────────── PMOC ─────────────
  {
    id: 'pmoc-o-que-e',
    titulo: 'O que é o PMOC no sistema',
    secao: 'PMOC',
    telas: ['pmoc', 'pmoc-plano'],
    palavras: 'plano manutencao operacao controle lei 13589 contrato anual climatizacao',
    texto: `
O **PMOC** (Plano de Manutenção, Operação e Controle) é o plano anual de manutenção dos aparelhos de ar-condicionado de um local, exigido pela Lei 13.589/2018 e pela Portaria 3.523/1998. A BRV vende como contrato: o plano vale 12 meses e, todo mês, o técnico faz o checklist de cada aparelho.
No sistema, cada plano tem:
1. **Geral**: cliente, endereço atendido, vigência, situação, responsável técnico e o termo TRT.
2. **Ambientes**: as salas climatizadas (nome, sigla, ocupantes e área).
3. **Equipamentos**: os aparelhos de cada ambiente.
4. **Cronograma**: as tarefas de cada aparelho e de quanto em quanto tempo são feitas.
5. **Execução** e **Documento**: o acompanhamento mês a mês e o documento para imprimir.
Todo mês o escritório gera a **OS do mês** (aba **PMOC do mês**), o técnico preenche o checklist no celular e o cliente recebe o relatório por link. Cada aparelho tem uma etiqueta com QR Code.
`,
    veja: ['pmoc-novo-plano', 'pmoc-lista', 'pmoc-do-mes'],
  },
  {
    id: 'pmoc-lista',
    titulo: 'Lista de planos PMOC',
    secao: 'PMOC',
    telas: ['pmoc'],
    palavras: 'vigente vencendo vencido rascunho encerrado proxima visita atrasada filtro',
    texto: `
Menu **Serviços > PMOC**. Cada plano mostra o cliente, a vigência, quantos aparelhos tem e a próxima visita.
- **Rascunho**: ainda em preparação, pode ser salvo incompleto.
- **Vigente**: contrato em andamento. **Vence em até 60 dias** aparece em amarelo, para lembrar a renovação; **Vencido** em vermelho.
- **Encerrado**: contrato terminado.
- **Visitas atrasadas**: meses que já passaram sem a manutenção registrada.
Use **Novo plano** para criar e **Modelo de tarefas** para mudar as tarefas padrão de cada tipo de aparelho.
`,
  },
  {
    id: 'pmoc-novo-plano',
    titulo: 'Criar um plano PMOC',
    secao: 'PMOC',
    telas: ['pmoc', 'pmoc-plano'],
    palavras: 'novo plano cadastrar contrato pmoc salvar vigente rascunho',
    texto: `
1. Em **PMOC**, clique em **Novo plano**.
2. Aba **Geral**: escolha o cliente e o **endereço atendido**. A vigência vem com 12 meses a partir de hoje (dá para mudar). O **responsável técnico** já vem preenchido.
3. Aba **Ambientes**: **Adicionar ambiente** para cada sala. A **sigla** (2 ou 3 letras, ex.: SR para Sala de Reunião) forma o código dos aparelhos.
4. Aba **Equipamentos**: **Adicionar equipamento do cliente** (aparelhos já cadastrados) ou **Adicionar linha manual** (aparelho novo). Escolha o ambiente de cada um.
5. Aba **Cronograma**: as tarefas de cada aparelho já vêm do modelo do tipo dele. Ajuste se precisar.
6. Clique em **Salvar**. O plano ganha o número **PMOC-AAAA-NNNN**.
Para o plano ficar **Vigente**, o sistema exige: endereço, responsável técnico com nome, CPF e registro, número do **TRT** e todos os aparelhos ativos com ambiente. Enquanto faltar algo, deixe como **Rascunho**.
> O plano é gravado inteiro de uma vez: se der erro, nada fica pela metade. Corrija o que a mensagem pedir e salve de novo.
`,
    veja: ['pmoc-responsavel', 'pmoc-equipamentos'],
  },
  {
    id: 'pmoc-responsavel',
    titulo: 'Responsável técnico e TRT',
    secao: 'PMOC',
    telas: ['pmoc-plano'],
    palavras: 'responsavel tecnico cpf registro cft crea trt art termo anexo pdf',
    texto: `
- O responsável técnico é escolhido na lista de funcionários. O **CPF** e o **registro profissional** vêm do cadastro dele (**Equipe**, dados pessoais, que só o administrador edita). Se estiverem vazios, peça ao administrador para preencher lá.
- Registro **CFT** usa o termo **TRT**; registro **CREA** usa **ART**. O nome do termo muda sozinho conforme a escolha.
- Informe o **número do TRT** e anexe o arquivo do termo (**PDF** de até 10 MB ou imagem). Na última página do documento sai um cartão com o nome do arquivo e o número do TRT: se for **imagem**, ela aparece inteira; se for **PDF**, o conteúdo **não** é impresso junto (o arquivo fica guardado no plano). Envie o PDF do TRT ao cliente em separado.
> O nome, o CPF e o registro ficam guardados no plano como estavam ao salvar. Se o cadastro do funcionário mudar depois, escolha o responsável de novo no plano.
`,
  },
  {
    id: 'pmoc-equipamentos',
    titulo: 'Ambientes e equipamentos do plano',
    secao: 'PMOC',
    telas: ['pmoc-plano'],
    palavras: 'ambiente sigla identificador ar-sr-0001 aparelho equipamento remover desativar foto',
    texto: `
- O aparelho do PMOC é o mesmo do **cadastro do cliente** (menu **Equipamentos**). Aparelho incluído por **Adicionar linha manual** é criado no cadastro do cliente ao salvar; mudar tipo, marca, modelo, série ou BTU no plano também atualiza o cadastro.
- O **identificador** (ex.: **AR-SR-0001**) é montado pela sigla do ambiente. Pode ser trocado à mão, mas não pode repetir no plano.
- Ao **remover um ambiente**, os aparelhos dele ficam com o aviso **Escolha o ambiente**.
- Aparelho que **já teve manutenção registrada** não pode ser removido: desative-o (ele sai do cronograma e do documento, mas o histórico fica).
- A **foto** do aparelho aparece na tabela de equipamentos do documento.
- **Etiqueta com QR Code**: marque os aparelhos e clique em **Imprimir etiquetas**. Ela sai na impressora Elgin da loja (mesmo rolo da oficina, 100 × 50 mm) com o identificador, o ambiente e o QR. O QR abre a **ficha pública do aparelho** (\`/equipamento/...\`): cliente e fiscal veem o plano vigente, o responsável técnico e as últimas manutenções, sem dados pessoais. A impressora precisa estar ligada (servidor da loja).
`,
  },
  {
    id: 'pmoc-cronograma',
    titulo: 'Cronograma e modelo de tarefas',
    secao: 'PMOC',
    telas: ['pmoc-plano', 'pmoc-modelo'],
    palavras: 'tarefa periodicidade mensal trimestral semestral anual inicia em medicao corrente temperatura modelo',
    texto: `
- Cada aparelho tem a sua lista de tarefas, com **periodicidade** (mensal, bimestral, trimestral, semestral ou anual) e o mês em que **inicia**.
- Tarefas que pedem **medição** (corrente, temperaturas de insuflamento, retorno e ambiente) terão os campos para o técnico preencher no celular.
- Tarefa desativada fica riscada e não entra no documento nem nas visitas.
- O **Modelo de tarefas** (botão na lista de planos) guarda a lista padrão de cada tipo de aparelho (Split Hi-Wall, Cassete, Split Piso-Teto, VRF). Aparelho novo no plano recebe o modelo do tipo dele; tipo sem modelo recebe o do Split Hi-Wall.
> Mudar o modelo **não** muda os planos já criados: vale para os aparelhos incluídos depois.
`,
  },
  {
    id: 'pmoc-documento',
    titulo: 'Documento PMOC e relatório do mês',
    secao: 'PMOC',
    telas: ['pmoc-plano'],
    palavras: 'imprimir pdf documento capa relatorio mensal execucao visita atrasada',
    texto: `
- Aba **Documento** > **Imprimir / PDF**: na janela do navegador, escolha **Salvar como PDF** (A4 retrato). Sai a capa, a identificação do cliente e do responsável, os ambientes, os equipamentos, o cronograma, as recomendações e o TRT anexado.
- Aba **Execução**: a grade mostra, por aparelho e por mês, o que está previsto, feito ou atrasado. **Gerar OS** cria a OS do mês e **Relatório do mês** abre o relatório (imprimir, enviar pelo WhatsApp ou copiar o link).
`,
    veja: ['pmoc-do-mes', 'pmoc-relatorio-link'],
  },
  {
    id: 'pmoc-do-mes',
    titulo: 'PMOC do mês e Gerar OS',
    secao: 'PMOC',
    telas: ['pmoc', 'pmoc-plano'],
    palavras: 'pmoc do mes gerar os agendar tecnico data hora duracao sem os agendada executada atrasada dashboard painel',
    texto: `
Em **PMOC**, a aba **PMOC do mês** lista os planos vigentes com visita prevista no mês escolhido e a situação de cada um:
- **Sem OS**: ainda não foi gerada a OS do mês. Clique em **Gerar OS**.
- **OS agendada**: a OS existe e a visita está marcada. Mostra quantos aparelhos já foram feitos.
- **Executada**: todos os aparelhos foram feitos (ou justificados) e a visita foi concluída. Já dá para **Abrir relatório**, **WhatsApp** ou **Copiar link**.
- **Atrasada**: o mês passou sem a visita concluída.
O **Dashboard** mostra um cartão com o resumo do mês (só para admin e escritório).
**Gerar OS**: escolha o **técnico**, a **data e hora** e a **duração** (o sistema sugere 30 min por aparelho). O sistema cria a OS do tipo **PMOC**, já com os aparelhos do mês, e agenda a atividade na linha do tempo. É **uma OS por plano por mês**: se já existe, o botão abre a OS. Se a OS for cancelada, dá para gerar outra.
> Aparelho sem tarefa prevista no mês não entra na visita. Se nenhum aparelho tem tarefa no mês, o sistema avisa e não gera.
`,
    veja: ['pmoc-checklist-campo', 'pmoc-relatorio-link'],
  },
  {
    id: 'pmoc-checklist-campo',
    titulo: 'Checklist do PMOC no celular do técnico',
    secao: 'PMOC',
    telas: ['pmoc', 'pmoc-plano', 'os'],
    palavras: 'checklist tecnico celular campo aparelho tarefa medicao corrente temperatura foto nao atendido acompanhou concluir',
    texto: `
Na atividade de PMOC, o técnico vê o bloco **Checklist PMOC** com a lista de aparelhos da visita. Em cada aparelho ele:
1. marca cada tarefa como **Feito**, **Não feito** (com observação) ou **Não se aplica**;
2. preenche as **medições** pedidas (corrente e temperaturas) e tira as **fotos**;
3. toca em **Salvar aparelho**. Se não deu para atender (aparelho desligado, sem acesso), marca **Não foi possível atender** e escreve o motivo.
Para **concluir a atividade** todos os aparelhos precisam estar salvos e o técnico informa o **nome de quem acompanhou a visita** no cliente (não há assinatura). O nome sai no relatório.
- O checklist **precisa de internet**: se faltar sinal, salve quando a rede voltar. A conclusão da atividade também espera a internet.
- Medição muito fora do comum (corrente acima de 100 A, temperatura fora de -10 a 60 °C) só gera um aviso amarelo para conferir a digitação.
> O escritório também consegue abrir e preencher o checklist pela atividade, se precisar corrigir.
`,
  },
  {
    id: 'pmoc-relatorio-link',
    titulo: 'Relatório do mês por link (WhatsApp)',
    secao: 'PMOC',
    telas: ['pmoc', 'pmoc-plano'],
    palavras: 'relatorio mensal link publico whatsapp enviar copiar pdf cliente token',
    texto: `
Depois da visita, o relatório do mês fica disponível por **link público** (o cliente abre sem login, no celular ou no computador, e pode **Imprimir / Salvar PDF**).
- No **PMOC do mês** (ou na aba **Execução** do plano, **Relatório do mês**), use **WhatsApp** para abrir a conversa com o telefone do cliente e o link pronto, ou **Copiar link**.
- O relatório mostra o plano, o responsável técnico, os aparelhos atendidos (tarefas, medições e fotos), os não atendidos com o motivo e quem acompanhou a visita. **Não** mostra CPF/CNPJ do cliente.
- O link do mês é sempre o mesmo: reenviar não gera outro. Quem tem o link consegue ver o relatório, então envie só para o cliente.
`,
  },
];

export const topicoPorId = (id: string) => TOPICOS.find((t) => t.id === id);
