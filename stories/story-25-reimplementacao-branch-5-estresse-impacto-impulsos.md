# Story 25: Reimplementação Branch 5.0 — Estresse, Impacto e Impulsos

Esta story documenta a reimplementação das features 1, 3 e 4 da branch 5.0 no ambiente atual (`4.1_menores_mudancas_gerais`). O objetivo é restaurar funcionalidades críticas de estresse customizável, sincronia de áudio de dados e indicadores de impulso no combate.

> **Feature 2 (Rolagem Oculta) está excluída** desta reimplementação.

## 📋 Escopo

### 1. Feature 1: Estresse Alterável (Customizable Stress Boxes)
- Transição do tipo `stress` de `boolean[]` para `StressBox[]` com valores numéricos customizáveis.
- Implementação de normalização nas projections para garantir retrocompatibilidade com personagens antigos.
- Adição de interface de edição de valores das caixas de estresse para o Mestre (GM), inline no card.

### 2. Feature 3: Som de Impacto (Impact SFX Timing)
- Modificação da lógica de som dos dados para disparar no momento do impacto físico (`onFirstImpact`), em vez do clique inicial.
- Atualização do motor de física dos dados para detectar e notificar o primeiro contato com o chão, com flag `_hasImpacted` por dado.

### 3. Feature 4: Impulsos no Combat Card
- Implementação de marcadores visuais ("Impulsos") no cabeçalho do Combat Card.
- Adição de lógica de eventos para adicionar (somente GM) e remover (qualquer jogador) impulsos.
- Reestruturação do cabeçalho do Combat Card em duas linhas para suportar os novos indicadores.

---

## 📂 Arquivos Afetados

### Domínio e Projections
- **`src/types/domain.ts`**:
  - Novo tipo `StressBox = { value: number; checked: boolean }`
  - Campo `impulses?: number` na interface `Character`
  - Atualizar evento existente `STRESS_TRACK_EXPANDED` para aceitar `value?: number` no payload
  - Novos eventos: `STRESS_BOX_VALUE_CHANGED`, `CHARACTER_IMPULSE_ADDED`, `CHARACTER_IMPULSE_REMOVED`

- **`src/lib/projections.ts`**:
  - Adicionar funções `normalizeStressTrack` e `normalizeStress` (topo do arquivo)
  - Atualizar case **`CHARACTER_CREATED`** para normalizar stress via `normalizeStress`
  - Atualizar case **`STRESS_MARKED`** para operar com `StressBox[]` (usando `normalizeStressTrack`)
  - Atualizar case **`STRESS_CLEARED`** para operar com `StressBox[]` (usando `normalizeStressTrack`)
  - Atualizar case **`STRESS_TRACK_EXPANDED`** para aceitar `payload.value` opcional e append `{ value, checked: false }`
  - Adicionar case `STRESS_BOX_VALUE_CHANGED`
  - Adicionar cases `CHARACTER_IMPULSE_ADDED` e `CHARACTER_IMPULSE_REMOVED`

### Componentes de Personagem
- **`src/components/CharacterCreator.tsx`**: Inicialização de estresse como `StressBox[]` (com `value: i+1`) em vez de `boolean[]`.
- **`src/components/CharacterCard/useCharacterCard.ts`**: Novo handler `handleStressBoxValueChange`.
- **`src/components/CharacterCard/CharacterVitality.tsx`**: Suporte a `StressBox[]`; sub-componente `StressTrack` com edição inline de valor (estado `editingIndex`/`editValue`; blur/Enter confirma, Escape cancela).
- **`src/components/CharacterCard/CharacterCard.tsx`**: Passagem do novo prop `onStressBoxValueChange` para `CharacterVitality`.

