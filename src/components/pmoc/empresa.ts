// Dados institucionais constantes da BRV Niterói para emissão do documento PMOC
// e tabela fixa de recomendações técnicas (reproduzida de `PMOC BRV Control.docx`).
// No futuro o Claude moverá os dados cadastrais da empresa para o banco.

export const EMPRESA_BRV = {
  nomeCurto: 'BRV Niterói',
  razaoSocial: 'BRV Niterói Elétrica e Refrigeração Ltda',
  cnpj: '07.320.361/0001-64',
  email: 'brvniteroi@gmail.com',
  telefone: '(21) 99925-4178',
  endereco: 'Estrada Francisco da Cruz Nunes 10112, Niterói - RJ, CEP 24340-000',
  logoUrl: '/logobrvcontrol.png',
  subtituloPmoc: 'PMOC Oficial - BRV Niterói Elétrica e Refrigeração Ltda',
  fraseLegal:
    'Documento emitido e mantido pela BRV Niterói Elétrica e Refrigeração Ltda através do sistema BRV Control, em cumprimento à Lei Federal nº 13.589/2018, Portaria MS nº 3.523/1998 e Resolução RE nº 09/ANVISA.',
} as const;

export interface RecomendacaoPmoc {
  situacao: string;
  recomendacao: string;
}

/** Seção 6 fixa do documento PMOC, com texto exato de `PMOC BRV Control.docx`. */
export const RECOMENDACOES_FIXAS_PMOC: readonly RecomendacaoPmoc[] = [
  {
    situacao: 'O técnico não consegue solucionar o problema.',
    recomendacao:
      'O técnico deve informar o proprietário do ar condicionado sobre o problema e fornecer um orçamento para a substituição do ar condicionado. O proprietário pode optar por substituir o ar condicionado ou solicitar uma segunda opinião de outro técnico.',
  },
  {
    situacao: 'O técnico encontra um vazamento de gás.',
    recomendacao:
      'O técnico deve interromper a manutenção e solicitar a presença de um técnico especializado em manutenção de ar condicionado. O vazamento de gás pode ser perigoso e deve ser consertado por um profissional qualificado.',
  },
  {
    situacao: 'O técnico encontra um componente danificado.',
    recomendacao:
      'O técnico deve informar o proprietário do ar condicionado sobre o problema e fornecer um orçamento para o reparo ou substituição do componente. O proprietário pode optar por consertar o ar condicionado ou adquirir um novo aparelho.',
  },
  {
    situacao: 'O técnico encontra um problema de funcionamento.',
    recomendacao:
      'O técnico deve tentar solucionar o problema. Se o problema for complexo, o técnico pode solicitar a presença de um técnico especializado.',
  },
];

