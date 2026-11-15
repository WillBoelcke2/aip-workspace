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
