# AIP Workspace: guia de configuração

Tudo é feito pelo navegador, sem instalar nada. Tempo estimado: 15 a 20 minutos, uma única vez.

## 0. Criar o repositório no GitHub

1. Abra https://github.com/new com a conta `WillBoelcke2`.
2. Nome: `aip-workspace`. Não marque nenhuma opção de arquivo inicial. Clique em **Create repository**.
3. Avise o Claude. Ele envia os arquivos para o repositório e, daí em diante, publica as mudanças por lá.

## 1. Criar o projeto no Firebase

1. Abra https://console.firebase.google.com com a sua conta Google da AI Pathology.
2. Clique em **Criar um projeto**, dê o nome `aip-workspace` e desative o Google Analytics.

## 2. Ativar o login com Google

1. No menu, abra **Authentication** e clique em **Vamos começar**.
2. Na aba **Sign-in method**, escolha **Google**, ative e salve.

## 3. Criar o banco de dados

1. No menu, abra **Firestore Database** e clique em **Criar banco de dados**.
2. Escolha o local `southamerica-east1 (São Paulo)` e o **modo de produção**.
3. Abra a aba **Regras**, apague o que estiver lá, cole o conteúdo do arquivo `firestore.rules` e clique em **Publicar**.

Essas regras são a proteção dos dados: só contas `@aipathology.com.br` verificadas leem e escrevem.

## 4. Conectar o app ao projeto

1. Clique na engrenagem, **Configurações do projeto**, role até **Seus apps** e clique no ícone **</>** (Web).
2. Dê o apelido `workspace` e registre. Não marque Firebase Hosting.
3. Copie o bloco `firebaseConfig` que aparece.
4. Envie esse bloco ao Claude, que atualiza o `config.js`. Ou edite você mesmo: no GitHub, abra `config.js`, clique no lápis, preencha `apiKey`, `authDomain`, `projectId` e `appId`, e confirme em **Commit changes**.

Esses valores não são segredo. Eles só identificam o projeto.

## 5. Publicar o site

No GitHub, abra o repositório, **Settings**, **Pages**. Em **Branch**, escolha `main` e a pasta `/ (root)`, e salve. Em um ou dois minutos o endereço aparece no topo da página, no formato `https://willboelcke2.github.io/aip-workspace/`.

O GitHub Pages só funciona em repositório privado nos planos pagos do GitHub. No plano gratuito, o repositório precisa ser público. O código não contém dados da empresa: todo o conteúdo fica no Firebase, atrás do login.

## 6. Autorizar o endereço

No Firebase, abra **Authentication**, **Settings**, **Authorized domains**, clique em **Add domain** e adicione `willboelcke2.github.io`.

## 7. Primeiro acesso

1. Abra o endereço do site e entre com o Google.
2. No rodapé da barra lateral, clique no seu nome e em **Importar JSON**. Escolha o arquivo `conteudo-inicial.json` para carregar as páginas e bases iniciais.

## Dia a dia

- **Mudar o app**: peça ao Claude. Ele altera o código no repositório e o site atualiza sozinho em cerca de um minuto.
- **Backup**: clique no seu nome, **Exportar backup (JSON)**. O arquivo pode ser reimportado a qualquer momento.
- **Dar ou tirar acesso**: qualquer conta `@aipathology.com.br` entra. Para mudar o domínio, altere `domain` no `config.js` e a linha do domínio nas regras do Firestore.
- **Custo**: o plano gratuito do Firebase (Spark) tem limites diários de leitura e gravação. Se o app avisar que o limite foi atingido, as gravações voltam no dia seguinte.

## Se algo der errado

| Mensagem | O que fazer |
|---|---|
| Falta conectar o Firebase | O `config.js` ainda está vazio (passo 4). |
| Este endereço ainda não está autorizado | Passo 6. |
| O login com Google ainda não foi ativado | Passo 2. |
| O banco recusou a leitura ou a gravação | As regras não foram publicadas (passo 3) ou a conta não é do domínio. |

