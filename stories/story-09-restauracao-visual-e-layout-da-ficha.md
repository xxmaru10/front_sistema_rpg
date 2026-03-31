---
title: "Story #09: Restauração Visual e de Layout da Ficha"
description: "Resolvendo a estética inacabada em seções específicas da ficha e tornando o layout fluido para melhor aproveitamento de espaço em notebooks."
status: draft
last_updated: 2026-03-31
---

# User Story: Restauração Visual e de Layout da Ficha

**Como** um jogador ou mestre em um notebook,
**Eu quero** que a ficha de personagem aproveite melhor o espaço da minha tela e tenha um design consistente em todas as suas seções (como Façanhas e Magias),
**Para que** a experiência de jogo seja imersiva, premium e funcional em diferentes resoluções.

## 🎯 Escopo

1.  **Layout Fluido**: Ajustar a largura máxima da ficha (`.char-artifact`) e seus containers para que se expandam conforme o tamanho da janela, evitando que a ficha fique "encolhida" no centro com grandes margens vazias.
2.  **Design de Seções Inacabadas**:
    *   **Façanhas (Stunts)** e **Magias (Spells)**: Substituir o texto simples por um layout de "cards" ou blocos estilizados com bordas, backgrounds sutis e tipografia correta.
    *   **Botões de Ação**: Estilizar todos os botões que ainda usam o padrão do navegador (ex: `+NOVA FAÇANHA`, `+NOVA MAGIA`).
    *   **Reserva de Destino**: Garantir que os valores (ex: "3 / 3") utilizem a fonte de cabeçalho correta e tenham o peso visual adequado.
    *   **Consequências**: Melhorar a tipografia dos slots de consequência para usar a identidade visual do sistema (Cinzel/Decorative).

## 📂 Arquivos Afetados

*   `src/components/CharacterCard/CharacterCard.styles.tsx`: Onde reside a maior parte da lógica visual.
*   `src/components/CharacterCard/CharacterStunts.tsx`: Estrutura das façanhas.
*   `src/components/CharacterCard/CharacterSpells.tsx`: Estrutura das magias.
*   `src/components/CharacterCard/CharacterConsequences.tsx`: Estrutura das consequências.
*   `src/components/CharacterCard/CharacterVitality.tsx`: Estrutura da Reserva de Destino.

## ✅ Critérios de Aceitação

* [ ] A ficha (`.char-artifact`) não fica limitada a um tamanho pequeno em telas largas, expandindo-se para ocupar o espaço disponível (mantendo um `max-width` razoável de ~1200px ou conforme a necessidade do layout).
* [ ] As seções de Façanhas e Magias não são mais apenas texto corrido; cada item deve parecer um elemento "premium" da ficha.
* [ ] Os botões `+NOVA FAÇANHA` e `+NOVA MAGIA` seguem o estilo oficial (bordas douradas, fundo semi-transparente, hover effects).
* [ ] A numeração da Reserva de Destino e das Consequências utiliza as fontes configuradas no tema (Cinzel/Playfair).
* [ ] O inventário flutuante e outros elementos absolutos permanecem funcionais e visíveis após a expansão do layout.
* [ ] O design é responsivo e não quebra em resoluções comuns de notebook (ex: 1366x768).

---
