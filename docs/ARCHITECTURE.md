# Arquitetura

## Decisão central

React não representa os milhares de elementos do mapa. Ele controla apenas barras, modais, busca, inspetor e player. O mundo visual pertence a `CanvasEngine`, que usa PixiJS/WebGL diretamente.

```text
React UI
  ├─ comandos do usuário
  ├─ editor HTML temporário
  └─ player de áudio persistente
            │
            ▼
      WorkspaceStore
      ├─ estado visível
      ├─ histórico undo/redo
      └─ fila de autosave
            │
      ┌─────┴──────────────┐
      ▼                    ▼
CanvasEngine          Repository
PixiJS/WebGL          Tauri invoke
LOD + culling         SQLite + RTree + FTS5
```

## Responsabilidades

### Interface React

- projetos, barra superior e player;
- busca `Ctrl+K`, inspetor e menus;
- textarea temporária durante edição;
- nunca cria um componente React por nó do canvas.

### CanvasEngine

- câmera, pan, zoom e conversão tela/mundo;
- desenho em lotes separados: regiões, conexões, nós e seleção;
- prévia transitória de seleção, movimento, redimensionamento e criação de arestas;
- culling antes de criar/atualizar objetos Pixi;
- LOD por escala;
- reciclagem de objetos visuais fora da viewport;
- eventos transformados em comandos do domínio.

### WorkspaceStore

- fonte de verdade em memória apenas para o conjunto carregado;
- operações imutáveis no domínio;
- histórico limitado de undo/redo;
- alterações agrupadas para autosave.
- um gesto contínuo do canvas gera uma única entrada no histórico.

### Persistência

- comandos Rust em thread separada da WebView;
- transações para salvar lotes de mudanças;
- RTree para consultar a viewport;
- FTS5 para busca instantânea;
- caminhos externos para imagens e MP3;
- miniaturas e cache separados dos dados canônicos.

## Zoom semântico

| Escala | Renderização |
| --- | --- |
| `< 0,12` | somente regiões principais e sessões |
| `0,12–0,32` | títulos, regiões filhas e nós importantes |
| `0,32–0,70` | nós, tipos e conexões principais |
| `>= 0,70` | texto completo, estado da sessão e detalhes |

O backend recebe o retângulo mundial visível com margem e o nível de detalhe. Assim, o banco pode conter 50 mil elementos enquanto o renderer trabalha apenas com centenas.

## Fluxograma de sessão

Uma sessão é uma região normal marcada como `session`. Seus elementos internos continuam no mesmo sistema de coordenadas da campanha. No mapa geral ela aparece como um cartão-resumo; aproximando, o conteúdo interno passa a ser desenhado. O modo `INICIAR SESSÃO` registra o caminho percorrido sem apagar os ramos alternativos.

## Referências

Uma aparição de NPC/local/item guarda `source_node_id`. Nome, imagem e campos principais são lidos do original. `instance_notes` pertence apenas à aparição da cena.

## Meta de desempenho

- 60 FPS em navegação comum;
- nenhum acesso ao SQLite por frame;
- consultas de viewport com debounce e margem de prefetch;
- atualizações gráficas somente quando câmera ou dados mudam;
- textos longos inexistem nos LODs distantes;
- imagens usam miniaturas por escala;
- saves em lotes dentro de transações;
- DOM constante, independente do tamanho da campanha.
