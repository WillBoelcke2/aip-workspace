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
