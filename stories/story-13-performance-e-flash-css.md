---
title: "Story #13: Performance da Ficha e Correção de Flash CSS"
description: "Diagnóstico e correção dos problemas de performance na aba PERSONAGENS e de flash visual ao clicar em botões de stress, pontos de destino e perícias."
status: in_progress
last_updated: 2026-04-02
---

# User Story: Performance da Ficha e Flash de CSS

**Como** mestre ou jogador navegando na aba PERSONAGENS,  
**Eu quero** que clicar em botões de stress, destino e perícias não cause nenhum flash/flickering visual,  
**Para que** a experiência de jogo seja fluida e profissional.

---

## 🐛 Diagnóstico da Causa Raiz

### Problema 1 — Performance geral (RESOLVIDO ✅)
- **Causa**: `CharacterCard.styles.tsx` injetava ~42KB de CSS via `<style jsx global>` em cada instância do componente. Com múltiplos personagens na tela, isso criava re-cálculos de estilo massivos no DOM.
- **Fix aplicado**: CSS extraído para `CharacterCard.css` (arquivo estático). Import movido de `CharacterCard.tsx` (client component) para `layout.tsx` (server component), garantindo inclusão no bundle crítico da página.

### Problema 2 — Flash de CSS ao clicar em botões (PENDENTE 🔴)
- **Causa raiz identificada**: `page.tsx` linhas 347-364 contém um bloco `<style jsx global>` que é **re-injetado em cada renderização** do componente de página. A cada clique de botão, o `globalEventStore` dispara um evento → `page.tsx` re-renderiza → o bloco `<style>` é removido e reinserido no DOM → o browser recalcula todos os estilos → animações CSS (`.animate-reveal`) reiniciam do `opacity: 0`.

```tsx
// page.tsx:347 — O CULPADO:
<style jsx global>{`
  body { ${activeTab === "combat" ? `background-image: url(...)` : ""} ... }
  .session-container { ${activeTab === "combat" ? "padding: ..." : ""} }
  .combat-control-bar { margin-bottom: ${...}; }
`}</style>
```

Este é o **mesmo padrão** do Fix #1 (`CharacterCardStyles`), mas em `page.tsx`.

### Evidência do Performance Tab
```
Layout shift score: 0.0012 (×4)
  div.lower-content-grid
    div.power-tabs-container.animate-reveal   ← animação reinicia a cada click
      div.reserve-actions
        span.symbol
```

---

## ✅ Trabalho Concluído

| Item | Arquivo | Status |
|---|---|---|
| CSS estático (Fix #1) | `CharacterCard.css` criado | ✅ |
| Import CSS no servidor | `layout.tsx` | ✅ |
| Bug avatar/portrait | `CharacterPortrait.tsx` | ✅ |
| Animate-reveal no root | `CharacterCard.tsx` | ✅ |
| Fontes genéricas (`'Cinzel Decorative'`) | `CharacterCard.css` | ✅ |
| CSS ausente (consequências, add-resource-btn, etc.) | `CharacterCard.css` | ✅ |
| Layout das consequências (grid, centralização) | `CharacterCard.css` | ✅ |

---

## 🔴 Próximo Passo — Fix Definitivo do Flash

### O que fazer:

**1. Mover os estilos dinâmicos para CSS estático (`session.css`)**

Adicionar em `session.css`:
```css
/* Modo combate — substitui o <style jsx global> de page.tsx */
.session-container.in-combat {
    padding: 0 40px 120px 40px !important;
    min-height: 100vh;
}
.session-container.in-combat .combat-control-bar {
    margin-bottom: 10px;
}
body {
    transition: background-image 0.5s ease-in-out;
}
```

**2. Remover o `<style jsx global>` de `page.tsx` (linhas 347-364)**

Substituir por:
- Classe `in-combat` no elemento `.session-container` quando `activeTab === "combat"`
- `useEffect` para controlar o `background-image` do `body` via `document.body.style`

**3. Aplicar classe condicional no session-container (page.tsx:522)**
```tsx
// Antes:
<div className="session-container animate-reveal">
// Depois:
<div className={`session-container animate-reveal${activeTab === "combat" ? " in-combat" : ""}`}>
```

**4. Adicionar `useEffect` para o background do body**
```tsx
useEffect(() => {
  const show = activeTab === "combat" && !!headerImageUrl && !videoStream && !state.battlemap?.isActive;
  if (show) {
    document.body.style.backgroundImage = `radial-gradient(...), url(${headerImageUrl})`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
    document.body.style.backgroundAttachment = "fixed";
    document.body.style.backgroundRepeat = "no-repeat";
  } else {
    document.body.style.backgroundImage = "";
    document.body.style.backgroundSize = "";
    document.body.style.backgroundPosition = "";
    document.body.style.backgroundAttachment = "";
    document.body.style.backgroundRepeat = "";
  }
}, [activeTab, headerImageUrl, videoStream, state.battlemap?.isActive]);
```

---

## 📂 Arquivos a Carregar Obrigatoriamente

| Arquivo | Por quê |
|---|---|
| `src/app/session/[id]/page.tsx` | Contém o culpado: `<style jsx global>` linha 347-364 |
| `src/app/session/[id]/session.css` | Onde as regras estáticas de combate devem ir |
| `src/components/CharacterCard/CharacterCard.css` | Estado atual dos estilos da ficha |
| `src/app/layout.tsx` | Imports CSS do servidor |
| `src/app/globals.css` | Transições globais (modificadas) |

---

## 🚫 Tentativas que NÃO funcionaram (não repetir)

1. **Remover `animate-reveal` de `PowerTabsSection`** — não era o elemento causador; remover piorou porque a animação não completava em `opacity:1`
2. **Trocar `* { transition }` por seletores específicos** — não resolve porque a causa não é a transição, é o re-inject do `<style>` tag
3. **Mover `CharacterCard.css` para `layout.tsx`** — correto para o FOUC, mas não resolve o flash do botão

---

## ✅ Critérios de Aceitação

- [ ] Clicar em caixas de stress não causa nenhum flash visual
- [ ] Clicar em `+/-` de pontos de destino não causa flash
- [ ] Clicar em níveis de perícia não causa flash
- [ ] Mudar de mobile para desktop não é mais necessário para "resetar" o estado
- [ ] O modo combate ainda tem o background image correto
- [ ] O padding do `.session-container` em modo combate continua funcionando
