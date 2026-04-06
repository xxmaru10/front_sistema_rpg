---
story: story-28
title: Foto do Personagem no Ícone do Voice Chat
status: aguardando aprovação
priority: baixa
tags: ui, webrtc, voice, avatar, componente
---

# Story-28: Foto do Personagem no Ícone do Voice Chat

## Contexto do Problema

Atualmente, a lista de participantes no `VoiceChatPanel` exibe cada pessoa como uma linha horizontal:
`[avatar círculo 45px] + [nome à direita]`

O avatar circular já busca a imagem do personagem via `getCharacterImage()` quando disponível.
Porém, quando há foto, o layout atual exibe a inicial do nome em um pequeno badge posicionado
no canto inferior-direito do círculo (absoluto, `bottom: -2px, right: -6px`) — o que fica visualmente poluído.

O usuário quer um layout de **ícone compacto**:
- Foto do personagem ocupando todo o círculo
- Inicial do nome (ou nome curto) exibida **abaixo** do ícone circular, em texto
- Mestre (GM) não tem foto → exibe ícone de status (🎤/🔊/🔇) + label abaixo

---

## Objetivos

- [ ] Redesenhar o item de participante no painel de voice para o formato **ícone compacto** (vertical: círculo → label abaixo)
- [ ] Exibir a foto do personagem preenchendo o círculo (object-fit: cover) quando disponível
- [ ] Exibir a **inicial do nome** do personagem em texto abaixo do círculo (não mais como badge sobreposto)
- [ ] Para o Mestre (sem foto): manter ícone emoji de status (🎤/🔊/🔇/👤) no círculo + label "GM" ou "Mestre" abaixo
- [ ] Manter o **anel de borda verde pulsante** no círculo para indicar que está falando
- [ ] Manter o indicador de mudo, ausência de voz e áudio level nos ícones

---

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/components/VoiceChatPanel.tsx` | Refatorar o bloco de renderização de cada participante (linhas ~774–826) para layout vertical compacto |

> **Fora de escopo:** `VoiceChatManager.ts`, backend, sistema de eventos, projeções, qualquer lógica que não seja visual do painel.

---

## Layout Alvo

```
┌──────────────┐
│  [  foto  ]  │  ← círculo 45px com foto do personagem (ou emoji se GM)
│   J          │  ← inicial do nome em texto abaixo (ou "GM")
└──────────────┘
```

Em vez do layout atual:
```
[ foto ] Nome do Personagem
           No voice / Online
```

Quando a lista de participantes é longa (ex: 6+ jogadores), o formato de ícones compactos
permite exibir mais pessoas em menos espaço, usando `flex-wrap`.

---

## Critérios de Aceitação

1. **Foto visível**: O círculo do participante exibe a imagem do personagem quando disponível (via `getCharacterImage()`), preenchendo o círculo por inteiro.
2. **GM sem foto**: O círculo do GM exibe o emoji de status atual (🎤/🔊/🔇/👤) sem imagem — comportamento idêntico ao atual, apenas com layout vertical.
3. **Inicial abaixo**: Abaixo de cada círculo aparece a **inicial do nome** (ou nome curto até ~6 chars) do personagem/participante em texto pequeno (`0.6rem`), substituindo o badge sobreposto.
4. **Anel de fala**: Quando um participante está falando (`user.speaking === true`), o círculo mantém a borda verde pulsante (`#50c878`).
5. **Ícone de mudo**: Quando mutado, um ícone de 🔇 ou badge pequeno sobre o círculo indica mudo — sem quebrar o layout vertical.
6. **Wrap de participantes**: Os ícones usam `flex-wrap: wrap` para acomodar múltiplos participantes sem rolar horizontalmente.
7. **Sem regressão**: Volume individual, mute por peer, indicadores de fala, auto-join e todos os controles existentes continuam funcionando.
8. **Sem label lateral de nome**: O nome completo à direita do avatar é removido do item compacto (reduz ruído visual). O nome completo pode aparecer em `title` (tooltip) para acessibilidade.

---

## Notas de Implementação (para agente de código)

- O bloco a refatorar está em `VoiceChatPanel.tsx` por volta das linhas 760–850 — renderização de `allParticipants.map(...)`.
- `getCharacterImage(user.id, user.characterId)` já retorna `null` para o GM — usar esse retorno para bifurcar o render.
- `getDisplayName(user.id, user.characterId)` retorna o nome completo — usar `.substring(0, 6)` ou `.charAt(0).toUpperCase()` para o label abaixo.
- O badge de inicial sobreposto (posição absoluta, `bottom/-2px`, `right/-6px`) deve ser **removido** em favor do label textual abaixo.
- Não adicionar novos estados no componente — a refatoração é puramente visual (JSX + inline styles).
