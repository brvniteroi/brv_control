# BRV Niterói: perguntas para a contabilidade (25/11/2026)

Estamos trocando o sistema atual (SicWeb) por um sistema próprio, que vai emitir **NFC-e, NF-e e NFS-e** por um provedor de emissão.
A empresa é do Simples Nacional. Hoje a NFC-e sai pelo SicWeb (CFOP padrão 5.102, CSOSN 102) e a NFS-e é digitada no Emissor Nacional (nfse.gov.br).
Uma venda nossa costuma ter produtos e mão de obra juntos.

## A. Notas de serviço (NFS-e)
1. Qual **código de tributação nacional** e qual item da LC 116 usar em cada serviço?
   - instalação de ar-condicionado split e de janela (seria 14.06, 14.01 ou 7.02?);
   - manutenção preventiva, limpeza e manutenção mensal;
   - conserto: troca de capacitor, relé ou sensor, carga de gás e solda;
   - conserto de placa eletrônica e de equipamento levado para a nossa oficina;
   - passagem de tubulação e serviço de elétrica;
   - visita técnica e avaliação de placa;
   - PMOC (plano de manutenção);
   - aluguel de andaime cobrado do cliente (é serviço, locação ou não entra em nota de serviço?).
2. Qual a **alíquota de ISS** de cada um em Niterói? No Simples, o que vai informado na nota?
3. Serviço feito em **outro município** (São Gonçalo, Maricá, Rio): muda onde o ISS é devido?
4. Quando o cliente é **empresa**, há retenção de ISS ou de outro tributo? Como identificar?
5. É preciso informar CNAE ou código municipal na nota? Quais?

## B. Notas de produto (NFC-e e NF-e)
6. **Substituição tributária:** hoje o cadastro usa CSOSN 102. Algum dos nossos produtos deveria sair com **CSOSN 500 e CFOP 5.405**, com **CEST**?
   Os grupos principais, pelos 4 primeiros dígitos do NCM, são: 8415 (ar-condicionado e peças), 8414 (compressores), 8532 (capacitores), 8536 e 8544 (material elétrico e cabos),
   7411 e 7412 (tubos e conexões de cobre), 3917, 3904, 3925 e 3926 (plásticos: conduíte, canaleta, abraçadeira), 8205 (ferramentas), 9032 e 8543 (sensores, termostatos, controles).
7. Podem **revisar a lista de produtos** (NCM, CSOSN, CFOP e CEST)? Temos 720 produtos ativos e **160 estão sem NCM ou sem CSOSN**. Podemos mandar a planilha.
8. **PIS e Cofins:** há produto monofásico ou com outro tratamento que precise de código próprio na nota ou de separação na apuração do Simples?
9. Quando devemos emitir **NF-e** e quando basta **NFC-e**? (cliente com CNPJ, entrega no endereço do cliente, valor alto, venda para outro estado)
10. Na venda para empresa de outro estado ou para quem não é consumidor final, o que muda (CFOP, diferencial de alíquota)?

## C. Produto e serviço no mesmo trabalho
11. Na instalação cobramos **material e mão de obra separados**: hoje o material sai em nota de produto e a mão de obra em NFS-e. Está correto? Em algum serviço o material deve ir **dentro** da NFS-e?
12. Na manutenção, a **peça trocada** (capacitor, sensor, gás) vai em nota de produto à parte? E quando o preço do serviço já inclui a peça?
13. Material de consumo usado no serviço e não cobrado precisa de algum documento ou baixa?
14. Recebemos **sinal** antes do serviço: emite nota no sinal ou só na conclusão?

## D. Equipamento do cliente, garantia e devoluções
15. Equipamento ou placa do cliente que **vem para a oficina** e volta depois: precisa de nota de remessa e retorno? Quem emite quando o cliente é pessoa física e quando é empresa?
16. Transporte de equipamento e de material no carro até o cliente precisa de algum documento?
17. **Troca em garantia** de peça (nossa ou do fabricante): qual nota e qual CFOP?
18. **Devolução** de venda: qual o procedimento depois do prazo de cancelamento?

## E. Emissão pelo sistema novo
19. **Certificado digital:** o atual vence em **01/09/2027**. É **A1** (arquivo .pfx)? Quem tem o arquivo e a senha?
20. **CSC** da NFC-e (Sefaz-RJ): o que já usamos serve para o sistema novo ou devemos gerar outro?
21. Vocês já trabalham com algum **provedor de emissão** (Focus NFe ou outro)? Têm preferência ou restrição?
22. **Numeração e série:** o sistema novo deve usar uma série nova para NFC-e, NF-e e para a DPS da NFS-e, ou continuar a numeração atual?
23. **Reforma tributária (IBS e CBS):** a opção de enviar os novos tributos está desligada no SicWeb. Para uma empresa do Simples, o que já é obrigatório nas três notas, a partir de quando, e quais códigos usar? Há alguma decisão da empresa sobre o regime com prazo a vencer?
24. Há **rascunhos parados** no portal da NFS-e (3/09, 8/09, 27/10 e 18/11). Vocês sabem de algo que impeça a emissão nesses casos?

## F. O que a contabilidade precisa receber
25. Como querem receber os **XML** (e-mail, pasta compartilhada, acesso ao provedor) e com que frequência?
26. Precisam de **relatório mensal**? Quais colunas e em que formato (Excel, PDF)?
27. Precisam do **movimento financeiro** (caixa, bancos, cartões) ou só das notas?
28. Há algo do SicWeb que devemos **guardar ou exportar antes de desligá-lo** (XML antigos, inventário de estoque, livros)? Por quanto tempo?
29. Podemos fazer a **virada** em qualquer dia ou é melhor no início de um mês?

