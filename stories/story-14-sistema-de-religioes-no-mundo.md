# Story: Sistema de Religiões no Mundo

## Status: 📝 Em Progresso

O objetivo desta história é implementar um sistema completo de Religiões dentro do módulo de notas de mundo, permitindo que personagens, localizações, facções e criaturas tenham vínculos religiosos formais, facilitando a construção de mundo e lore.

## 🎯 Escopo da Implementação

### 1. Novo Tipo de Entidade de Mundo
- Criar o tipo de entidade `RELIGIAO` no sistema de `WorldEntities`.
- Integrar este tipo ao `EventStore` para persistência e sincronia em tempo real.

### 2. Interface de Gerenciamento (Submenu)
- Adicionar a aba **"RELIGIÕES"** no submenu de Notas -> Mundo (ao lado de Facções).
- A interface deve permitir:
    - Criar novas religiões (Nome, Descrição, Cor, Tags, Imagem).
    - Listar, editar e excluir religiões existentes.
    - Gerenciar visibilidade de campos (GM vs Jogador).

### 3. Vínculos Religiosos
- Adicionar o campo `religionId` nas seguintes entidades:
    - **Personagens** (Ficha e Entidade de Mundo).
    - **Localizações**.
    - **Facções**.
    - **Criaturas** (Bestiário).
- Implementar um seletor (Dropdown) nos modais de criação/edição que liste todas as religiões cadastradas no mundo.

### 4. Visualização
- Exibir o nome da religião vinculada nos detalhes da entidade.
- Se possível, permitir navegação (clicar no nome da religião para abrir seus detalhes).

## 📂 Arquivos Afetados

- `front_sistema_rpg/src/types/domain.ts`: Expansão do enum `WorldEntityType` e interfaces de entidades.
- `front_sistema_rpg/src/components/SessionNotesTabs/WorldTab.tsx`: Inclusão do botão de submenu e lógica de filtro.
- `front_sistema_rpg/src/components/SessionNotesTabs/CreateWorldEntityModal.tsx`: Adição do campo de seleção de religião no formulário.
- `front_sistema_rpg/src/components/SessionNotesTabs/ViewWorldEntityModal.tsx`: Exibição da religião e suporte a edição.
- `front_sistema_rpg/src/components/CharacterCreator.tsx` / `CharacterCard.tsx`: Integração da religião na ficha do personagem.

## ✅ Critérios de Aceitação

1.  **Submenu Funcional**: Ao clicar em "RELIGIÕES" no menu de mundo, a lista de religiões deve carregar corretamente.
2.  **Criação Unificada**: O botão "+" deve abrir o modal de criação já pré-configurado para o tipo "RELIGIAO".
3.  **Vínculo Dinâmico**: A lista de opções no seletor de religiões deve ser atualizada em tempo real conforme novas religiões são criadas.
4.  **Consistência de Dados**: Ao salvar uma entidade com uma religião, o `religionId` deve ser persistido corretamente no evento `WORLD_ENTITY_UPDATED` ou `CHARACTER_UPDATED`.
5.  **Aesthetics Premium**: O ícone e a cor da religião devem seguir o padrão místico/vitoriano do projeto.

---
> [!IMPORTANT]
> Esta implementação deve seguir rigorosamente o padrão de **Event Sourcing** já estabelecido, utilizando o `globalEventStore` para todas as mutações.
