# 📁 Estrutura de Mídias - Mykaele

```
media/
├── profissionais/          📸 Fotos de perfil dos profissionais
│   ├── joao.jpg
│   ├── maria.jpg
│   └── carlos.jpg
│
├── procedimentos/          🏥 Fotos dos procedimentos
│   ├── botox.jpg
│   ├── preenchimento.jpg
│   ├── microagulhamento.jpg
│   ├── peeling.jpg
│   ├── lipoescultura.jpg
│   └── radiofrequencia.jpg
│
├── antes-depois/           ✨ Galeriaantes/depois de resultados
│   ├── harmonizacao-1-antes.jpg
│   ├── harmonizacao-1-depois.jpg
│   ├── rejuvenecimento-1-antes.jpg
│   ├── rejuvenecimento-1-depois.jpg
│   ├── lipoescultura-1-antes.jpg
│   └── lipoescultura-1-depois.jpg
│
├── tecnologias/            🔬 Fotos dos equipamentos
│   ├── laser-co2.jpg
│   ├── ultrassom.jpg
│   ├── rf.jpg
│   ├── microagulhas.jpg
│   ├── cavitacao.jpg
│   └── criofrecuencia.jpg
│
├── ambiente/               🏢 Fotos da clínica
│   ├── recepcao.jpg
│   ├── sala-consulta-1.jpg
│   ├── sala-consulta-2.jpg
│   ├── sala-procedimentos.jpg
│   ├── sala-repouso.jpg
│   └── area-espera.jpg
│
├── certificados/           📜 Credenciais e certificados
│   ├── crm-joao.jpg
│   ├── crm-maria.jpg
│   ├── crm-carlos.jpg
│   ├── abcd.jpg
│   └── rbecc.jpg
│
├── videos/                 🎥 Thumbnails de vídeos
│   ├── apresentacao-thumb.jpg
│   ├── tecnicas-thumb.jpg
│   └── resultados-thumb.jpg
│
├── logo-branding/          🎨 Logos e assets
│   ├── logo.png
│   ├── logo-white.png
│   ├── favicon.ico
│   └── og-image.jpg
│
└── README.md               📖 Este arquivo
```

---

## 📌 Como Usar

### 1️⃣ **Copiar suas fotos para as pastas corretas**

Organize seus arquivos nas pastas acima conforme o tipo.

**Exemplo:**
```
Você tem: foto-dr-joao.jpg
Coloca em: public/media/profissionais/joao.jpg

Você tem: resultado-botox.jpg
Coloca em: public/media/procedimentos/botox.jpg
```

### 2️⃣ **Atualizar o catálogo** (`src/lib/media-catalog.ts`)

```typescript
export const PROFISSIONAIS = {
  joao: {
    nome: 'Dr. João Silva',
    foto: '/media/profissionais/joao.jpg', // ← Caminho aqui
    // ...
  },
}
```

### 3️⃣ **Usar no componente**

```tsx
import { PROFISSIONAIS } from '@/lib/media-catalog'

export default function Profissional() {
  return (
    <img src={PROFISSIONAIS.joao.foto} alt={PROFISSIONAIS.joao.nome} />
  )
}
```

---

## 🎯 Convenções de Nomenclatura

### Profissionais
- `joao.jpg` (minúsculas, sem espaços)
- `maria.jpg`
- `carlos.jpg`

### Procedimentos
- `botox.jpg`
- `preenchimento.jpg`
- `microagulhamento.jpg`
- `lipoescultura.jpg`

### Antes/Depois
- `{procedimento}-{numero}-antes.jpg`
- `{procedimento}-{numero}-depois.jpg`

**Exemplo:**
```
harmonizacao-1-antes.jpg
harmonizacao-1-depois.jpg

rejuvenecimento-2-antes.jpg
rejuvenecimento-2-depois.jpg
```

### Tecnologias
- `laser-co2.jpg`
- `ultrassom.jpg`
- `rf.jpg`
- `microagulhas.jpg`

### Ambiente
- `recepcao.jpg`
- `sala-consulta-1.jpg`
- `sala-procedimentos.jpg`

### Certificados
- `crm-{nome}.jpg`
- `abcd.jpg`
- `rbecc.jpg`

### Vídeos (Thumbnails)
- `{descricao}-thumb.jpg`

**Exemplo:**
```
apresentacao-thumb.jpg
tecnicas-thumb.jpg
resultados-thumb.jpg
```

### Logo/Branding
- `logo.png` (fundo transparente)
- `logo-white.png` (versão branca)
- `favicon.ico` (16x16 ou 32x32)
- `og-image.jpg` (1200x630 pixels para redes sociais)

---

## 📸 Padrões de Imagem Recomendados

| Tipo | Tamanho | Resolução | Formato |
|------|--------|-----------|---------|
| Profissional | 500x600px | 300x360px | JPG |
| Procedimento | 600x400px | 400x267px | JPG |
| Antes/Depois | 600x600px | 600x600px | JPG |
| Tecnologia | 500x500px | 400x400px | JPG |
| Ambiente | 1200x800px | 1000x667px | JPG |
| Logo | Variável | 200x100px mín | PNG |
| OG Image | 1200x630px | 1200x630px | JPG |

---

## 🚀 Funções Úteis do Catálogo

### Obter todos os dados

```typescript
import { getAllMedia } from '@/lib/media-catalog'

const todasAsMidias = getAllMedia()
// {
//   profissionais: {...},
//   procedimentos: {...},
//   antes_depois: [...],
//   ...
// }
```

### Fotos de um procedimento

```typescript
import { getProcedimentoFotos } from '@/lib/media-catalog'

const fotosHarmonizacao = getProcedimentoFotos('harmonização')
// [{ id: 'harmonizacao-1', antes: '...', depois: '...', ... }]
```

### Fotos de um profissional

```typescript
import { getProfissionalFotos } from '@/lib/media-catalog'

const fotosJoao = getProfissionalFotos('Dr. João Silva')
// [{ procedimento: '...', antes: '...', depois: '...', ... }]
```

### Todas as imagens (para preload)

```typescript
import { getAllImages } from '@/lib/media-catalog'

const todasAsImages = getAllImages()
// ['/media/profissionais/joao.jpg', '/media/procedimentos/botox.jpg', ...]
```

### Estatísticas

```typescript
import { getMediaStats } from '@/lib/media-catalog'

const stats = getMediaStats()
// {
//   profissionais: 3,
//   procedimentos: 6,
//   antes_depois: 3,
//   total: 47,
//   ...
// }
```

---

## ✅ Checklist de Setup

- [ ] Copiar fotos para pastas corretas
- [ ] Atualizar `src/lib/media-catalog.ts`
- [ ] Testar em `http://localhost:3001`
- [ ] Verificar otimização de imagens
- [ ] Adicionar mais fotos conforme necessário

---

## 🎨 Próximas Melhorias

- [ ] Integração com Cloudinary para otimização automática
- [ ] Lazy loading com Next.js Image
- [ ] Galeria modal/lightbox
- [ ] Pré-carregamento de imagens
- [ ] Compressão automática

---

**Pronto para adicionar seus conteúdos!** 📸
