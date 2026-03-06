# 🛠️ CORREÇÃO DO BANCO E LOGIN - CONFIGURAÇÃO COOLIFY

## O que aconteceu

O banco PostgreSQL no Coolify estava **VAZIO** - as tabelas foram criadas pela migração Prisma, mas os dados do SQLite antigo não foram transferidos. Por isso:
- Nenhum cliente/paciente aparecia
- O login admin não funcionava (erro 500)
- O dashboard estava vazio

## ✅ O que foi corrigido

1. **Banco populado** com dados iniciais:
   - 1 usuário admin criado
   - 10 serviços padrão
   - Horários de atendimento (Seg-Sáb, 08:00-18:00)

2. **Código ajustado** para não quebrar durante o build

## 🔐 Credenciais do Admin

- **Email:** `admin@mykaprocopio.com.br`
- **Senha:** `myka2024`

## ⚠️ CONFIGURAÇÃO OBRIGATÓRIA NO COOLIFY

Você precisa adicionar as **variáveis de ambiente** no projeto do Coolify.

### Como fazer:

1. Acesse o Coolify → seu projeto → **Environment Variables**
2. Adicione as seguintes variáveis:

```
DATABASE_URL=postgres://postgres:F2CnUQgJ36UmSz1lvuYHluw99hykrgsnBjehPaUgUkvc2LAhJxL4hLw0s7Ry5C8x@187.77.226.144:5432/postgres

JWT_SECRET=mykaele-home-spa-secret-key-2024

NEXTAUTH_SECRET=mykaele-nextauth-secret-2024

NEXT_PUBLIC_APP_URL=https://mykaprocopio.com.br

NODE_ENV=production
```

3. **Salve** e **faça Redeploy** da aplicação

### Variáveis opcionais (se usar):

```
# Cloudinary (se usar upload de imagens)
CLOUDINARY_CLOUD_NAME=seu_cloud
CLOUDINARY_API_KEY=sua_key
CLOUDINARY_API_SECRET=seu_secret

# WhatsApp (se usar integração)
WHATSAPP_API_URL=url_do_whatsapp
WHATSAPP_TOKEN=seu_token
```

## 📱 Para testar

Após configurar as variáveis e fazer redeploy:

1. Acesse: `https://mykaprocopio.com.br/admin`
2. Login: `admin@mykaprocopio.com.br`
3. Senha: `myka2024`

## 🔄 Se precisar re-popular o banco

Execute localmente:
```bash
node seed-postgres.mjs
```

## ⚠️ Sobre os dados antigos (SQLite)

Os dados antigos do SQLite local **NÃO foram migrados** automaticamente para o PostgreSQL. 
Se você tem backup do arquivo SQLite (`dev.db` ou similar), podemos criar um script de migração para transferir os pacientes.

**Você ainda tem o arquivo SQLite antigo?** Se sim, me avise que crio um script para migrar os dados.

---
Última atualização: 06/03/2026
