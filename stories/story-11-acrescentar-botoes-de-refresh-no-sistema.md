# Story: Acrescentar 3 Botões de Refresh no Sistema

Status: concluído

O objetivo desta tarefa é adicionar botões de atualização localizada (refresh) em três áreas críticas do sistema: **Notas**, **Logs de Rolagem** (CombatLog) e **Menu de Logs** (LogTab). Estes botões devem permitir que o usuário force o re-carregamento dos dados sem precisar dar F5 na página inteira, garantindo que o estado local esteja sincronizado com o servidor.

## 🎯 Escopo

- **Lógica de Dados**:
  - Estender o `EventStore` para permitir uma reinicialização forçada da sessão (`forceRefresh`).
  - Atualizar o hook `useSessionEvents` para expor a função de refresh para os componentes.
- **Interface (UI)**:
  - Adicionar um botão com ícone de atualização (`RotateCw` ou similar) em:
    1.  **SessionNotes**: No cabeçalho da seção de notas.
    2.  **CombatLog**: No cabeçalho do log de rolagem (geralmente visível na Arena).
    3.  **LogTab**: No cabeçalho da aba principal de Logs.
  - O estilo dos botões deve seguir o padrão "Premium/Vitoriano" do sistema (bordas metálicas, hover com brilho).

## 📂 Arquivos Afetados

- `front_sistema_rpg/src/lib/eventStore.ts`: Implementação do método `forceRefresh`.
- `front_sistema_rpg/src/app/session/[id]/hooks/useSessionEvents.ts`: Exposição da função no hook.
- `front_sistema_rpg/src/components/SessionNotes.tsx`: Adição do botão na UI de Notas.
- `front_sistema_rpg/src/components/CombatLog.tsx`: Adição do botão na UI de Logs de Rolagem.
- `front_sistema_rpg/src/components/session/LogTab.tsx`: Adição do botão na UI da Aba de Logs.

## ✅ Critérios de Aceitação

1.  **Botão de Refresh em Notas**:
    - Visível na área de cabeçalho do `SessionNotes`.
    - Ao clicar, os eventos de notas devem ser recarregados do servidor.
2.  **Botão de Refresh em Logs de Rolagem**:
    - Visível no `CombatLog` (Arena).
    - Permite atualizar as rolagens recentes se houver atraso na sincronia.
3.  **Botão de Refresh em Aba de Logs**:
    - Visível no `LogTab`.
    - Atualiza todo o histórico de eventos da sessão.
4.  **Feedback Visual**:
    - O botão deve mostrar um estado visual (ex: girar ou mudar opacidade) enquanto o carregamento está em curso.
5.  **Comportamento Técnico**:
    - O refresh deve limpar o cache local de eventos e re-executar o fetch via API/Supabase.
    - Não deve causar um "blink" desnecessário em áreas não afetadas.
