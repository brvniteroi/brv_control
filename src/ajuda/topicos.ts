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
  | 'equipe';

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
    id: 'menu',
    titulo: 'O menu e as telas do sistema',
    secao: 'Primeiros passos',
    telas: ['geral', 'dashboard'],
    palavras: 'navegar onde fica menu lateral',
    texto: `
O menu fica à esquerda. No celular, toque no ícone ☰ no alto para abrir.
- **Dashboard**: resumo do dia, com OS em aberto, atividades de hoje e o que precisa de atenção.
- **Serviços**: **Linha do Tempo**, **Calendário**, **Mapa** e **Ordens de Serviço**.
- **Cadastros**: **Clientes**, **Equipamentos**, **Tipos de Serviço**, **Etiquetas**, **Cargos** e **Modelos de Formulários**.
- **Relatórios**: atividades por técnico, gráficos, tipos de serviço e Garantia BRV.
- **Equipe**: funcionários e, para o administrador, os usuários do sistema.
Clique no nome de um grupo (Serviços, Cadastros, Relatórios) para abrir ou fechar a lista.
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
- **Precisam de Atenção**: OS atrasadas ou com prioridade alta/urgente. Clique para abrir.
> A página se atualiza sozinha a cada 2 minutos e quando você volta para a aba.
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
1. Em **Cadastros > Clientes**, digite na busca: nome, nome fantasia, e-mail, telefone ou CPF/CNPJ.
2. Clique em **Abrir** na linha do cliente.
- A busca ignora acentos: "joao" encontra "João".
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
5. Escolha o **Tipo de OS** e, se quiser, a **Prioridade** e o **Prazo**.
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
- Atividade **concluída**: OS **Concluída**.
O único caso que é sempre manual é o cancelamento (veja "Cancelar uma OS").
`,
    veja: ['cancelar-os'],
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
- Para incluir fotos pelo escritório, clique em **Adicionar fotos**. Dá para escolher várias de uma vez (só imagens).
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
];

export const topicoPorId = (id: string) => TOPICOS.find((t) => t.id === id);
