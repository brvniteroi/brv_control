# Agente da impressora (Elgin L42PRO) — servidor da loja

Liga a fila de impressão do BRV Control à Elgin. Qualquer tela (PC, celular, 4G) pede a etiqueta; o agente, no
servidor da loja (192.168.1.9, ligado direto), pega o pedido e imprime. Substitui o `zpl_bridge.php` + `print.php`
do BRV Equipamentos, que **continuam funcionando** enquanto o Equipamentos estiver em uso (não mexer no XAMPP).

## Antes (uma vez)
1. Migration `supabase/migrations/20261108130000_oficina_base.sql` aplicada no SQL Editor.
2. Login do agente no Supabase: Authentication > Users > **Add user** > `impressora@brvniteroi.com.br`, senha forte,
   marcar "Auto Confirm User". Depois, no SQL Editor:
   ```sql
   UPDATE public.profiles SET role = 'impressora', active = TRUE, full_name = 'Impressora da loja'
   WHERE email = 'impressora@brvniteroi.com.br';
   ```

## Instalar no servidor da loja
1. Instalar o **Node.js 22 LTS** (nodejs.org, "Windows Installer .msi", tudo padrão). Confere no Prompt: `node -v`.
2. Copiar esta pasta (`scripts\agente-impressora`) para `C:\brv-agente-impressora` no servidor.
3. Nessa pasta, copiar `.env.example` para `.env` e preencher:
   - `SUPABASE_URL` e `SUPABASE_ANON_KEY`: os mesmos do `.env` do BRV Control.
   - `AGENTE_SENHA`: a senha criada no passo 2 de "Antes".
   - `IMPRESSORA_WIN`: nome exato da Elgin em Configurações > Impressoras (o `print.php` usa `ELGIN L42PRO FULL`).
   - `ELGIN_IP`/`ELGIN_PORTA`: os mesmos de `C:\xampp\htdocs\brv_print\config_impressora.php` (reserva pela rede;
     vazio se a Elgin for USB).
4. Abrir o Prompt de Comando na pasta e rodar `npm install`.
5. **Teste sem o Supabase**: `npm run teste` → deve sair "TESTE LOCAL DO AGENTE" na Elgin.
6. **Teste completo**: `npm start` (deixa a janela aberta) → no BRV Control, menu **Oficina** > "Imprimir etiqueta
   de teste". A tela deve mostrar "Pronta" e depois "Etiqueta impressa". Fechar a janela (Ctrl+C).
7. **Ligar sozinho**: botão direito em `instalar-tarefa.cmd` > **Executar como administrador**. Cria a tarefa
   "BRV Control - Impressora" (conta SYSTEM, sem janela, sobe ao ligar o servidor e volta sozinha se cair).
8. Repetir o teste do passo 6 pela tela. Conferir `agente.log` nesta pasta se algo falhar.

## Ajustes do rolo (feitos em 2026-11-09)
- Rolo 100x50 mm com 3 mm de espaço entre etiquetas e nas laterais. O agente ajusta o ZPL antes de enviar:
  margem esquerda de 3 mm (`^LH24`), passo de 53 mm (`^LL424`) e leitura do espaço entre etiquetas (`^MNY`).
  Opcionais no `.env`: `MARGEM_ESQUERDA_MM` (3), `PASSO_ETIQUETA_MM` (53), `PAUSA_ENTRE_COPIAS_MS` (1500).
- Várias cópias saem uma por vez (trabalhos separados), nunca com `^PQ` maior que 1.
- Etiqueta em branco no meio = sensor desajustado: parar o agente, `npm run calibrar` (envia `~JC`; a Elgin avança
  algumas etiquetas) e iniciar de novo. Trocar de rolo também pede calibrar.

## Conferir qual agente está rodando (v1.1.0 em diante)
- O sinal de vida (tabela `print_agents`, coluna `info`) informa a versão, a margem esquerda, o passo do rolo, o PID e a data do arquivo em uso;
  o `agente.log` repete os ajustes ao iniciar. Se a etiqueta sair diferente do combinado (margem encostada, etiqueta em branco), confira
  primeiro se o `agente.mjs` do servidor é o do projeto: arquivo antigo no servidor foi a causa em 2026-11-10 (voltaram a margem encostada e a etiqueta em branco).
- Trocou o `agente.mjs`? Reinicie (Agendador de Tarefas: "BRV Control - Impressora" > Finalizar > Executar) e confira que há um único `node` (`Get-Process node`).
- Em 2026-11-10 o servidor roda com `MARGEM_ESQUERDA_MM=4` no `.env` (ajuste fino do usuário; o padrão do código é 3).

## No dia a dia
- A tela Oficina mostra "Pronta" (sinal nos últimos 90 s) ou "Servidor da loja sem sinal". Sem sinal, use
  "Imprimir pelo navegador" (contingência, no Chrome com Margens "Nenhuma").
- Pedido que fica mais de 30 min na fila (servidor desligado) expira e não sai depois: etiqueta velha confunde.
- Parar: Agendador de Tarefas > "BRV Control - Impressora" > Finalizar (e Desabilitar, se for de vez).
- Trocar a senha do agente: mudar no Supabase e no `.env`, depois reiniciar a tarefa (ou o servidor).

## Segurança
- O login do agente só enxerga a fila de impressão (papel `impressora`; não abre nenhuma tela do sistema).
- Nada fica aberto na rede da loja nem na internet: o agente só **sai** para o Supabase (sem porta aberta, sem chave
  fixa, sem CORS aberto, diferente do `zpl_bridge.php`).
- O `.env` tem a senha do agente: não copiar para outro lugar além do servidor.
