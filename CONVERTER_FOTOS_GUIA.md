# 📸 Converter Fotos para Base64 - GUIA RÁPIDO

## ✅ Passo 1: Converter Imagens Online (30 segundos)

**Site recomendado:** https://www.base64-image.de/ 

1. Acesse o link
2. Clique em "Select image"
3. Escolha uma das suas fotos
4. Copie o código que aparecer (inteiro)
5. Repita para todas as 5 fotos

## ✅ Passo 2: Editar o Arquivo de Imagens

Arquivo: `src/components/EquipeAmbiente.tsx`

Procure por:
```typescript
const EQUIPE_FOTOS = [
  {
    id: 'profissional-1',
    nome: 'Mykaele Procopio',
    cargo: 'Proprietária & Esteta',
    descricao: 'Especialista em corpo e rosto',
    foto: '', // ← Cole aqui o base64! Exemplo:
    // foto: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
    fundo: true,
  },
```

Substitua `foto: ''` por:
```typescript
foto: 'data:image/jpeg;base64,COPIE_TODO_O_CODIGO_AQUI',
```

## ✅ Passo 3: Ordem das Fotos

Baseado nas imagens que você tem:

| Posição | Tipo | ID | Nome |
|---------|------|-----|------|
| 1 | Profissional | `profissional-1` | Mykaele Procopio |
| 2 | Profissional | `profissional-2` | Profissional/Esteticista |
| 3 | Ambiente | `ambiente-1` | Área de Tratamento |
| 4 | Ambiente | `ambiente-2` | Sala de Procedimentos |
| 5 | Profissional/Equipe | `profissional-3` | Nossa Equipe |

## ✅ Passo 4: Salvar e Testar

1. Salve o arquivo
2. O site recarrega automaticamente
3. Visite `http://localhost:3001`
4. Scroll até "Nossa Equipe & Ambiente"
5. Pronto! Suas fotos estão lá! ✨

## 🎨 Personalizações Opcionais

Se quiser mudar:
- **Nomes:** Edite o campo `nome`
- **Descrição:** Edite `descricao`
- **Cargo:** Edite `cargo`
- **Fundo:** `fundo: true` = tem fundo | `fundo: false` = sem fundo

## ⚡ Alternativa Rápida (sem sair do VS Code)

Se preferir, posso criar um script Python que converte as imagens automaticamente. É só me dizer! 🚀

---

**Precisa de ajuda?** Me chama quando tiver o base64 pronto que completo para você!
