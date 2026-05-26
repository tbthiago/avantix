# Avantix Lab — Site + Cloudflare Deploy Guide

## Estrutura do Projeto

```
avantix/
├── public/                  ← Arquivos estáticos (servidos pelo Cloudflare Pages)
│   ├── index.html           ← Página inicial
│   ├── sobre.html           ← Sobre o laboratório
│   ├── servicos.html        ← Serviços
│   ├── tecnologia.html      ← Tecnologia
│   ├── ficha.html           ← Novo pedido (formulário)
│   ├── css/
│   │   └── styles.css
│   └── js/
│       └── main.js
│       └── portal.js           ← Login, dashboard do cliente e admin
├── functions/
│   └── api/
│       └── ficha.js         ← Cloudflare Pages Function (Worker)
│       └── auth/*           ← Cadastro/login/logout
│       └── pedidos.js       ← Pedidos do cliente
│       └── admin/pedidos.js ← Gestão de pedidos do laboratório
├── migrations/              ← SQL incremental para bancos existentes
├── schema.sql               ← Schema do banco D1
└── wrangler.toml            ← Configuração Cloudflare
```

---

## 1. Pré-requisitos

- Conta Cloudflare (free tier funciona)
- Node.js instalado
- Wrangler CLI: `npm install -g wrangler`
- Login: `wrangler login`

---

## 2. Criar o Banco D1

```bash
# Criar o banco
wrangler d1 create avantix-db

# Copie o database_id gerado e cole no wrangler.toml

# Criar as tabelas no banco remoto da Cloudflare
wrangler d1 execute avantix-db --remote --file=schema.sql
```

Se aparecer `no such table: main.fichas`, o banco remoto ainda não recebeu o
schema base. Rode:

```bash
wrangler d1 execute avantix-db --remote --file=schema.sql
```

Se o banco já tinha fichas antes do portal, rode a migration incremental em vez
de recriar. Use `--remote` para aplicar no D1 da Cloudflare; sem `--remote`, o
Wrangler usa o banco local em `.wrangler/state`.

```bash
wrangler d1 execute avantix-db --remote --file=migrations/001_portal_clientes.sql
```

Se aparecer `duplicate column name: cliente_id`, a coluna já foi criada nesse
banco. Nesse caso, complete apenas as tabelas/índices restantes:

```bash
wrangler d1 execute avantix-db --remote --file=migrations/002_portal_clientes_tables.sql
```

Para testar no banco local, remova `--remote`.

Para atualizar um banco antigo para o fluxo atual de status
(`recebido`, `pendente`, `triagem`, `em_producao`, `finalizado`, `entregue`), rode:

```bash
wrangler d1 execute avantix-db --remote --file=migrations/003_status_fluxo_pedidos.sql
```

Se a migration `003` já foi aplicada antes da inclusão do status `pendente`,
rode também:

```bash
wrangler d1 execute avantix-db --remote --file=migrations/004_status_pendente.sql
```

---

## 3. Criar o Bucket R2

```bash
# Criar bucket
wrangler r2 bucket create avantix-fichas
```

Para acessar os arquivos via URL pública, habilite o **Public Access** no
dashboard do R2: Cloudflare Dashboard → R2 → avantix-fichas → Settings → Public Access.

---

## 4. Deploy via Cloudflare Pages

### Opção A — Deploy via Git (recomendado)

1. Faça push deste projeto para GitHub/GitLab
2. No [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages → Create a project
3. Conecte o repositório
4. Configure:
   - **Framework preset**: None
   - **Build command**: *(deixe vazio)*
   - **Build output directory**: `public`
5. Clique em **Save and Deploy**

### Opção B — Deploy via Wrangler CLI

```bash
# Na raiz do projeto
wrangler pages deploy public --project-name=avantix-lab
```

---

## 5. Vincular D1 e R2 ao Pages Project

No **Cloudflare Dashboard**:

```
Pages → avantix-lab → Settings → Functions → Bindings
```

Adicione:

| Type | Variable name | Value                   |
|------|---------------|-------------------------|
| D1   | `DB`          | avantix-db              |
| R2   | `BUCKET`      | avantix-fichas          |

---

## 6. Variáveis de Ambiente (opcional)

O email interno padrão do administrador é:

```text
avantix@avantix.com.br
```

Ao cadastrar uma conta com esse email no portal, o usuário recebe acesso ao
painel do laboratório em `admin.html`. A senha será a senha escolhida nesse
cadastro.

Se quiser trocar esse email sem alterar o código, configure `ADMIN_EMAIL` como
secret do Pages:

```bash
wrangler pages secret put ADMIN_EMAIL --project-name=avantix
```

Quando o Wrangler pedir o valor, informe o email que deve acessar o painel do
laboratório. Não adicione `ADMIN_EMAIL` também no `wrangler.toml`, pois o
deploy falha se o mesmo binding existir como variável e secret.

Se quiser adicionar notificações por email (ex: via Resend ou SendGrid),
adicione em Pages → Settings → Environment Variables:

```
RESEND_API_KEY = re_xxxxxxxxxxxxxxxx
NOTIFY_EMAIL   = contato@avantixlab.com.br
```

O usuário cadastrado com o email definido em `ADMIN_EMAIL` recebe papel de
administrador automaticamente e acessa `admin.html`. Os demais usuários entram
em `dashboard.html`.

No painel `admin.html`, o administrador visualiza todos os pedidos e pode baixar
os arquivos enviados em cada pedido pela rota protegida `/api/admin/arquivo`.

---

## 7. Consultar Fichas no D1

```bash
# Listar fichas recentes
wrangler d1 execute avantix-db --command \
  "SELECT id, cliente, paciente, servico, status, criado_em FROM fichas ORDER BY criado_em DESC LIMIT 20"

# Atualizar status
wrangler d1 execute avantix-db --command \
  "UPDATE fichas SET status = 'em_producao' WHERE id = 1"
```

---

## 8. Personalizar

| O que mudar                  | Onde                          |
|------------------------------|-------------------------------|
| Cores da marca               | `css/styles.css` → `:root`    |
| Telefone / Email             | Todos os HTML files (rodapé)  |
| Textos e conteúdo            | Cada `.html`                  |
| Logo SVG                     | Substituir nos `<nav>` de cada página |
| Limite de arquivo (100MB)    | `functions/api/ficha.js`      |
| Campos do formulário         | `public/ficha.html` + `schema.sql` |

---

## Tecnologias utilizadas

- **Cloudflare Pages** — Hospedagem estática + Functions (Workers)
- **Cloudflare D1** — Banco de dados SQLite serverless
- **Cloudflare R2** — Armazenamento de objetos (arquivos)
- HTML/CSS/JS puro — Zero dependências de framework no frontend
- Google Fonts — Cormorant Garamond + DM Sans + DM Mono