> **Mais urgentes** (travam o sistema): 1, 2, 6, 11, 19 e 23.

## Respostas recebidas (27/11/2026)

**1 (parte) e 23 (parte, só NFS-e).** Ver os dois PDFs "Parametrizacao NFS-e IBS-CBS" nesta pasta.
| Serviço | Tributação nacional | NBS | Indicador da operação |
|---|---|---|---|
| Instalação, desinstalação, reinstalação | 14.06.01 | 1.0106.32.00 (central/industrial: 1.2003.29.00) | 020201 (fixado no imóvel); 050101/050102 sem fixação |
| Manutenção, limpeza, preventiva, corretiva, recarga de gás | 14.01.01 | 1.0106.32.00 (não doméstico: 1.2001.60.00) | 050101 oficina; 050102 endereço de quem paga; 050103 do destinatário; 050104 outro; 020201 sistema central |
- **Visita técnica** para identificar o defeito, com ou sem conserto depois: 14.01.
- IBS/CBS na NFS-e: exigidos a partir de **01/01/2027** (até 31/12/2026 a nota vai sem); CST 000, cClassTrib 000001. Alíquotas CBS 0,9% / IBS 0,1% **não aplicar até confirmação**.

**2.** O emissor pede a **alíquota efetiva** do Simples; com RBT12 acima de R$ 180.000,00 é calculada no início de cada mês. **Notas de 12/2026: 7,97%.** Alíquota de ISS só importaria com retenção, que não ocorre na BRV.

**11 (e 12, em parte).** Está correto separar: peça/material em **nota de venda**, serviço em **nota de serviço** (imposto bem menor que tudo na nota de serviço). Continuar assim. **Evitar o termo "mão de obra"** (não permitido para empresa do Simples). Peças da manutenção (gás, capacitor, placa) não entram na NFS-e.

**23 (parte).** Sobre a opção dos novos tributos desligada no SicWeb: a BRV deve **verificar com o SicWeb**. Muitos sistemas estão deixando a opção desabilitada para empresas do Simples, porque a obrigatoriedade passa a valer em **01/01/2027**.

**9 (prática atual, informada pela BRV em 27/11/2026).** A BRV usa **NFC-e no balcão para PF e PJ**; só algumas empresas pedem NF-e.
- Conferido no Confaz em 27/11/2026: a proibição de NFC-e para CNPJ (Ajuste SINIEF 11/25) foi **revogada** pelo Ajuste 12/26 (DOU 09/04/2026).
- O **Ajuste SINIEF 23/26** (efeitos desde 05/10/2026) obriga **NF-e no lugar da NFC-e** nas vendas de varejo **que permitam ao comprador aproveitar crédito de ICMS**; a lei estadual pode impor condições (RJ não conferido). Confirmar com o contador se alcança as vendas da BRV (CSOSN 102 não dá crédito).

### O que ainda falta
- **1:** elétrica ou tubulação cobradas sozinhas; aluguel de andaime; conserto de placa eletrônica, inclusive avulsa de parceiro (é 14.01?); troca de suporte sem instalar o aparelho (14.01 ou 14.06?). PMOC: só perguntar se for cobrar à parte a elaboração do plano / responsabilidade técnica.
- **3:** confirmar (pela regra geral da LC 116, em 14.01 e 14.06 o ISS é de Niterói; se usarem 7.02, é do local da obra).
- **4:** retenção de outro tributo em venda para empresa (a de ISS não ocorre).
- **6** (urgente) e **7 a 10**.
- **11/12:** o PDF diz que peça vai em NF-e: no balcão ou para pessoa física pode ser NFC-e? Preço fechado (ex.: carga de gás): como dividir entre as duas notas?
- **13 a 18**, **19** (urgente), **20 a 22**, **24 a 29**.
- **Falar com o suporte do SicWeb:** se vai habilitar IBS/CBS na NFC-e e NF-e para o Simples a tempo de 01/01/2027 e o que configurar.
- **23** (urgente): códigos de IBS/CBS na NFC-e e NF-e; alíquotas das notas de 2027 (os PDFs citam as do ano-teste, que pela lei é 2026) e o que muda no Simples.
  - Decisão sobre o regime (conferido em 27/11/2026 na Receita/CGIBS): a opção pelo **regime regular** de IBS/CBS (fora do DAS) para jan-jun/2027 foi de 01/09 a **30/10/2026** (encerrada); quem optou pode cancelar de 03/11 a **20/12/2026**.
  - **A BRV não optou pelo regime regular** (informado pela BRV em 27/11/2026): não há nada a cancelar até 20/12. Confirmar com o contador: IBS/CBS ficam dentro do DAS em 2027, e o que precisa ir nas notas nesse caso?
- Quem calcula a alíquota efetiva todo mês e até que dia envia?
- **29:** a virada passou para **10/01/2027** (decisão da BRV em 27/11/2026). Há problema em trocar no meio do mês? Entre 01/01 e a virada as notas ainda saem pelo SicWeb e pelo Emissor Nacional.
- Há problema em, depois da virada, redigitar no SicWeb as vendas que precisam de NFC-e, só para emitir a nota?
