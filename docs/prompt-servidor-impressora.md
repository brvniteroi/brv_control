# Prompt para o Claude rodar NO SERVIDOR DA LOJA: corrigir e verificar a impressão da Elgin

Cole o texto abaixo (a partir de "Contexto") no Claude Code aberto na pasta `C:\brv-agente-impressora\agente-impressora` do servidor da loja.

---

## Contexto

Você está no **servidor da loja** (Windows, 192.168.1.9) da BRV Niterói, na pasta do **agente de impressão** do sistema BRV Control (`C:\brv-agente-impressora\agente-impressora`). Esse agente (Node, `agente.mjs`, versão 1.1.0) pega pedidos de etiqueta numa fila do Supabase e imprime na **Elgin L42PRO** (ZPL), de duas formas: pela **fila do Windows em modo RAW** (`imprimir-raw.ps1`, impressora "ELGIN L42PRO FULL") e, se isso falhar, **direto pela rede** (`ELGIN_IP=192.168.1.22`, porta 9100). Ele roda pela tarefa do Windows **"BRV Control - Impressora"** (conta SYSTEM, `rodar-agente.cmd`).

Responda e escreva tudo em **português**. O usuário é o Braulio, que fica ao lado da impressora e confere o papel.

### O rolo
Etiquetas de **100 x 50 mm**, com **3 mm de espaço** entre elas e nas laterais (passo de 53 mm = 424 pontos a 203 dpi). Sensor por espaço entre etiquetas (gap).

### O que o agente faz com o ZPL antes de enviar (ver `agente.mjs`, função `imprimir`)
- troca `^LH0,0` por `^LH<margem*8>,0` (no servidor `MARGEM_ESQUERDA_MM=4`, então `^LH32,0`);
- troca `^LL400` por `^LL424` (`PASSO_ETIQUETA_MM=53`);
- insere `^MNY` logo depois do `^XA`;
- manda uma cópia por vez, como trabalhos separados, com pausa de 1,5 s entre eles (`^PQ` sempre 1).

### O que aconteceu (fatos observados em 2026-11-10)
1. Ontem, depois de recalibrar (`npm run calibrar`, que manda `~JC`) e com esses ajustes, imprimiu 3 e 2 etiquetas **sem nenhuma em branco**. Estava tudo bom.
2. Hoje voltaram a sair **etiquetas em branco** (e a margem encostada, que se resolveu ao trocar um `agente.mjs` antigo que ainda estava na memória da tarefa). Agora a margem está certa, **mas as etiquetas em branco continuam e pioraram**.
3. Hoje, para tentar resolver, mandaram pela fila, nesta ordem: `~JC` (recalibrar) e depois `^XA^JUS^XZ` (**gravar na memória da impressora a configuração atual**). Depois disso:
   - 1 etiqueta de teste simples (só texto): saiu certa, sem branco;
   - etiqueta completa das placas (6 linhas de texto, tarja preta invertida `^FR`, QR `^BQ`): saiu **2 em branco + a impressa** (e às vezes 1 em branco depois);
   - etiqueta real da Oficina (mesmo desenho que já funcionava): **2 em branco + a impressa**;
   - etiqueta simples + QR: saiu **1 em branco, a impressa e 6 em branco**.
   Ou seja: **o desenho da etiqueta não é o culpado** (a da Oficina, que sempre funcionou, também falha). O problema é o estado da **impressora** ou o **envio**.
4. Só existe um agente rodando (conferido pelo sinal de vida no banco); o arquivo `agente.mjs` é o novo.

### Hipóteses, da mais provável para a menos
- A calibração/configuração **gravada com `^JUS`** ficou ruim (limiar do sensor, tipo de mídia, comprimento da etiqueta, ou "continuous" no lugar de "gap"), e a impressora avança etiquetas procurando o espaço.
- O **driver/fila do Windows** (RAW) está acrescentando uma ejeção/página (o `imprimir-raw.ps1` usa `StartPagePrinter`/`EndPagePrinter`), ou o spooler empilhou algo.
- O **rolo ou as guias** mudaram de posição, ou o sensor está sujo/descalibrado fisicamente.

## O que fazer (nesta ordem; pare e relate se algo for arriscado)

**Regras de segurança**
- **Não mostre nem copie segredos**: o `.env` tem senha do agente e chave do Supabase. Pode ler as variáveis `MARGEM_ESQUERDA_MM`, `PASSO_ETIQUETA_MM`, `PAUSA_ENTRE_COPIAS_MS`, `ELGIN_IP`, `ELGIN_PORTA`, `IMPRESSORA_WIN`; **não imprima** `AGENTE_SENHA`, `SUPABASE_ANON_KEY`.
- **Antes de testar, pare a tarefa** para o agente não imprimir pedidos da fila no meio: `Stop-ScheduledTask -TaskName "BRV Control - Impressora"` e feche qualquer `node.exe` do agente (`Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select ProcessId, CommandLine`). **No fim, inicie de novo** com `Start-ScheduledTask` e confira que há **um** processo só.
- **Não** faça reset de fábrica da impressora (`^JUF`/`~WR`) sem **antes** imprimir a etiqueta de configuração (passo 3) e **perguntar ao Braulio**: pode perder IP e configurações de rede da Elgin (hoje 192.168.1.22).
- Não apague `agente.log`, `.env` nem a tarefa. Não instale pacotes sem avisar.
- Cada impressão gasta etiqueta: faça **testes pequenos**, um de cada vez, e **peça ao Braulio para descrever o que saiu, na ordem** (brancas antes, impressa, brancas depois) a cada teste.