## Google Agenda nas bases de dados

Em qualquer visualização de calendário há o botão **Mostrar Google Agenda**. Cada pessoa vê a própria agenda, só leitura. Clicar em um evento permite criar um item com ata.

Configuração única, feita por quem criou o projeto:

1. Ative a Google Calendar API: https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=aip-workspace
2. Em https://console.cloud.google.com/auth/audience?project=aip-workspace, deixe o tipo de usuário como **Interno**. Assim só contas da empresa autorizam o acesso e o Google não mostra o aviso de app não verificado.

## Papéis de acesso e páginas restritas

Depende das regras novas do arquivo `firestore.rules` (Firestore, aba Regras, colar e publicar).

- **Dono**: a primeira conta do domínio que entrar no app depois de publicar as regras novas. Entre você primeiro, antes de enviar o link ao time.
- **Papéis**: Administrador, Editor (padrão de quem entra) e Leitor. O dono e os administradores mudam os papéis em: seu nome, no rodapé, **Pessoas e acessos**. A lista mostra quem já entrou pelo menos uma vez.
- **Quem pode acessar**: no menu `...` de uma página ou base, escolha **Todo o time** ou **Só pessoas selecionadas**. Vale para tudo que estiver dentro dela, inclusive itens novos. Administradores sempre têm acesso, e só eles mudam essa configuração.

