# Avantix Lab — Site + Cloudflare Deploy Guide

## Estrutura do Projeto

```
avantix/
├── public/                  ← Arquivos estáticos (servidos pelo Cloudflare Pages)
│   ├── index.html           ← Página inicial
│   ├── sobre.html           ← Sobre o laboratório
│   ├── servicos.html        ← Serviços
│   ├── tecnologia.html      ← Tecnologia
│   ├── ficha.html           ← Ficha de entrada (formulário)
│   ├── css/
│   │   └── styles.css
│   └── js/
│       └── main.js
├── functions/
│   └── api/
│       └── ficha.js         ← Cloudflare Pages Function (Worker)
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

# Criar as tabelas
wrangler d1 execute avantix-db --file=schema.sql
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

Se quiser adicionar notificações por email (ex: via Resend ou SendGrid),
adicione em Pages → Settings → Environment Variables:

```
RESEND_API_KEY = re_xxxxxxxxxxxxxxxx
NOTIFY_EMAIL   = contato@avantixlab.com.br
```

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
