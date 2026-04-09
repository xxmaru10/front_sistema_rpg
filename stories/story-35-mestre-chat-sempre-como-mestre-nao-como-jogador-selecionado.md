---
title: "Story 35 - Mestre no chat sempre como Mestre, nunca como jogador selecionado na barra de rolagem"
description: "Corrigir o fluxo de autoria do chat para que a identidade do GM permaneça fixa como Mestre, sem ser afetada pela seleção de personagem no módulo de rolagem."
priority: "alta"
status: "concluida"
last_updated: "2026-04-09 (implementacao-finalizada)"
tags: [chat, gm, identidade, rolagem, ui, fluxo]
---

# Story 35 - Mestre no chat sempre como Mestre, nunca como jogador selecionado na barra de rolagem

## Contexto
Foi reportado que, ao escrever no chat, o Mestre pode aparecer como se fosse um dos jogadores selecionados na barra de rolagem.  
O comportamento esperado é: **mensagens do GM no chat devem sempre sair como Mestre**, independentemente do personagem atualmente selecionado para ações de rolagem.

Pelo mapeamento atual:
1. `TextChatPanel` envia mensagens com `userId` e resolve exibição de nome;
2. `HeaderWrapper` injeta `userId` no chat via `useHeaderLogic`;
3. `useHeaderLogic` controla identidade derivada de `searchParams`/`localStorage`;
4. `DiceRoller` e `useDiceRoller` mantêm seleção de personagem para rolagem.

A Story deve garantir isolamento entre:
1. **identidade de autoria de chat** (quem fala);
2. **contexto de atuação de rolagem** (com qual personagem o usuário rola).

## Escopo

### Fase 1 - Diagnóstico e separação de responsabilidades
1. Identificar onde a identidade do chat está sendo acoplada ao contexto de rolagem para o GM.
2. Definir contrato explícito no frontend para distinguir:
   - `chatAuthorId` (identidade fixa no chat);
   - `selectedCharacterId` (contexto variável de rolagem).

### Fase 2 - Correção do fluxo de autoria do chat
1. Ajustar o envio de mensagens para que o GM sempre publique com identidade de Mestre.
2. Garantir que a renderização do nome no chat respeite essa identidade fixa do GM.
3. Evitar que seleção de personagem na barra de rolagem altere autoria de chat.

### Fase 3 - Regressão e consistência de UX
1. Preservar comportamento atual para jogadores (mensagem continua saindo como jogador logado).
2. Validar que histórico e mensagens em tempo real exibem o mesmo autor para o GM.
3. Manter o módulo de rolagem funcional sem perda de seleção de personagem.

## Arquivos Afetados
| Arquivo | Responsabilidade no escopo |
|---|---|
| `src/components/TextChatPanel.tsx` | Corrigir regra de autoria/envio e exibição de nome no chat para o GM. |
| `src/components/HeaderWrapper.tsx` | Garantir passagem correta de identidade para o chat sem herdar contexto de rolagem. |
| `src/hooks/useHeaderLogic.ts` | Consolidar origem de identidade do usuário no header, com comportamento estável para GM. |
| `src/hooks/useDiceRoller.ts` | Garantir que seleção de personagem permaneça restrita ao contexto de rolagem, sem efeito colateral no chat. |
| `src/components/DiceRoller/RollerInputs.tsx` | Validar que dropdown de personagem altera apenas estado de rolagem. |
| `src/app/session/[id]/page.tsx` | Revisar separação entre identidade global da sessão e contexto de ação em componentes que compartilham `actorUserId`. |

## Critérios de Aceitação
1. Quando o usuário entra como GM e envia mensagem no chat, o autor exibido é sempre Mestre.
2. Alterar o personagem no seletor da barra de rolagem não muda a autoria das mensagens do GM no chat.
3. Mensagens já enviadas pelo GM continuam associadas à identidade de Mestre após refresh/reentrada.
4. Jogadores continuam aparecendo no chat com sua própria identidade sem regressão.
5. O dropdown de personagem da rolagem continua funcionando para rolar com personagens diferentes, sem impactar o chat.
6. Histórico de chat recebido por outros clientes mantém o mesmo autor do GM (consistente entre emissor e observadores).
7. Não há regressão visual no `TextChatPanel` (envio, leitura, contador de não lidas).
8. A correção não altera regras de permissão de rolagem nem lógica de combate.

## Fora de Escopo
- Reescrever o sistema de chat em outro protocolo.
- Alterar regras de turn order, combate, estresse ou consequências.
- Mudanças visuais amplas na UI do chat além do necessário para correção de autoria.
- Refatorações amplas no fluxo de login fora do necessário para estabilizar identidade do GM no chat.

## Dependências e Riscos
- Risco de regressão se `actorUserId` continuar com dupla responsabilidade (eventos de ação + autoria de chat) sem separação clara.
- Risco de inconsistência entre cliente emissor e observadores se apenas a UI local for ajustada sem alinhar o payload de envio.
- Risco de colateral em componentes que dependem do mesmo `userId` no header caso o ajuste não seja isolado por contexto.

## Status de Execução
- Implementação concluída.
- Build de produção validado com sucesso (`npm run build`) em 2026-04-09.
