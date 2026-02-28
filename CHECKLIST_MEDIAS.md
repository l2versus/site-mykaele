# ✅ Checklist de Mídias - Passo a Passo

```
╔════════════════════════════════════════════════════════════════╗
║                    SETUP DE MÍDIAS COMPLETO                   ║
║                                                                ║
║    Pastas: 8 ✅  |  Componentes: 4 ✅  |  Docs: 3 ✅         ║
╚════════════════════════════════════════════════════════════════╝
```

---

## 🎯 FASE 1: Preparar suas Fotos

### [ ] 1. Organize suas fotos por tipo

```
Suas Fotos
├── 👨‍⚕️ Profissionais
│   ├── joao.jpg
│   ├── maria.jpg
│   └── carlos.jpg
├── ✨ Antes & Depois
│   ├── harmonizacao-1-antes.jpg
│   ├── harmonizacao-1-depois.jpg
│   └── ... (mais pares)
├── 🏥 Procedimentos
│   ├── botox.jpg
│   ├── preenchimento.jpg
│   └── ...
└── Etc...
```

### [ ] 2. Verifique os tamanhos

| Tipo | Tamanho Recomendado |
|------|-------------------|
| Profissional | 300 × 360px |
| Antes/Depois | 600 × 600px |
| Procedimento | 400 × 267px |
| Ambiente | 1000 × 667px |
| Logo | 200 × 100px |
| OG Image | 1200 × 630px |

### [ ] 3. Nomeie conforme convenção

✅ **Siga a convenção:**
- `joao.jpg` (sem espaços, minúsculas)
- `harmonizacao-1-antes.jpg` (antes e depois)
- `botox.jpg` (sem caracteres especiais)

❌ **NÃO use:**
- `Foto do Dr João.jpg` (espaços, maiúsculas)
- `Botox-2024-v2-final.jpg` (nomes longos)
- `pic_001.jpg` (nomes genéricos)

---

## 🎬 FASE 2: Copiar para o Site

### **Opção A: Windows Explorer (Mais Fácil)** ⭐

[ ] 1. Abra Windows Explorer
[ ] 2. Cole este caminho na barra:
   ```
   C:\Users\admin\Desktop\site myka\site-mykaele\public\media
   ```
[ ] 3. Copie suas pastas/fotos para as subpastas corretas

Estrutura:
```
media/
├── profissionais/       ← Cole fotos aqui
├── procedimentos/       ← Cole fotos aqui
├── antes-depois/        ← Cole pares aqui
├── tecnologias/         ← Cole fotos aqui
├── ambiente/            ← Cole fotos aqui
├── certificados/        ← Cole documentos aqui
├── videos/              ← Cole thumbnails aqui
└── logo-branding/       ← Cole logos/assets aqui
```

### **Opção B: Painel Web** (Mais Rápido)

[ ] 1. Vá para: `http://localhost:3001/admin/upload-media`
[ ] 2. Selecione a categoria
[ ] 3. Arraste as fotos ou clique "Selecionar"
[ ] 4. Clique "Upload"

---

## 📝 FASE 3: Atualizar o Catálogo

### [ ] 4. Edite `src/lib/media-catalog.ts`

Exemplo - Como adicionar profissional:

```typescript
export const PROFISSIONAIS = {
  joao: {
    nome: 'Dr. João Silva',
    foto: '/media/profissionais/joao.jpg',  // ← Adicione aqui
    especialidade: 'Harmonização Facial',
    bio: 'Especialista em...',
  },
  // ... mais profissionais
}
```

### [ ] 5. Adicione antes e depois

```typescript
export const ANTES_DEPOIS = [
  {
    id: 'harmonizacao-1',
    procedimento: 'Harmonização Facial',
    antes: '/media/antes-depois/harmonizacao-1-antes.jpg',  // ← Caminho
    depois: '/media/antes-depois/harmonizacao-1-depois.jpg', // ← Caminho
    profissional: 'Dr. João Silva',
    resultado: 'Simetria facial melhorada',
  },
  // ... mais resultados
]
```

### [ ] 6. Adicione procedimentos

```typescript
export const PROCEDIMENTOS = {
  botox: {
    nome: 'Botox',
    foto: '/media/procedimentos/botox.jpg',  // ← Caminho
    descricao: 'Redução de rugas expressão',
    categoria: 'Facial',
  },
  // ... mais procedimentos
}
```

### [ ] 7. Adicione tecnologias e ambiente

```typescript
export const TECNOLOGIAS = {
  laser: {
    nome: 'Laser de CO₂',
    foto: '/media/tecnologias/laser-co2.jpg',  // ← Caminho
    descricao: 'Renovação profunda de pele',
  },
}

export const AMBIENTE = {
  recepcao: '/media/ambiente/recepcao.jpg',  // ← Caminhos
  sala1: '/media/ambiente/sala-consulta-1.jpg',
  // ...
}
```

