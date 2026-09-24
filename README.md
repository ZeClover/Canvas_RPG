# RPG Canvas Studio — v1.2.0

Aplicativo desktop local-first (Windows, Tauri) para organizar campanhas de RPG visualmente em um canvas infinito, ao estilo Miro/Obsidian Canvas/Milanote.

A versão está visível dentro do próprio app, na barra superior, ao lado do nome do projeto (`Canvas principal · v1.2.0`).

## O que mudou na v1.2.0 — polimento do canvas

Depois da correção arquitetural da v1.1.0 (canvas confirmado funcionando), esta versão adiciona recursos de edição pedidos diretamente para o dia a dia de organizar campanhas — sempre local, sem depender de servidor:

- **Guias de alinhamento (snap)** — ao arrastar uma caixa, ela encaixa automaticamente quando uma borda ou o centro se alinha com outra caixa próxima, com uma linha guia azul mostrando o alinhamento.
- **Mover com o teclado** — setas movem a seleção 1px por vez (`Shift+seta` move 10px), para ajustes finos sem o mouse.
- **Alt + arrastar duplica** — segurar Alt e arrastar uma caixa (ou grupo) cria uma cópia no lugar e já continua o arraste com a cópia; o original não se move.
- **Agrupamento leve** (`Ctrl+G` / `Ctrl+Shift+G`) — várias caixas podem ser agrupadas para mover sempre juntas, sem o peso visual de uma região (sem preenchimento, sem cabeçalho, só um contorno tracejado sutil). Clicar em qualquer membro seleciona o grupo inteiro.
- **Exportar como imagem** — botão "Imagem" na barra do canvas gera um PNG do mapa inteiro (não só o que está visível na tela).
- **Modo foco** — botão "Foco" realça toda a cadeia de caixas conectadas à seleção (percorrendo as conexões, não só o vizinho direto) e escurece o resto do mapa.
- **Ícone por tipo de caixa** — cada caixa mostra um pequeno ícone (🎬 cena, 🧑 NPC, ⚔️ combate, etc.), além da cor, para identificar o tipo num relance.
- **Setas diferentes por tipo de conexão** — fluxo é uma seta sólida cheia, condição é uma linha tracejada com ponta em losango, referência é pontilhada com um círculo vazado na ponta — dá para diferenciar o tipo de conexão sem precisar clicar nela.
- **Seletor de cores com paleta** — todas as caixas (que antes não tinham cor editável no inspetor!), regiões e conexões agora usam o mesmo seletor: uma paleta de cores predefinidas + um campo de cor personalizada.

## O que mudou na v1.1.0 — correção arquitetural do canvas

**Causa raiz encontrada:** a versão anterior desenhava o mapa em **três camadas sobrepostas** ao mesmo tempo — um Canvas2D nativo visível (sem eventos), um SVG React visível (sem eventos) e um PixiJS transparente por cima recebendo todos os cliques. Durante um arraste, apenas a camada invisível (PixiJS) se movia; as duas camadas visíveis só eram atualizadas quando o gesto terminava. Por isso as caixas apareciam mas praticamente não podiam ser manipuladas: nada se movia visualmente até soltar o botão do mouse, quando tudo "pulava" de uma vez.

**Correção:** PixiJS e a camada SVG duplicada foram **removidos por completo**. Hoje existe **um único `<canvas>` Canvas2D**, visível e interativo, que é a única fonte de verdade para renderização, coordenadas (`screenToWorld`/`worldToScreen`), seleção, hit-testing, movimento, redimensionamento, zoom, câmera e conexões (`src/canvas/CanvasEngine.ts`). O que a pessoa vê durante qualquer gesto já é a posição real, em tempo real — não existe mais uma camada invisível fora de sincronia com o que aparece na tela.

Veja o detalhe técnico em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

### Lista objetiva do que foi corrigido

