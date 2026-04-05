# Story: Corrigir Estética da Escolha de Personagem na Home

Status: concluído

O objetivo desta história é transformar a lista de seleção de personagens em uma interface "Premium" e mística, seguindo o padrão de **Cartas de Tarot/Vitoriano** já estabelecido no restante do sistema.

## 🎯 Escopo da Reformulação Visual

### 1. Grid de Personagens
- Substituir a lista linear por um **Grid Responsivo** de Cards.
- Implementar animações de entrada (`reveal`) para os cards.

### 2. Estilo dos Cards (`char-select-card`)
- **Visual**: Fundo escuro com bordas douradas sutis, utilizando as variáveis `--accent-color`.
- **Avatar**: O placeholder (letra inicial) será transformado em um selo circular ornamentado com brilho arcano.
- **Interação**: Efeito de *hover* que aumenta a escala, intensifica o brilho dourado e altera o cursor para um estilo de "mão mística".

### 3. Botão de Voltar
- Padronizar o botão "VOLTAR" para utilizar a classe `.mystic-btn` (já definida no projeto), garantindo consistência com os formulários de criação de sala.

## 📂 Arquivos Afetados

- `front_sistema_rpg/src/components/home/CharacterSelection.tsx`: Atualização da estrutura para suportar o novo layout e aplicação das classes corretas.
- `front_sistema_rpg/src/app/globals.css`: Adição de todo o sistema de estilos para a seleção de personagens, integrando-o ao design system vitoriano.

## ✅ Critérios de Aceitação

1.  **Estética Premium**: Os botões não devem mais parecer elementos HTML padrão; devem parecer artefatos de interface.
2.  **Responsividade**: O grid deve se ajustar de 1 a 4 colunas dependendo do tamanho da tela.
3.  **Feedback Visual**: O personagem selecionado ou sob o mouse deve ter um feedback visual claro (brilho/glow).
4.  **Consistência Tipográfica**: Uso das fontes `--font-header` (Cinzel) e `--font-victorian`.
