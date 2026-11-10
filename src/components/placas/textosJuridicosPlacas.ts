// Textos institucionais e cláusulas jurídicas copiados LITERALMENTE dos modais do sistema anterior
// (`ModalOrcamentoPlaca.jsx`, `ModalComprovanteEntrada.jsx` e `ModalTermoGarantia.jsx`) para revisão do Braulio.

/** Chave PIX exibida no quadro de condições comerciais do orçamento de placa. */
export const CHAVE_PIX_ORCAMENTO_PLACA = 'brvloja@brvniteroi.com.br';

/** Monta o texto literal da política de execução de 50% de entrada (`ModalOrcamentoPlaca.jsx`, seção 4). */
export function textoPoliticaExecucaoOrcamento(entradaFormatada: string): string {
  return `POLÍTICA DE EXECUÇÃO: O início dos serviços em bancada, alocação de peças de precisão e testes é estritamente condicionado ao envio do comprovante bancário da entrada de 50% (${entradaFormatada}). O saldo restante de 50% deverá ser quitado no ato da retirada/entrega.`;
}

/** Cláusulas jurídicas literais da proposta de orçamento (`ModalOrcamentoPlaca.jsx`, seção 5). */
export const CLAUSULAS_ORCAMENTO_PLACA: readonly { titulo: string; texto: string }[] = [
  {
    titulo: '1. Prazo da Garantia:',
    texto:
      'Este serviço possui Garantia Legal de 90 (noventa) dias (3 meses) a contar da data de retirada/entrega da placa, nos termos do Art. 26, II do Código de Defesa do Consumidor (Lei Federal nº 8.078/90).',
  },
  {
    titulo: '2. Cobertura:',
    texto:
      'A garantia abrange estritamente o circuito reparado e os componentes substituídos descritos neste laudo.',
  },
  {
    titulo: '3. Condições de Validade:',
    texto:
      'A garantia perderá vigência caso ocorra: rompimento do selo/lacre de garantia de bancada; descargas atmosféricas (raios); sobretensão da rede elétrica externa; infiltração de água/líquidos; infestação de insetos/lagartixas ou intervenção de terceiros não autorizados.',
  },
  {
    titulo: '4. Cláusula de Abandono (90 Dias):',
    texto:
      'Conforme os termos dos artigos 1.263 e 1.275, inciso III do Código Civil Brasileiro e a legislação consumerista correlata, o cliente declara-se expressamente ciente de que a placa ou equipamento disponibilizado para retirada (consertada ou não), que não for retirado no prazo de até 90 (noventa) dias corridos a contar da comunicação formal de conclusão ou impossibilidade do serviço, será legalmente caracterizado como BEM ABANDONADO (res derelicta), autorizando expressamente a BRV Niterói a realizar seu descarte ecologicamente adequado, reciclagem ou alienação para custeio das despesas de guarda, alocação e bancada, cessando em definitivo qualquer responsabilidade de guarda ou dever indenizatório.',
  },
];

/** Cláusulas jurídicas literais do comprovante de entrada (`ModalComprovanteEntrada.jsx`). */
export const CLAUSULAS_COMPROVANTE_ENTRADA: readonly string[] = [
  '1. O prazo médio de diagnóstico de bancada laboratorial com instrumentação é de 24h a 48h úteis.',
  '2. Os aparelhos ou placas disponibilizados para retirada que não forem retirados no prazo de até 90 (noventa) dias corridos após notificação formal de liberação serão legalmente caracterizados como BEM ABANDONADO (Art. 1.275, III do Código Civil), autorizando descarte ecológico ou leilão para custeio de guarda.',
  '3. A garantia para serviços executados em bancada é de 90 (noventa) dias conforme Art. 26 do CDC a contar da data de retirada, restrita estritamente aos componentes reparados/substituídos.',
];

/** Cláusulas jurídicas literais do termo de garantia de 90 dias (`ModalTermoGarantia.jsx`). */
export const CLAUSULAS_TERMO_GARANTIA: readonly string[] = [
  '1. A garantia cobre exclusivamente os componentes substituídos e o circuito reparado descritos neste termo pelo prazo legal de 90 (noventa) dias (Art. 26 do CDC).',
  '2. A garantia perderá total validade em caso de: descarga atmosférica (raio), sobretensão da rede elétrica externa, infestação de insetos/lagartixas, oxidação por maresia/umidade excessiva ou intervenção de terceiros não autorizados.',
  '3. Para acionamento de garantia, é obrigatório apresentar este número de Ordem de Serviço e o selo de bancada intacto.',
];