**1. Reconhecimento (só leitura)**
- Leia `agente.mjs`, `imprimir-raw.ps1`, `rodar-agente.cmd`, `instalar-tarefa.cmd`, e as últimas 100 linhas de `agente.log`.
- `Get-Printer -Name "ELGIN L42PRO FULL" | Format-List *`, `Get-PrintConfiguration -PrinterName "ELGIN L42PRO FULL" | Format-List *`, `Get-PrinterPort`, e a fila (`Get-PrintJob`): há trabalhos presos? Qual driver, qual porta, tamanho de papel/mídia, tipo de mídia (contínua x com espaço), velocidade, "imprimir texto como gráfico"?
- Anote o que for suspeito.

**2. Descobrir se o problema é a fila do Windows ou a impressora: enviar o MESMO ZPL direto pela rede, sem a fila**
- Escreva um script Node pequeno (`teste-direto.mjs`, fora do agente) que abre um socket TCP em `ELGIN_IP`:`ELGIN_PORTA` (9100), envia o ZPL e fecha. Use esta etiqueta mínima (já com os ajustes do agente):
  ```
  ^XA
  ^MNY
  ^CI28
  ^PW800
  ^LL424
  ^LH32,0
  ^PR2
  ^FO24,18^A0N,32,32^FDTESTE DIRETO PELA REDE^FS
  ^FO24,70^GB752,3,3^FS
  ^FO24,110^A0N,30,30^FDSem passar pela fila do Windows^FS
  ^PQ1
  ^XZ
  ```
- Mande **uma** e peça ao Braulio para dizer quantas brancas saíram. Depois mande a mesma pela fila do Windows (`node agente.mjs --teste-local`, que já usa os ajustes do agente) e compare.
  - **Direto OK e pela fila com brancas** → o culpado é o `imprimir-raw.ps1`/driver: teste remover `StartPagePrinter`/`EndPagePrinter` (documento RAW não precisa de página), confira `datatype RAW`, e se o driver tem "ejetar página" ou pós-processamento; corrija e teste de novo.
  - **Brancas nos dois** → é a impressora: siga para o passo 3.

**3. Ler o estado da impressora (sem mudar nada)**
- Com o script Node (socket que **lê** a resposta), envie `~HS` (status do host: pausa, sem papel, cabeçote aberto, etc.) e `~HQES` e mostre o resultado.
- Imprima a **etiqueta de configuração**: `^XA^HH^XZ` (gasta uma etiqueta). Peça ao Braulio para ler, ou fotografar, e anote: **tipo de mídia** (NON-CONT. GAP/MARK x CONTINUOUS), **comprimento da etiqueta** (LABEL LENGTH, esperado ~424 pontos), **largura de impressão**, limiares do sensor (MEDIA/WEB), velocidade, "last cleared". Compare com o esperado: gap, 424, largura 800 (ou o máximo da cabeça).
- **Guarde esse resultado** antes de qualquer mudança.

**4. Corrigir o estado da impressora (do menos para o mais arriscado)**
1. Verifique fisicamente com o Braulio: rolo bem encaixado, guias encostadas sem apertar, sensor de espaço limpo, tampa fechada, luz da impressora (pausa/erro).
2. **Recalibrar com o rolo certo**, de forma limpa: `~JC` direto pela rede (não pela fila), espere a impressora parar de avançar (uns 15 a 20 s), depois imprima **uma** etiqueta de teste e confira. Se a calibração pelo botão físico for possível (segure o botão de avanço conforme o manual da Elgin), prefira-a.
3. Só se ainda falhar: `^XA^JUR^XZ` (recarrega a última configuração salva) **não adianta** (foi a salva hoje); considere `^XA^JUF^XZ` (recarrega os valores de fábrica) **depois de confirmar com o Braulio e de ter a etiqueta de configuração do passo 3**; em seguida recalibre (`~JC`), configure o que precisar (`^MNY`, `^PW`, `^LL424`) e grave com `^XA^JUS^XZ` **só depois de uma sequência de testes boa**.
4. Depois de corrigir, confira que o IP/rede da Elgin continuam (192.168.1.22) e que o agente ainda imprime.

**5. Verificação final (obrigatória)**
- Inicie a tarefa de novo (`Start-ScheduledTask`) e confira **um só** `node.exe` do agente.
- Teste de aceite, **com o Braulio olhando**: 3 pedidos de 1 cópia, 10 s entre eles, e 1 pedido de 3 cópias (o agente manda uma por vez). Resultado esperado: **exatamente 6 etiquetas impressas e 0 em branco**, margem esquerda certa (o texto não encosta na borda).
- Se tudo certo, peça ao Braulio para imprimir uma etiqueta real pelo sistema (botão "Etiqueta" de uma placa e de um item da Oficina).

**6. Relatório final**
Escreva um relatório curto em português com: o que encontrou (driver, porta, configuração da impressora, resultado do teste direto x fila), a causa mais provável, **cada mudança que fez** (arquivo e linha, ou comando enviado à impressora) e como desfazer, o resultado do teste de aceite, e o que ainda ficou pendente. Se alterou `agente.mjs` ou `imprimir-raw.ps1`, **mostre o diff completo** para o Braulio levar ao Claude do projeto (o servidor não é um repositório git; quem commita é o Claude do outro PC).
