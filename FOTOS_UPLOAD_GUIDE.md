# 📸 Guia de Upload de Fotos - 3 Opções

## ✅ Você tem 3 formas de adicionar fotos ao seu site

---

## **OPÇÃO 1: Rápido & Fácil (Sem login necessário)**

### Local - Arquivos na pasta `public`

**Passo 1:** Coloque suas fotos aqui
```
site-mykaele/
└── public/
    └── fotos/
        ├── profissional-joao.jpg
        ├── profissional-maria.jpg
        └── procedimento-lipo.jpg
```

**Passo 2:** Use em qualquer lugar:
```tsx
<img src="/fotos/profissional-joao.jpg" alt="Dr. João" />
```

✅ **Vantagens:**
- Super rápido
- Sem configurações
- Pronto para usar

❌ **Desvantagens:**
- Imagens grandes deixam o site mais lento
- Sem otimizações automáticas
- Difícil de gerenciar muitas fotos

---

## **OPÇÃO 2: Profissional & Escalável (Recomendado! ⭐)**

### Cloudinary - Armazenamento em nuvem com otimizações

**Passo 1: Criar conta Cloudinary**

1. Acesse: https://cloudinary.com
2. Clique em "Sign Up Free"
3. Preencha dados (5 minutos)
4. Confirme email

**Passo 2: Copiar credenciais**

Na dashboard do Cloudinary:
1. Clique em "Settings" (engrenagem)
2. Vá para aba "API Keys"
3. Copie essas 3 informações:

```
Cloud Name:   seu_cloud_name
API Key:      sua_api_key_aqui
API Secret:   seu_api_secret_aqui
```

**Passo 3: Adicionar ao .env.local**

Abra `site-mykaele/.env.local` e adicione:

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=seu_cloud_name
CLOUDINARY_API_KEY=sua_api_key_aqui
CLOUDINARY_API_SECRET=seu_api_secret_aqui
```

**Passo 4: Usar no código**

```tsx
// src/components/Profile.tsx
import PhotoUpload from '@/components/PhotoUpload'

export default function Profile() {
  return (
    <PhotoUpload
      folder="mykaele/profissionais"
      onSuccess={(url) => console.log('Foto salva em:', url)}
    />
  )
}
```

**Passo 5: As fotos aparecem com URLs assim:**

```
https://res.cloudinary.com/seu_cloud_name/image/upload/w_800,h_600/foto.jpg
```

✅ **Vantagens:**
- Otimização automática
- Redimensionamento automático
- Compressão automática
- Grátis até 25GB
- Super rápido (CDN global)

---

## **OPÇÃO 3: Completa (API Database)**

### Integrar com Banco de Dados

**Tabela no Prisma:**

```prisma
// prisma/schema.prisma

model PatientPhoto {
  id            String   @id @default(cuid())
  patientId     String
  patient       PatientProfile @relation(fields: [patientId], references: [id])
  
  cloudinaryUrl String
  cloudinaryPublicId String
  uploadedAt    DateTime @default(now())
  
  @@index([patientId])
}
```

**Executar migration:**
```bash
npx prisma migrate dev --name add_patient_photos
```

---

## 🎯 Qual Escolher?

| Situação | Opção |
|----------|-------|
| Testes locais / Demo | **1 (Local)** |
| **Produção / Site ativo** | **2 (Cloudinary)** ⭐ |
| Galeria com histórico | **3 (Database)** |

---

## 📤 Exemplo Prático - Adicionar Fotos Agora

### Adicione fotos do profissional:

**Local (Opção 1):**
```bash
# Crie a pasta
mkdir -p public/fotos

# Copie suas fotos para lá
cp seu_arquivo.jpg public/fotos/profissional.jpg
```

**No código:**
```tsx
export default function ProfessionalsSection() {
  return (
    <div>
      <img src="/fotos/profissional.jpg" alt="Profissional" />
    </div>
  )
}
```

### Ou use Cloudinary (Opção 2):

```tsx
// src/app/admin/upload/page.tsx
'use client'
import PhotoUpload from '@/components/PhotoUpload'

export default function AdminUpload() {
  return (
    <div className="p-8">
      <h1>Gerenciar Fotos</h1>
      <PhotoUpload 
        folder="mykaele/profissionais"
        onSuccess={(url) => {
          console.log('✅ Foto enviada:', url)
        }}
      />
    </div>
  )
}
```

---

## 🎨 Componente de Upload Pronto

Já criei para você: `src/components/PhotoUpload.tsx`

Uso simples:
```tsx
import PhotoUpload from '@/components/PhotoUpload'

export default function MyPage() {
  return (
    <PhotoUpload 
      folder="mykaele"
      onSuccess={(url) => {
        // Fazer algo com a URL
        console.log('URL da foto:', url)
      }}
      maxSize={5} // 5MB máximo
    />
  )
}
```

---

## 📸 Enviar Arquivos Agora

### **Método Rápido:**

1. **Crie a pasta:**
   ```bash
   mkdir -p public/fotos
   ```

2. **Copie suas fotos para:** `site-mykaele/public/fotos/`

3. **Pronto!** Use no código:
   ```tsx
   <img src="/fotos/sua-foto.jpg" />
   ```

### **Método Cloud (Cloudinary):**

1. Crie conta: https://cloudinary.com
2. Copie credenciais
3. Adicione a `.env.local`
4. Use o componente `<PhotoUpload />`

---

## 📋 Checklist

- [ ] Decidir: Local ou Cloudinary?
- [ ] Se Cloudinary: Criar conta e copiar credenciais
- [ ] Adicionar `.env.local` com as keys
- [ ] Copiar fotos para `public/fotos/` (ou fazer upload via Cloudinary)
- [ ] Testar em http://localhost:3001

---

## ❓ Próxima Dúvida?

Envie aqui as suas fotos e eu integro para você! 📸
