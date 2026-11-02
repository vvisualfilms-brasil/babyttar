# Babyttar — Como publicar e instalar (custo zero)

Tempo total: ~20 minutos, uma vez só.

Você vai criar **dois repositórios** no GitHub:

| Repositório | Visibilidade | Para quê |
|---|---|---|
| `babyttar` | **Público** (exigência do Pages grátis) | O código do app. Não tem nenhum dado do bebê. |
| `babyttar-dados` | **Privado** | Os registros do bebê. Só vocês acessam. |

---

## 1. Conta no GitHub
Se ainda não tiver: github.com → *Sign up*.

## 2. Repositório de dados (privado)
1. Abra **github.com/new**.
2. *Repository name*: `babyttar-dados`
3. Marque **Private**.
4. Clique em **Create repository**. Pode deixar vazio; o app cria os arquivos.

## 3. Token (a "chave" que o app usa para ler e gravar os dados)
1. Abra **github.com/settings/personal-access-tokens/new**
   (ou: foto no canto → *Settings* → *Developer settings* → *Personal access tokens* → *Fine-grained tokens* → *Generate new token*).
2. *Token name*: `Babyttar`
3. *Expiration*: a maior opção disponível. Quando vencer, o app avisa e você gera outro (nada se perde).
4. *Repository access*: **Only select repositories** → escolha `babyttar-dados`.
5. *Permissions* → *Repository permissions* → **Contents** → **Read and write**. (Não precisa de mais nada.)
6. **Generate token** e copie o código (começa com `github_pat_`). Ele só aparece uma vez; guarde nas suas notas seguras.

> Esse token só acessa o `babyttar-dados`. Se um celular for perdido, apague o token em *Fine-grained tokens* e gere outro.

## 4. Publicar o app (repositório público `babyttar`)
O jeito mais fácil, sem terminal, é o **GitHub Desktop**:

1. Baixe em **desktop.github.com** e entre com sua conta.
2. *File* → **Add Local Repository…** → escolha a pasta `Claude/babyttar`.
   Ele vai dizer que a pasta ainda não é um repositório: clique em **create a repository**, depois **Create Repository**.
3. Clique em **Publish repository**.
   - *Name*: `babyttar`
   - **Desmarque** "Keep this code private".
   - **Publish Repository**.
4. No navegador, abra `github.com/SEU-USUARIO/babyttar` → **Settings** → **Pages** → em *Source* escolha **GitHub Actions**.
5. Aba **Actions**: espere o "Publicar no GitHub Pages" ficar verde (~2 min). Se ele rodou antes do passo 4 e falhou, clique nele → **Re-run all jobs**.
6. O app fica em: **`https://SEU-USUARIO.github.io/babyttar/`**

## 5. Instalar nos celulares
**iPhone (Safari):** abra o endereço → botão **Compartilhar** → **Adicionar à Tela de Início** → *Adicionar*.
**Android (Chrome):** abra o endereço → menu **⋮** → **Instalar app** (ou "Adicionar à tela inicial").

Sempre abra pelo ícone da tela inicial: assim o app abre em tela cheia, funciona offline e o iPhone não apaga os dados.

## 6. Primeira configuração
**No primeiro celular (ex.: Pai):**
1. Toque em **Pai** (ou escreva o nome).
2. Repositório: `SEU-USUARIO/babyttar-dados`
3. Token: cole o `github_pat_…`
4. **Conectar** → cadastre o bebê (nome, nascimento, sexo, foto, vitamina D).

**No segundo celular (ex.: Mãe):**
1. Toque em **Mãe**, mesmo repositório, **mesmo token** (envie para ela por um canal seu, uma vez só).
2. **Conectar** → o app baixa o bebê e os registros e já entra direto.

Pronto: o que um registra aparece no outro em até ~30 segundos (na hora, se o app for reaberto).

---

## Dia a dia
- **Sem internet?** Registre normal. O ícone no topo mostra "offline · N" e envia sozinho quando a conexão voltar.
- **Errou um horário?** Histórico → toque no registro → ajuste → Salvar.
- **Apagou sem querer?** Toque em *Desfazer* na hora, ou Bebê → Lixeira → Recuperar.
- **Backup extra:** Bebê → Backup → Exportar tudo (JSON). Os dados também ficam com histórico de versões no próprio GitHub.

## Atualizações do app
Quando o código mudar: GitHub Desktop → escreva um resumo → **Commit to main** → **Push origin**. Em ~2 min o app nos celulares se atualiza sozinho (na próxima abertura). Os dados não são tocados.

## Testar no Mac sem publicar
Na pasta do projeto: `npm install` (uma vez) e depois `npm run dev`, e abra `http://localhost:5173`. Use "Testar só neste aparelho" ou conecte ao `babyttar-dados`.