### Sistema de Dados
- **`src/lib/diceSimulationStore.ts`**: Adicionar `onFirstImpact?: () => void` na interface `DiceSimulationParams`.
- **`src/lib/dicePhysics.ts`**: Adicionar `_hasImpacted?: boolean` em `PhysicsDie`; atualizar `physicsStep` para receber `onFirstFloorHit?` e chamá-lo apenas na primeira colisão de cada dado.
- **`src/components/FateDice3D.tsx`**: No loop de animação, passar `params?.onFirstImpact` como terceiro argumento de cada `physicsStep(die, walls, ...)`.
- **`src/hooks/useDiceRoller.ts`**: Remover o `new Audio(...)` do início de `handleRoll`; criar o áudio dentro do callback `onFirstImpact` passado ao `diceSimulationStore.show()`. Manter o safety timeout de 15s para forçar reset se os dados não assentarem.

### Combate
- **`src/components/hooks/useCombatCard.ts`**: Handlers `handleAddImpulse` e `handleRemoveImpulse` com `useCallback`.
- **`src/components/CombatCard/CombatCard.tsx`**: Extrair e passar `handleAddImpulse` e `handleRemoveImpulse` para `CombatHeader`.
- **`src/components/CombatCard/CombatHeader.tsx`**: Layout em duas linhas (linha 1: botão colapso + nome + botão rolagem; linha 2: controles de impulso + pontos de destino). Importar `ArrowDown` de `lucide-react`. Botão de adicionar impulso visível apenas para GM; indicadores de impulso clicáveis por todos.

---

## ⚙️ Regras de Negócio Críticas

1. **Retrocompatibilidade obrigatória**: `normalizeStressTrack` converte `boolean` legado para `{ value: i+1, checked: bool }` automaticamente. Personagens antigos nunca devem quebrar.
2. **`userId` normalizado**: Todo `actorUserId` deve usar `.trim().toLowerCase()` ao comparar ou enviar eventos.
3. **Impulsos são contador**: `character.impulses` é um `number`, não um array. `Math.max(0, ...)` impede valores negativos.
4. **Somente GM adiciona impulsos**: O botão de adicionar só é renderizado quando `isGM === true`.
5. **Todos podem remover impulsos**: Qualquer jogador que veja o card pode clicar nos indicadores para removê-los.
6. **Som dos dados**: O arquivo fica em `/audio/Effects/dados.MP3` (path público). Pode ser sobrescrito por `soundSettings?.dice` da sessão. O flag `_hasImpacted` garante que o callback dispara uma vez por dado — o som é acionado pelo **primeiro dado** a tocar o chão.

---

## ✅ Critérios de Aceitação

### Estresse
- [ ] O Mestre consegue clicar no número de uma caixa de estresse para editar seu valor (inline, com input).
- [ ] Confirmar com Enter ou blur salva; Escape cancela sem alterar.
- [ ] Personagens antigos (com `boolean[]`) continuam funcionando normalmente — valores automáticos 1, 2, 3... aplicados pela normalização.
- [ ] Ao expandir a trilha de estresse, a nova caixa assume o próximo valor sequencial ou um valor explicitamente definido no evento.

### Dados
- [ ] O som `dados.MP3` toca exatamente quando o **primeiro dado** atinge a mesa na simulação 3D, não ao clicar.
- [ ] O flag `_hasImpacted` por dado impede que o callback dispare mais de uma vez por dado.
- [ ] Se os dados não assentarem em 15 segundos, o estado de rolagem é resetado automaticamente (safety timeout).

### Impulsos
- [ ] O Mestre vê um botão de "Seta para Baixo" (`ArrowDown`) para adicionar impulsos no Combat Card.
- [ ] Os impulsos aparecem como setas brancas com brilho (glow) abaixo do nome do personagem.
- [ ] Qualquer jogador pode clicar em um impulso para removê-lo.
- [ ] O cabeçalho do Combat Card exibe nome e botão de expansão na linha 1; impulsos e pontos de destino na linha 2.
- [ ] `character.impulses` nunca fica negativo.

---

**Status:** Aguardando Aprovação