- Removida a arquitetura de 3 camadas (Canvas2D nativo + SVG + PixiJS transparente); `pixi.js` foi removido do `package.json`.
- Arrastar uma caixa agora move o desenho em tempo real, não só ao soltar o mouse.
- A área clicável de cada caixa/região/alça é exatamente igual à área desenhada (mesmo cálculo de geometria alimenta desenho e hit-testing).
- Zoom com a roda do mouse ancorado no cursor (o ponto do mundo sob o cursor não se move).
- Pan com botão do meio e com `Espaço + arrastar`.
- Seleção múltipla por `Shift+clique` e por caixa de seleção arrastada no fundo; arrastar a seleção move todas as caixas juntas.
- Alças de redimensionamento visíveis e funcionais em tempo real, para caixas e regiões.
- Alça de conexão visível na caixa selecionada; arrastar até outra caixa cria a conexão, com a linha aparecendo durante o gesto.
- Clicar numa conexão a seleciona (para editar tipo/rótulo/cor ou excluir).
- `Esc` cancela um gesto em andamento (rascunho de conexão, redimensionamento, arraste, caixa de seleção) sem aplicá-lo.
- `fitAll()` (botão "Ver tudo") nunca mais roda contra um viewport `0×0`/`1×1`; espera o `ResizeObserver` reportar um tamanho real (≥100px).
- Redimensionar a janela atualiza o viewport sem resetar a posição da câmera; uma animação de câmera em andamento nunca sobrescreve `viewportWidth`/`viewportHeight` com valores antigos.
- Caixas nunca são escondidas por completo por causa do zoom — em zoom distante elas continuam visíveis, coloridas e clicáveis, só o conteúdo interno (texto secundário, imagem) é simplificado.
- Versão do app visível na barra superior, lida de uma única fonte (`src/version.ts`).
- `BUILD_WINDOWS.bat` agora verifica Node.js, npm, Rust, Cargo, `link.exe`, Visual Studio Build Tools e WebView2 **antes** de iniciar uma build de vários minutos; se o linker estiver ausente, localiza o Visual Studio via `vswhere.exe` e carrega `vcvars64.bat` automaticamente, ou mostra o comando exato de instalação via `winget`.
- Novo `ABRIR.bat` para abrir o executável já compilado sem precisar do modo de desenvolvimento.

Tudo que já funcionava foi preservado: projetos de exemplo, autosave, indicador de salvamento, backups automáticos, recuperação de projeto corrompido, undo/redo, busca `Ctrl+K`, importação/exportação `.rpgcanvas`, templates, referências entre caixas, modo de sessão e progresso, minimapa, player de músicas locais, diagnóstico do projeto e o tema escuro.

## Rodar em desenvolvimento

```bash
npm install
npm run dev
```

Como desktop (Tauri):

```bash
npm install
npm run tauri dev
```

No Windows: `INSTALAR.bat` primeiro, depois `ABRIR_DEV.bat` (modo desenvolvimento) ou `BUILD_WINDOWS.bat` (gera o `.exe`).

## Compilar o executável no Windows

1. Execute `INSTALAR.bat` (verifica Node.js/npm/Rust e instala as dependências).
2. Execute `BUILD_WINDOWS.bat` (verifica o linker/Visual Studio/WebView2 e compila).
3. Execute `ABRIR.bat` para abrir o aplicativo compilado.

### Caminho exato do executável

```
src-tauri\target\release\RPG Canvas Studio.exe                                   (executável portátil)
src-tauri\target\release\bundle\nsis\RPG Canvas Studio_1.2.0_x64-setup.exe       (instalador NSIS)
src-tauri\target\release\bundle\msi\RPG Canvas Studio_1.2.0_x64_en-US.msi        (instalador MSI)
```

Se `link.exe` não for encontrado e o Visual Studio Build Tools não estiver instalado, `BUILD_WINDOWS.bat` para **antes** de iniciar a compilação e mostra:

