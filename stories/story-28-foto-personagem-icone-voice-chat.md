---
story: story-28
title: Foto do Personagem no Ícone do Voice Chat
status: concluído
priority: média
tags: ui, webrtc, voice, avatar, componente, bugfix
---

# Story-28: Foto do Personagem no Ícone do Voice Chat

## Contexto do Problema (original)

A lista de participantes no `VoiceChatPanel` exibia cada pessoa como uma linha horizontal
`[avatar círculo 45px] + [nome à direita]`, com a inicial em badge sobreposto no canto do círculo.

O usuário quer um layout de **ícone compacto**:
- Foto do personagem ocupando todo o círculo
- Nome curto (ou inicial) exibido **abaixo** do ícone circular
- Mestre (GM) não tem foto → exibe ícone de status (🎤/🔊/🔇) + label abaixo
- Controles (mute + volume) em **linha horizontal** abaixo do ícone
- Barra de volume longa e horizontal, range 0–200 como antes

---

## Estado Atual da Implementação

A primeira versão da story foi aplicada (grid compacto com `flex-wrap`), mas três bugs foram
reportados pelo usuário:

### Bug 1 — Imagem do personagem não aparece (apenas a letra)

**Causa raiz (dupla):**

A) O `div` usa `background: url(${charImg}) center/cover no-repeat`. O CSS shorthand
   `position/size` sem espaços ao redor da barra (`center/cover`) é interpretado de forma
   inconsistente por alguns browsers — o `backgroundSize: 'cover'` não é aplicado e a imagem
   some ou fica mal posicionada.

B) A busca `getCharacterImage` faz fallback por `ownerUserId` quando `characterId` não está
   na presença. Se o `ownerUserId` do personagem não bater exatamente com o `userId` da
   sessão de voz (ex.: maiúsculas, espaços extras), `charImg` retorna `null`.

**Solução:**
- Substituir o `<div style={{ background: url(...) }}/>` por um `<img>` com
  `style={{ width, height, borderRadius: '50%', objectFit: 'cover' }}` — renderização de
  imagem direta, sem ambiguidade de CSS shorthand.
- Manter o `<div>` circular como wrapper, posicionando o `<img>` absolutamente dentro dele
  (ou trocar o wrapper inteiro por `<img>` com o mesmo tamanho/borda/sombra).
- `getCharacterImage` **não** muda — o bug é de renderização, não de busca.

### Bug 2 — Barra de volume curta

**Causa raiz:** Após a refatoração para layout de card compacto (`width: '75px'`), os sliders
ficaram com `width: '35px'` (peer) e `width: '45px'` (mic) — muito estreitos.

**Solução:** Definir `width: '100%'` nos inputs `type="range"` dentro da área de controles,
aproveitando toda a largura do card (`75px`). O número atual do volume deve ser exibido ao
lado do slider (ex.: `{user.volume}`) para manter visibilidade do valor 0–200.

### Bug 3 — Controles empilhados verticalmente (deveriam ser horizontais)

**Causa raiz:** O `div.participant-controls` usa `flexDirection: 'column'`, empilhando o botão
de mute e o slider um sobre o outro.

**Solução:** Trocar para `flexDirection: 'row'`, `alignItems: 'center'`, `gap: '4px'`,
`flexWrap: 'wrap'` para que botão de mute + slider + número fiquem na mesma linha.

---

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/components/VoiceChatPanel.tsx` | Corrigir renderização do avatar (img tag), layout horizontal dos controles e largura do slider |

> **Fora de escopo:** `VoiceChatManager.ts`, backend, sistema de eventos, projeções.

---

## Layout Alvo (revisado)

```
┌──────────────────────────────┐
│        [ foto 50px ]         │  ← <img> circular com objectFit: cover
│         Joana                │  ← nome curto em texto abaixo
│  🔈 [════════════] 120       │  ← botão mute + slider horizontal + número do volume
└──────────────────────────────┘
```

Para o usuário local (EU):
```
│  ON  [════════════] 85       │  ← botão ON/OFF mic + slider de mic + número
```

---

## Critérios de Aceitação (revisados)

1. **Foto visível**: A foto do personagem aparece no círculo de 50px via `<img>` com
   `objectFit: 'cover'` e `borderRadius: '50%'`. Quando não há foto, mantém o `div`
   com emoji de status.
2. **GM sem foto**: Círculo com emoji (🎤/🔊/🔇/👤) e label abaixo — sem `<img>`.
3. **Nome curto abaixo**: Texto abaixo do círculo com até 8 caracteres + `..` se necessário.
4. **Anel de fala**: Borda verde `#50c878` pulsante quando `user.speaking === true`.
5. **Ícone de mudo**: Badge 🔇 sobreposto ao círculo quando mutado.
6. **Controles horizontais**: Botão mute + slider + número na mesma linha (`flex-row`).
7. **Slider longo**: Slider de volume com `width: '100%'` dentro do card de 75px, range 0–200.
8. **Número do volume visível**: Valor numérico atual (ex: `120`) exibido ao lado do slider.
9. **Wrap de participantes**: Container usa `flex-wrap: wrap` — múltiplos ícones lado a lado.
10. **Sem regressão**: mute por peer, auto-join, áudio level e device selectors continuam.

---

## Notas de Implementação (para agente de código)

### Fix do avatar (Bug 1)
```tsx
// ANTES (problemático):
<div style={{ background: `url(${charImg}) center/cover no-repeat`, width: 50, height: 50, borderRadius: '50%' }}>
  {!charImg && emoji}
</div>

// DEPOIS (correto):
<div style={{ width: 50, height: 50, borderRadius: '50%', overflow: 'hidden', border: ..., boxShadow: ... }}>
  {charImg
    ? <img src={charImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    : emoji
  }
</div>
```

### Fix dos controles (Bugs 2 e 3)
```tsx
// ANTES:
<div className="participant-controls" style={{ flexDirection: 'column', ... }}>
  <button>ON/OFF</button>
  <input type="range" style={{ width: '35px' }} />
</div>

// DEPOIS:
<div className="participant-controls" style={{ flexDirection: 'row', alignItems: 'center', gap: '4px', flexWrap: 'wrap', width: '100%' }}>
  <button>ON/OFF</button>
  <input type="range" style={{ flex: 1, minWidth: 0 }} />
  <span style={{ fontSize: '0.55rem', minWidth: '20px' }}>{valor}</span>
</div>
```

### Aplicar o mesmo fix de `<img>` nos indicadores flutuantes
Os indicadores fora do painel (position: fixed, lado direito) usam o mesmo padrão de
`background: url()` — aplicar o mesmo fix de `<img>` dentro do círculo.