Se algo der errado depois de publicar as regras novas, volte às regras anteriores (abaixo) e publique de novo. O app continua funcionando sem papéis.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function membro() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email.matches('.*@aipathology[.]com[.]br$');
    }
    match /pages/{id} {
      allow read, write: if membro();
    }
  }
}
```

## Arquivos e imagens nas páginas

O app já tem os blocos **Imagem** e **Arquivo** (menu `/`, ou colar um print direto na página). Eles só funcionam depois de ativar o armazenamento, que exige o projeto no plano Blaze (faturamento vinculado):

1. No Firebase, abra **Storage** e clique em **Vamos começar**. Escolha o local `southamerica-east1`.
2. Na aba **Regras** do Storage, cole o conteúdo do arquivo `storage.rules` e publique.

Limite de 25 MB por arquivo. O link de cada arquivo é longo e impossível de adivinhar, mas quem tiver o link consegue abrir, mesmo que a página esteja restrita.

## Painel

O item **Painel** na barra lateral calcula, a partir das bases que cada pessoa pode ver: metas e progresso (pelos campos Atual e Alvo, ou pelas tarefas vinculadas), distribuição do pipeline, projetos e tarefas por status, tarefas abertas por pessoa e prazos.

## Drive e Gmail nas páginas

No menu `/` há **Arquivo do Google Drive** e **E-mail do Gmail**. Cada um abre uma busca na conta de quem está usando (só leitura) e insere um link na página. Configuração única:

1. Ative a Drive API: https://console.cloud.google.com/apis/library/drive.googleapis.com?project=aip-workspace
2. Ative a Gmail API: https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=aip-workspace
3. O tipo de usuário do app deve estar como **Interno** (mesmo passo da Google Agenda).

## Histórico de versões

Menu `...` de uma página, **Histórico de versões**. O app guarda o estado anterior a cada rodada de edição, no máximo uma versão a cada 10 minutos por página, e permite restaurar. Depende das regras atuais do arquivo `firestore.rules`.

## Modelos e comentários

- Ao abrir uma página ou item vazio aparecem os modelos (ata, 1:1, conselho, ficha de conta). Em um item de base, `...` → **Salvar como modelo desta base** cria um modelo próprio daquela base.
- Toda página e item tem comentários no fim. Use `@` para citar alguém; a pessoa vê a citação na página Hoje.

## CRM comercial

Em **Nova base de dados** há o modelo **CRM comercial**, espelhado na planilha CRM 2026.2: fases (Discovery, Proposta, Negociação, Jurídico, Cadastro de fornecedor, Contrato assinado, Perdido), score de fechamento, ICP, produto de interesse, modelo de negócio, valor da proposta e ARR estimado, atualizações e pasta no Drive, mais CNPJ, ponto focal, responsável comercial, previsão de assinatura por trimestre, próxima tarefa com prazo e responsável, e motivo da perda.

- Cada fase tem campos esperados; o que falta aparece no item e no cartão do funil.
- Todo lead novo já nasce com a ficha de qualificação no corpo da página.
- O funil soma o valor por fase; o Painel mostra o valor em aberto por fase e por trimestre; a página Hoje mostra as próximas tarefas de cada responsável.
- Fases, opções de ICP, produto e modelo de negócio são editáveis: clique no cabeçalho da coluna ou no próprio campo.
- Com o CRM vazio, o app oferece trazer as contas da base Pipeline comercial.

## Dia a dia do time

- **Comece aqui**: a página com id `comece` aparece fixa no topo da barra lateral para todo mundo.
- **Quem é você**: o app liga o login à pessoa pelo nome cadastrado em Pessoas e acessos (o e-mail é a chave). O nome do cadastro não é mais trocado pelo nome da conta Google.
- **Nova tarefa**: botão na barra lateral, na página Hoje, atalho Alt+T e botão redondo no celular. Já sugere você como responsável.
- **Virar tarefa**: no menu de qualquer linha de texto (a alça à esquerda). Em uma ata dentro de Reuniões, a tarefa já sai ligada à reunião.
- **Avisos**: mostra quem citou você em comentários e quem atribuiu um item a você, nos últimos 30 dias.
- **Enviar sugestão**: grava na base "Sugestões e erros", com quem enviou e em que tela estava.
- **Equipes**: a base "Equipes" tem uma linha por equipe, com Membros e Líder. Em Nova tarefa dá para escolher uma equipe em vez de uma pessoa; a tarefa aparece em "Das suas equipes" na página Hoje de todos os membros, que também recebem um aviso. A página de cada equipe lista as tarefas dela.

## Bases mais completas

- **Texto longo**: propriedades de texto com mais de uma linha (ou marcadas como "texto longo" no menu da propriedade) mostram o conteúdo inteiro no item, com links e e-mails clicáveis. Clique no texto para editar. Na tabela aparece a primeira linha; o clique abre o texto completo.
- **Tabela agrupada**: no menu da visualização em tabela, "Agrupar por" separa as linhas por uma propriedade de seleção, status ou pessoa. Cada grupo pode ser recolhido.
- **Descrição da base**: menu "…" da base, "Adicionar descrição". O texto fica logo abaixo do título.
- **Link em propriedade de URL**: dentro do item, o botão "Abrir" ao lado do endereço.
- **Campos do cartão**: uma visualização em quadro pode fixar quais propriedades aparecem no cartão (campo `card` da visualização, definido na importação).
- **Agenda de hoje**: uma base pode indicar quais datas contam como agenda (campo `agenda`); sem isso, qualquer data igual a hoje aparece na página Hoje.

## Mais visualizações

Toda base aceita sete formatos, no `+` ao lado das abas: Tabela, Quadro, Lista, Calendário, Cronograma, Galeria e Gráfico.

- **Calendário por semana:** no cabeçalho do calendário, troque entre Mês e Semana. A semana mostra os itens do dia no topo e, com a Google Agenda ligada, os compromissos na grade de horários.
- **Cronograma:** barras entre a data de início e a de fim (escolha as duas clicando na aba da visualização). A linha verde marca hoje.
- **Galeria:** um cartão por item; se a página do item tiver imagem, ela vira a capa.
- **Gráfico:** barras com a quantidade de itens (ou a soma de um campo numérico) por Status, Seleção ou Pessoa.

## Atas automáticas (bot de reuniões)

No menu lateral, **Atas** conecta o workspace às anotações do Gemini das suas reuniões no Meet. Depois de conectar, cada ata nova vira uma linha em Reuniões (resumo, decisões e link da ata) e uma tarefa para cada próximo passo.

- Sem prazo na ata, a tarefa vence 1 semana depois da reunião. "Hoje", "amanhã" e datas escritas são respeitados.
- Sem dono (ou dono de fora do time), a tarefa vai para o líder da equipe da reunião; se a reunião não for de uma equipe, fica com quem importou.
- A mesma ata entra uma vez só, mesmo que vários participantes estejam conectados.
- Reuniões com menos de 3 convidados, com título reservado (1:1, desempenho, feedback etc.) ou com mais de 3 dias ficam na lista para você decidir: Importar ou Ignorar.
- Em "Correções de nomes" ficam os termos que o Gemini erra, no formato `errado = certo`.
- O Google pede a conexão de novo a cada sessão do navegador (cerca de 1 hora); com a conexão ativa, o workspace procura atas novas sozinho.

### Robô das 6h (para quem administra)

A pasta `functions/` tem uma função agendada que roda todo dia às 6h (Brasília) e importa as atas de todas as pessoas do time, sem clique de ninguém. As mesmas regras valem: reuniões com menos de 3 convidados ou com título reservado não entram sozinhas.

Para publicar, abra o [Google Cloud Shell](https://shell.cloud.google.com) e rode:

```
git clone https://github.com/WillBoelcke2/aip-workspace.git && cd aip-workspace && ./tools/deploy-bot.sh
```

No fim, o script mostra o único passo manual: um superadministrador do Google Workspace autoriza a função a ler os arquivos criados pelo Meet (e nada mais) no Admin Console. Para testar na hora: `./tools/deploy-bot.sh run`.

### Radar Seed (para quem administra)

A mesma publicação inclui o Radar Seed: todo dia às 6h20 ele lê os e-mails do dono do workspace (só essa caixa), usa o Gemini do projeto para separar o que é de investidor e atualiza o CRM de fundos: nota datada, última conversa, próximo follow-up e status quando o e-mail comprova. O resumo do dia fica na página **Radar Seed**, restrita a administradores. Contatos ambíguos não entram no CRM; aparecem em "Para você decidir". Para testar: `./tools/deploy-bot.sh run seed`.

### Painel dos robôs e backup (para quem administra)

- **Robôs** (em Atalhos, só administradores): mostra a última execução de cada robô — atas, Radar Seed e backup — com o que foi feito e os erros. Um "!" aparece ao lado quando algum falhou ou ficou mais de 26 horas sem rodar.
- **Backup:** todo dia às 3h10 o banco inteiro do workspace é copiado para o Storage do projeto, e as últimas 30 cópias ficam guardadas. Ninguém do time acessa esses arquivos pelo app.
- No Cloud Shell: `./tools/deploy-bot.sh backups` lista as cópias; `./tools/deploy-bot.sh restore AAAA-MM-DD id-da-pagina` devolve uma página (e o que está dentro dela) ao estado daquele dia; sem o id, restaura todas. A restauração pede confirmação e não apaga o que foi criado depois.

## Painel

O Painel tem uma aba por área: **Resumo**, **Execução**, **Metas**, **Comercial** e **Captação** (as duas últimas só aparecem para quem tem acesso às bases). O Resumo abre com o que precisa de atenção e um cartão por área; clicar num cartão leva à aba dela. Passe o mouse sobre qualquer barra para ver o número exato. Tudo é calculado na hora a partir das bases.

## Páginas com bases, gráficos e colunas

Digite `/` numa página para inserir:

- **Colunas** (`/colunas`): 2 a 5 colunas lado a lado. Cada coluna recebe blocos comuns, inclusive bases e gráficos. No ponto de arraste que aparece à esquerda ao passar o mouse sobre as colunas dá para mudar a quantidade, desfazer as colunas (o conteúdo fica) ou excluir tudo. No celular, as colunas ficam uma embaixo da outra.
- **Visualização de uma base** (`/visualização`): mostra uma base que já existe dentro da página, com formato, filtro e ordenação próprios. O filtro vale só para aquele bloco; os itens são os mesmos da base. "Novo" cria o item já com os valores do filtro.
- **Base de dados - em linha** (`/inline`): cria uma base nova que aparece dentro da própria página.
- **Gráficos** (`/barras`, `/linhas`, `/rosca`, `/número`): contam os itens de uma base ou somam um campo numérico. Linhas usa um campo de data, mês a mês. Rosca aceita até 6 fatias; acima disso vira barras.

As bases também ganharam as visualizações **Feed** (itens mais recentes primeiro, com o começo do texto) e **Formulário** (quem preenche e envia cria um item; em "Campos do formulário" você escolhe o que aparece), e o Gráfico agora tem os tipos barras, linhas, rosca e número.

## Agenda sem conectar

O robô do servidor copia a Google Agenda de cada pessoa para o workspace de hora em hora, das 6h às 21h (os 7 dias anteriores e os 45 seguintes). Com isso a "Agenda de hoje" e os calendários mostram os compromissos sem pedir conexão. São guardados só horário, título e link do evento; eventos marcados como privados aparecem como "Ocupado" e os recusados não entram. Cada pessoa vê a própria agenda; administradores do workspace conseguem ler as cópias de todos.

## Foco por equipe

O Painel e a base de Tarefas abrem mostrando as suas equipes: o que é das equipes em que você está e o que está atribuído a você, mesmo sem equipe. No seletor "Mostrar" (no Painel) ou ao lado de "Ordenar" (em Tarefas) dá para trocar para **Toda a empresa** ou para uma equipe específica; a escolha fica guardada no seu navegador. É um filtro de quem olha, não uma restrição: ninguém perde acesso a nada. Quem está em todas as equipes abre em "Toda a empresa". Uma tarefa criada com o foco ligado já nasce na sua equipe (quando você tem só uma) e com você como responsável.

### Regra de follow-up dos fundos (Radar Seed)

- Cada mensagem que o dono do workspace envia a um fundo, sem resposta desde a anterior, conta **uma tentativa** e marca o próximo follow-up para **7 dias depois**. O campo "Tentativas sem retorno" mostra a contagem.
- Quando o fundo responde, a contagem zera e o follow-up é dado como concluído (a menos que o e-mail combine uma nova data).
- Depois de **3 tentativas seguidas sem retorno**, passada mais uma semana, o fundo vai para o status **Sem resposta** (com uma nota datada). Isso só acontece nas fases Mapeado, A conversar e Em conversa; em due diligence ou term sheet o robô apenas avisa na página Radar Seed.
- Follow-up só aparece como vencido no Painel se a data passou e não houve conversa desde então.

## Mover uma página para dentro de outra

Nos três pontinhos ao lado do nome da página, no menu lateral, escolha **Mover para…**, busque a página de destino e clique nela. A página leva junto tudo o que está dentro dela. Se o destino for uma página de acesso restrito, só quem acessa o destino continua vendo a página movida. Para voltar à raiz, escolha **Início do workspace**.

## Visualização "One page"

Em qualquer base, adicione uma visualização do tipo **One page** para ler um item por vez como um relatório de uma página: faixa de indicadores no topo, seletor do item com anterior e próximo, cabeçalho com as etiquetas e, abaixo, os campos organizados em cartões. Filtro, ordenação e busca da base valem aqui também. **Abrir e editar** abre o item para alterar os campos.

## Mudar a ordem das páginas no menu lateral

Arraste a página pelo nome e solte acima ou abaixo de outra para reordenar (uma linha verde mostra onde ela vai ficar). Soltar no meio de uma página coloca a arrastada dentro dela. Sem arrastar, use **Mover para cima** e **Mover para baixo** nos três pontinhos. A ordem vale para todo o time.