---

## 🧪 FASE 4: Testar

### [ ] 8. Reinicie o servidor

```bash
# Parar o servidor atual (Ctrl+C)
# depois:
npm run dev
```

### [ ] 9. Visualize em `http://localhost:3001`

- [ ] Verifique se as fotos aparecem na landing page
- [ ] Clique em "Conheça nossos profissionais"
- [ ] Acesse `/patient/antes-depois` para ver galeria
- [ ] Comente alguma foto para confirmar que funcionou

### [ ] 10. Acesse o painel admin

- [ ] `http://localhost:3001/admin/media` ← Gerenciador
- [ ] `http://localhost:3001/admin/upload-media` ← Upload

---

## 📊 FASE 5: Usar no Site

### [ ] 11. Integre a galeria em seu site

Exemplo na landing page:

```tsx
import GaleriaMedia from '@/components/GaleriaMedia'

export default function Home() {
  return (
    <div>
      {/* ... seu conteúdo ... */}
      <GaleriaMedia 
        titulo="Resultados Reais"
        descricao="Veja transformações de nossos pacientes"
      />
    </div>
  )
}
```

### [ ] 12. Customize conforme necessário

- Editar cores, tipografia
- Adicionar mais categorias
- Integrar com Cloudinary (opcional)

---

## 🎯 RESUMO DOS ARQUIVOS CRIADOS

```
✅ 8 Pastas de Mídia
   └── public/media/
       ├── profissionais/
       ├── procedimentos/
       ├── antes-depois/
       ├── tecnologias/
       ├── ambiente/
       ├── certificados/
       ├── videos/
       └── logo-branding/

✅ 5 Arquivos de Código
   ├── src/lib/media-catalog.ts           (Catálogo centralizado)
   ├── src/components/GaleriaMedia.tsx    (Galeria interativa)
   ├── src/components/MediaUploadManager.tsx (Upload component)
   ├── app/admin/media/page.tsx          (Gerenciador admin)
   └── app/admin/upload-media/page.tsx   (Interface upload)

✅ 3 Arquivos de Documentação
   ├── public/media/README.md             (Estrutura & convenções)
   ├── FOTOS_UPLOAD_GUIDE.md              (Guia de upload)
   └── MEDIA_SETUP_COMPLETE.md            (Este arquivo!)
```

---

## 🚀 LINKS RÁPIDOS

| Ação | URL |
|------|-----|
| 🎨 Ver Galeria | http://localhost:3001/patient/antes-depois |
| 📊 Admin - Mídias | http://localhost:3001/admin/media |
| 📤 Admin - Upload | http://localhost:3001/admin/upload-media |
| 💾 Arquivo de Código | `src/lib/media-catalog.ts` |

---

## ❓ DÚVIDAS FREQUENTES

### P: Onde exatamente coloco as fotos?
**R:** Em `public/media/[categoria]/`
Exemplo: `public/media/profissionais/joao.jpg`

### P: Como aparece a foto no site?
**R:** Atualize `src/lib/media-catalog.ts` com o caminho

### P: Posso usar fotos grandes?
**R:** Sim, mas elas carregarão mais lento. Otimize antes.

### P: Como adicionar mais categorias?
**R:** Crie pasta em `public/media/` e adicione em `media-catalog.ts`

### P: Preciso fazer backup das fotos?
**R:** Sim! Guarde uma cópia em local seguro.

---

## ✨ Próximos Passos (Opcionais)

- [ ] Integrar Cloudinary para otimização automática
- [ ] Setup de CDN para mais velocidade
- [ ] Backup automático de fotos
- [ ] Galeria com filtros por procedimento
- [ ] Integração com Stripe para agendamentos

---

## ✅ CHECKLIST FINAL

- [ ] Fotos preparadas (tamanho, nome)
- [ ] Fotos copiadas para `public/media/[categoria]/`
- [ ] `media-catalog.ts` atualizado
- [ ] Servidor reiniciado
- [ ] Site verificado em `http://localhost:3001`
- [ ] Galeria funcionando
- [ ] Admin acessível

---

```
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║           🎉 PRONTO PARA ADICIONAR SUAS MÍDIAS! 🎉           ║
║                                                                ║
║    Perguntas? Consulte public/media/README.md ou             ║
║    FOTOS_UPLOAD_GUIDE.md                                      ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

---

**Data de Criação:** 25 de Fevereiro de 2026  
**Sistema:** VSCode + Next.js 14 + Mykaele 3.0  
**Status:** ✅ Pronto para Produção
