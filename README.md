# RPG Canvas Studio

Aplicativo desktop local-first para planejar campanhas e escrever sessões de RPG como mapas visuais gigantes.

O núcleo é um canvas WebGL com zoom semântico: de longe aparecem projetos, regiões e sessões; ao aproximar, surgem cenas, falas, decisões, consequências e referências de lore.

## Estado — v1.0.0

- canvas PixiJS com pan, zoom, grade e seleção por área;
- criação rápida de nós com duplo clique;
- movimentação em grupo, edição, duplicação, exclusão e redimensionamento direto;
- conexões direcionadas por arraste e sessões em fluxograma;
- regiões móveis/redimensionáveis, agrupamento hierárquico e nós de referência;
- zoom semântico, culling e `Ver tudo`;
- minimapa navegável;
- busca global com `Ctrl+K`;
- undo/redo e atalhos;
- painel de sessões com progresso, foco, reinício e resumo exportável;
- imagens por arquivo ou link externo HTTPS;
- orçamento inteligente de renderização para mapas extremamente densos;
- biblioteca persistente de templates prontos e personalizados;
- etiquetas pesquisáveis, filtro por tipo e edição em massa;
- visão de roteiro ordenada pelo fluxo, com progresso e impressão/PDF;
- onboarding, central de atalhos, diagnóstico estrutural e recuperação de falhas;
- player MP3 persistente e biblioteca por pastas;
- backend Tauri/SQLite e fallback web para desenvolvimento;
- autosave em lote, sem bloquear o canvas;
- exportação e importação segura no formato `.rpgcanvas`;
- backups automáticos com cópia mais recente e histórico rotativo;
- recuperação pelo backup quando os dados principais não podem ser lidos;
- importação não destrutiva: IDs são recriados quando já existe um projeto igual.
- conexões selecionáveis com edição de texto, tipo, cor e direção;
- menu de clique direito para criar, duplicar, referenciar e excluir elementos.

### Gestos do canvas

- arraste o fundo para selecionar várias caixas;
- use `Shift` para somar caixas à seleção;
- arraste qualquer caixa selecionada para mover o conjunto;
- puxe a alça no canto inferior direito para redimensionar;
- puxe o ponto lateral direito de uma caixa até outra para conectar;
- arraste o título de uma região para mover a região, suas filhas e seus nós;
- segure `Espaço` e arraste para mover a câmera.

### Segurança dos projetos

- use **Exportar** dentro do projeto para criar um arquivo portátil `.rpgcanvas`;
- use **Importar** na tela inicial para abrir uma campanha exportada;
- use **Backups** para recuperar a versão mais recente ou uma cópia histórica;
- o aplicativo mantém até 10 cópias históricas por projeto, com intervalo mínimo de 10 minutos;
- arquivos importados são validados antes de qualquer gravação.

## Rodar a interface

```bash
npm install
npm run dev
```

## Rodar como desktop

Pré-requisitos: Node.js, Rust e dependências nativas do Tauri 2.

```bash
npm install
npm run tauri dev
```

No Windows, também é possível usar `INSTALAR.bat` e depois `ABRIR_DEV.bat`.

## Validar

```bash
npm test
npm run build
```

Para gerar o instalador/`.exe` no Windows, execute `BUILD_WINDOWS.bat`. O resultado fica em `src-tauri\target\release\bundle\`.

Veja [Arquitetura](docs/ARCHITECTURE.md), [schema SQLite](docs/SCHEMA.md), [fases](docs/PHASES.md), [estado da implementação](docs/IMPLEMENTATION_STATUS.md) e [release 1.0](docs/RELEASE_1.0.md).