```
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

## Testes

```bash
npm test           # 58 testes automatizados (Vitest)
npm run build      # TypeScript estrito + build de produção (Vite)
npx playwright install chromium   # uma vez, para baixar o navegador de teste
npm run test:e2e   # teste visual/end-to-end (Playwright)
```

### Resultado dos testes (ambiente de desenvolvimento Linux)

- **58/58 testes unitários e de integração aprovados** (`npm test`), cobrindo:
  câmera/viewport começando em `0×0`/`1×1` e recebendo tamanho real depois; `fitAll()` acionado só após o `ResizeObserver`; importação do arquivo de exemplo `Academia-Magica.rpgcanvas` com a contagem exata de 22 caixas / 9 regiões / 11 conexões; arrastar uma caixa e confirmar a mudança de coordenadas via callback; redimensionar uma caixa; seleção múltipla por caixa de seleção; movimento em grupo; criação de conexão pela alça; seleção de conexão por clique; zoom ancorado no cursor; pan; redimensionar a janela sem perder a posição da câmera; clique no minimapa navegando para o ponto certo; região com elementos filhos se movendo junto (nível de domínio); undo/redo de movimentação (nível de domínio); caixa permanecendo clicável em zoom bem distante (overview); cancelamento de gesto com `Esc`; clicar numa caixa agrupada seleciona e arrasta o grupo inteiro; Alt+arrastar duplica sem mover o original; arrastar perto do alinhamento de outra caixa encaixa a posição; agrupar/desagrupar sem virar região; importação de um arquivo salvo antes de existir agrupamento (compatibilidade retroativa).
- **TypeScript estrito (`tsc -b`) sem erros.**
- **Build de produção (Vite) concluída com sucesso**, bundle sem `pixi.js` (redução de tamanho no chunk principal).
- **Teste visual/end-to-end (Playwright) aprovado**: abre o app, importa `examples/Academia-Magica.rpgcanvas`, clica numa caixa real, arrasta com eventos de ponteiro reais do navegador, tira screenshot antes/depois, confirma que a caixa mudou de posição (com as conexões acompanhando visualmente), espera o autosave, recarrega a página do zero, reabre o projeto pela lista e confirma que a nova posição foi persistida. Screenshots em `test-results/academia-magica-before-drag.png` e `academia-magica-after-drag.png` após rodar `npm run test:e2e`.
- **Build Rust/Tauri para `.exe` não foi compilada neste ambiente** (este é um container Linux; a linkagem final do executável Windows precisa rodar em uma máquina Windows ou CI Windows — é exatamente o que `BUILD_WINDOWS.bat` automatiza, com todas as verificações de pré-requisito).

### Arquivo de exemplo para validação

`examples/Academia-Magica.rpgcanvas` — 22 caixas, 9 regiões (incluindo regiões aninhadas: Ala Norte/Ala Sul dentro de Campus, duas sessões dentro do bloco de Sessões) e 11 conexões, com duas caixas propositalmente sobrepostas (para confirmar que sobreposição não faz o resto do mapa desaparecer). Use **Importar** na tela inicial para abri-lo. Este arquivo também é usado pelo teste Playwright.

> Nota: este é um arquivo gerado para validar o app com a mesma forma descrita (contagens de caixas/regiões/conexões) do arquivo real do autor do projeto, já que o arquivo original `Academia-Magica.rpgcanvas` da máquina do autor não estava disponível neste ambiente de desenvolvimento. A importação, validação de schema, renderização, edição e persistência são as mesmas para qualquer arquivo `.rpgcanvas` — inclusive o original.

## Limitações restantes

- O `.exe` final e os instaladores NSIS/MSI não puderam ser compilados neste ambiente Linux (o Tauri/Cargo precisam do toolchain do Windows). Rode `BUILD_WINDOWS.bat` em uma máquina Windows para gerar o instalador final — o script verifica todos os pré-requisitos antes de começar.
- O teste end-to-end usa o arquivo de exemplo gerado (`examples/Academia-Magica.rpgcanvas`), não o arquivo original do autor, que não estava disponível neste ambiente. Recomenda-se rodar `npm run test:e2e` novamente contra o arquivo `.rpgcanvas` real assim que possível — o fluxo de importação é idêntico.
- Regiões só podem ser selecionadas/arrastadas pela faixa do título (comportamento preservado da versão anterior); clicar no meio de uma região vazia inicia uma seleção de área, não seleciona a região.

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Schema SQLite](docs/SCHEMA.md)
- [Fases do projeto](docs/PHASES.md)
- [Estado da implementação](docs/IMPLEMENTATION_STATUS.md)
