---
title: "Story 34 - Arena: avatares circulares laterais com expansão progressiva dos cards"
description: "Transformar os botões de expansão dos cards da Arena em avatares circulares com foto, ancorados nas laterais, permitindo abrir o card completo principal e expandir os demais abaixo dele em cada lado."
priority: "alta"
status: "concluida"
last_updated: "2026-04-08 (implementacao-validada)"
tags: [ui, arena, combat, cards, avatar, personagem, npc]
---

# Story 34 - Arena: avatares circulares laterais com expansão progressiva dos cards

## Contexto
O card de combate da Arena já possui comportamento de recolher/expandir localmente e uma identidade visual consolidada no frontend, com estilização distinta para heróis, aliados do jogador, NPCs heróicos e ameaças. A solicitação agora é alterar a navegação visual desses cards sem mudar regras de combate, eventos ou permissões já existentes.

O novo fluxo desejado é:
1. os personagens da Arena deixam de usar o botão `+`/`-` como ponto primário de expansão;
2. cada personagem passa a ser representado, quando fechado, por um avatar circular com a imagem da ficha;
3. esse avatar fica dentro de um suporte quadrado de borda arredondada, visualmente alinhado ao tema do card e parecendo sair da lateral da página;
4. ao clicar no avatar, o card completo aparece no lado correspondente da Arena;
5. os demais personagens daquele lado permanecem em formato compacto até serem clicados, e novos cards expandidos passam a surgir abaixo do card principal.

Pelo que já existe em [knowledge/architecture.md](/C:/Users/danie/Desktop/RPG/CrownVtt/front_sistema_rpg/knowledge/architecture.md), esta Story deve permanecer na camada de apresentação e composição da UI. Não há necessidade de alterar Event Sourcing, projeções, regras de turno ou contratos de domínio.

## Escopo

### Fase 1 - Novo modo compacto lateral dos cards
- Substituir o gatilho atual de recolher/expandir por um modo compacto visual baseado em:
1. foto circular do personagem;
2. moldura externa quadrada com bordas arredondadas;
3. acabamento visual coerente com o tema do card daquele lado da Arena.
- Garantir fallback visual quando o personagem não tiver `imageUrl`, sem quebrar layout nem interação.

### Fase 2 - Orquestração de abertura por lado da Arena
- Reorganizar a coluna de aliados e a coluna de inimigos para trabalharem com dois estados visuais:
1. cards compactos em formato de avatar lateral;
2. cards completos expandidos na pilha do respectivo lado.
- Manter a abertura separada entre os dois lados da Arena:
1. heróis/aliados controlados independentemente;
2. inimigos/ameaças controlados independentemente.
- O primeiro card expandido de cada lado ocupa a posição principal daquele lado.
- Cards adicionais abertos depois aparecem abaixo do principal, preservando os demais fechados em modo compacto.

### Fase 3 - Preservação do card completo existente
- Quando expandido, o card continua usando a estrutura funcional já existente do `CombatCard`, incluindo:
1. estresse;
2. consequências;
3. extras;
4. ações de destino;
5. ações GM-only já implementadas.
- A mudança deve ser de navegação e apresentação, sem simplificar nem remover controles do card completo.

### Fase 4 - Layout e responsividade da Arena
- Ajustar o layout lateral da Arena para comportar:
1. avatares compactos saindo visualmente da lateral;
2. pilha de cards completos abaixo do card principal;
3. leitura clara em desktop;
4. degradação segura em telas menores e mobile, sem sobreposição quebrada.
- Preservar a hierarquia visual entre lado dos heróis e lado das ameaças já presente na estilização dos cards.

## Arquivos Afetados
| Arquivo | Responsabilidade no escopo |
|---|---|
| `src/components/session/CombatTab.tsx` | Orquestrar o estado visual por coluna da Arena, definindo quais personagens ficam em modo compacto e quais aparecem expandidos como card principal ou cards subsequentes. |
| `src/components/CombatCard/CombatCard.tsx` | Suportar o novo modo de renderização do card na Arena, separando estado compacto lateral e estado expandido completo. |
| `src/components/CombatCard/CombatHeader.tsx` | Trocar o papel do antigo botão de expandir/recolher pelo novo gatilho visual com avatar/foto e manter os controles do header quando o card estiver expandido. |
| `src/components/CombatCard/CombatCard.styles.tsx` | Implementar a estética do avatar circular, suporte quadrado com cantos arredondados, protrusão lateral e espaçamentos entre cards compactos e expandidos. |
| `src/app/session/[id]/session.css` | Adaptar o grid/layout da Arena para acomodar as novas colunas laterais, empilhamento visual dos cards e responsividade. |

## Critérios de Aceitação
1. Na Arena, personagens do lado dos heróis e do lado dos inimigos passam a aparecer fechados como avatares circulares com foto, dentro de um suporte quadrado de borda arredondada.
2. O visual do suporte compacto herda a linguagem cromática do card correspondente, mantendo coerência entre herói, aliado próprio, NPC heróico e ameaça.
3. Ao clicar em um avatar, o `CombatCard` completo daquele personagem aparece no lado correspondente sem perder nenhuma funcionalidade já existente do card.
4. Personagens não expandidos permanecem visíveis apenas no formato compacto, sem abrir automaticamente todos os cards da coluna.
5. Em cada lado da Arena, o primeiro card expandido fica em posição principal e cards expandidos posteriormente aparecem abaixo dele.
6. Lado dos heróis e lado dos inimigos funcionam de forma independente; abrir cards de um lado não interfere na pilha do outro.
7. Caso um personagem não tenha imagem, o avatar compacto continua clicável e exibe fallback visual coerente com o tema do card.
8. Permissões já existentes permanecem iguais no card expandido: GM continua com ações GM-only e jogador continua limitado ao que já podia fazer.
9. O fluxo atual de estresse, consequências, destino, impulso e extras continua funcionando exatamente como hoje dentro do card expandido.
10. O layout não gera clipping, sobreposição ilegível ou perda de clique nas laterais da Arena em desktop.
11. Em resoluções menores, a Arena continua utilizável, mesmo que a apresentação dos avatares laterais seja adaptada para caber melhor na coluna.
12. Nenhum evento novo de domínio é necessário para esta entrega; a mudança permanece local à UI/composição visual da Arena.

## Fora de Escopo
- Alterar regras de combate, turn order, dano, estresse, consequências, destino ou impulso.
- Persistir via Event Sourcing ou `localStorage` quais cards ficaram abertos/fechados entre refreshes.
- Redesenhar o painel de desafio ativo.
- Reestruturar `HazardCard` para seguir o mesmo padrão de avatar circular, já que a solicitação descreve personagens dos lados de heróis e inimigos.
- Modificar contratos de `domain.ts`, projeções ou eventos apenas para sustentar esse comportamento visual.

## Dependências e Riscos
- Há risco de regressão de usabilidade se o estado expandido continuar totalmente local ao `CombatCard` em vez de subir para a orquestração da `CombatTab`.
- Há risco de clipping visual porque o pedido exige que o avatar/suporte pareça sair da lateral da página; isso depende de revisar overflow e espaçamento das colunas da Arena.
- Há risco de ambiguidade de ordenação do card principal caso o comportamento esperado seja diferente de "primeiro expandido no topo e próximos abaixo"; essa confirmação deve acontecer na aprovação da Story antes da implementação.

## Status de Execução
- Implementação concluída.
- Cards da Arena passaram a operar com rail lateral de avatares compactos e pilhas independentes de cards expandidos para heróis e ameaças.
- Build de produção validado com sucesso via `npm run build` em 2026-04-08.
