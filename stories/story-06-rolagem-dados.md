---
story: story-06
title: "Resolução de Problemas Críticos na Rolagem de Dados (Sincronização e Estabilidade)"
Status: concluído
priority: critica
epic: epic-01-refatoracao-modular
---

# Story-06: Resolução de Problemas Críticos na Rolagem de Dados

## Contexto do Problema
Durante uma sessão online de ontem com 8 jogadores conectados simultaneamente em diferentes dispositivos e regiões (incluindo acessos via celular, notebooks limitados e conexões de alta latência como Portugal), o sistema de rolagem de dados e exibição de resultados apresentou falhas sistêmicas críticas:

1. **Dessincronização de Logs e Resultados:** Os logs de rolagem deixaram de aparecer de forma consistente no chat/combat log para o Mestre (GM) ou entre os jogadores. Alguns jogadores viam apenas os resultados de suas próprias rolagens e, por vezes, nem essas.
2. **Travamento Severo (Freeze):** A página congelou completamente para alguns usuários, impedindo qualquer interação com o botão de rolar. Isso afetou especificamente usuários de celular e notebook com menor capacidade de processamento.
3. **Falha de Renderização 3D:** Alguns jogadores presenciaram apenas uma "caixa vazia" onde os dados deveriam ser renderizados, indicando falha na inicialização ou perda de contexto WebGL do componente 3D.
4. **Resiliência a Estresse e Latência:** O sistema quebrou sob carga de 8 clientes, sugerindo que a sincronia de eventos acoplada via broadcast/WebSockets falhou em lidar com a latência simultânea.

## Escopo (Hipóteses e Áreas de Atuação)
Dado o cenário relatado, a solução deverá atuar em três frentes principais:
1. **Otimização de Renderização 3D (Desempenho e Memória)**: Identificar e mitigar memory leaks da `DiceChamber` / `useFateDiceSimulation.ts`, gerenciar preventivamente a perda de contexto WebGL e desativar/simplificar processos que estão bloqueando a thread principal (especialmente focado para aparelhos mobile e Low-End PCs).
2. **Desacoplamento de UI e Rede na Rolagem**: Garantir que as animações dos dados não dependam da resposta síncrona do servidor para rodar inicialmente, ou que eventuais falhas do WebSocket / Supabase Broadcast não congelem ou previnam que a rolagem aconteça e seja visualizada localmente.
3. **Estabilização da Propagação de Eventos (Event Sourcing)**: Investigar por que `CombatLog` / Logs não estão refletindo eventos consistentes sob alta latência para todos e consertar o payload ou fluxo no tráfego de Event Sourcing.

## Arquivos Afetados (Estimativa Inicial)
- **UI / 3D Render:**
  - `src/components/DiceRoller.tsx` / `src/components/DiceRoller/DiceChamber.tsx`
  - `src/hooks/useDiceRoller.ts` / `src/hooks/useFateDiceSimulation.ts`
- **Sincronismo / Log:**
  - `src/components/CombatLog.tsx`
  - `src/lib/diceSimulationStore.ts`
  - `src/lib/gameLogic.ts`

## Critérios de Aceitação
- [ ] O componente `DiceChamber` (renderizador 3D) possui gerenciamento seguro de montagem/desmontagem sem estourar o limite do WebGL ou travar a Interface UI na versão mobile.
- [ ] O usuário sempre é capaz de apertar o botão de rolar; se o render 3D falhar, ocorre fallback gracioso (mostra os resultados brutos em 2D ou via log) sem "caixas vazias" penduradas em tela.
- [ ] Em cenários de latência alta (simulação com DevTools), as informações da rolagem são exibidas localmente ao jogador que rodou instantaneamente, e o log do broadcast eventualmente reflete na tela do GM de forma correta sem perdas massivas.
- [ ] A rolagem de um player será sempre replicada no log para todos sem descasamento entre o valor no dado 3D e o valor no log.

---
**NOTA:** Não iniciar o código antes da aprovação do Mestre e elaboração de um plano de execução pela equipe.
