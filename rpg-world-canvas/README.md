# RPG World Canvas — v0.2.0 (Fase 2)

Um motor visual de campanhas de RPG de mesa: NPCs, quests, locais, facções, segredos, sessões e tudo mais vivem como o **mesmo dado**, visto de formas diferentes (Canvas, Views, busca). Não é um VTT, não é uma wiki, não é um gerenciador de projeto — é uma memória visual e interativa do universo.

Este é um **projeto novo**, código-fonte independente do RPG Canvas Studio (pasta raiz deste repositório). Nenhuma UI ou lógica foi reaproveitada — só as lições de arquitetura aprendidas da forma mais difícil.

## Regra fundamental

**Nenhuma funcionalidade depende de IA.** Tudo é banco de dados local, grafo, filtros e regras determinísticas. O programa nunca inventa o cânone — ele organiza, conecta, lembra e analisa estrutura. Quem decide o que aconteceu é você.

## Decisão arquitetural central: um único dado, várias lentes

Todo elemento do RPG — NPC, quest, side quest, evento, local, cidade, região, facção, criatura, item, segredo, conhecimento, pista, rumor, decisão, possibilidade, cena, projeto, recurso, tema, foreshadowing, transcrição, universo — é uma linha na **mesma tabela `entities`**, diferenciada só pelo campo `kind`. Conexões com significado (`conhece`, `odeia`, `trabalha para`, `revela`, `causou`, `aponta para`...) são linhas reais na tabela `relations`, com tipo, rótulo, descrição, importância e histórico — nunca apenas uma linha visual.

Um **grupo visual** (a "área" onde você arrasta a FAMÍLIA KAMAU ou a SESSÃO 14) também é uma `Entity`, só que de `kind: "group"` — a mesma tabela, o mesmo sistema de busca, a mesma persistência. Isso é o que a pergunta do usuário pedia: "não quero informação duplicada."

Uma **View** nunca duplica dados — ela só guarda um filtro (`kinds`, `tags`, `groupIds`, `status`, `search`) e decide o que aparece. "NPCs", "Quests", "Mistérios" já vêm prontas; criar uma view nova é só salvar outro filtro.

```
src/
  domain/     tipos, registro de tipos de card, registro de tipos de relação, câmera/espaço, índice espacial, orçamento de renderização, filtro de views
  data/       IndexedDB (banco 100% local), arquivo de campanha (.rpgworld) com validação estrita, seed/demo
  state/      CampaignStore — única fonte de verdade reativa (undo/redo, autosave granular)
  canvas/     CanvasEngine — um único <canvas> visível e interativo (ver abaixo)
  components/ Topbar, toolbar, inspetor genérico, busca (Ctrl+K), minimapa, tela de campanhas
```

## O Canvas é a interface principal — não decoração

O `CanvasEngine` é a mesma arquitetura de fonte única que corrigiu o RPG Canvas Studio: **um único `<canvas>` Canvas2D, visível e interativo**. O que você vê é exatamente o que recebe cliques — sem uma camada invisível separada da camada visível para desalinhar durante um gesto. Hit-testing usa a mesma geometria que o desenho.

Funciona hoje:
- clicar seleciona; arrastar move em tempo real (elemento único ou seleção múltipla);
- redimensionar por alça; criar conexão puxando o ponto lateral;
- `Shift+clique` soma à seleção; arrastar no fundo cria caixa de seleção;
- **Alt+arrastar duplica** um elemento (ou grupo) sem mover o original;
- grupos: clicar em um filho seleciona o grupo inteiro; arrastar o cabeçalho do grupo move todos os descendentes e filhos junto;
- zoom ancorado no cursor; pan com botão do meio ou `Espaço+arrastar`; minimapa clicável;
- `Ctrl+Z`/`Ctrl+Shift+Z` undo/redo; `Ctrl+D` duplica seleção; setas movem 1px (`Shift`=10px); `Delete` exclui; `Esc` cancela o gesto em andamento;
- LOD por zoom, índice espacial em grade e orçamento de renderização (máx. 1400 elementos desenhados por vez, priorizando "destacados" e mais próximos do centro) — pensado desde o início para não travar com milhares de elementos.

## Banco de dados

100% local, sem servidor: **IndexedDB**, atrás de uma interface de repositório estreita (`get`/`getAll`/`getAllByIndex`/`put`/`delete`) — pensada para que um backend Tauri+SQLite possa implementar a mesma forma depois, sem a UI perceber a troca. Cada entidade e cada relação tem `id` próprio, gerado sem depender do nome — renomear qualquer coisa nunca quebra uma relação.

O autosave persiste **só o que mudou** (diff granular calculado pelo `CampaignStore` comparando referências de objeto antes/depois de cada commit, incluindo undo/redo), não a campanha inteira a cada gesto — importante para campanhas com milhares de elementos.

Exclusão em cascata: apagar um elemento remove as relações que o tocam; apagar um grupo reconecta os filhos ao grupo pai (nunca apaga em cascata silenciosamente). Isso é garantido tanto no `CampaignStore` (em memória) quanto no `repository.ts` (na escrita — IndexedDB não tem chave estrangeira, então a camada de persistência também garante que nenhuma relação órfã sobrevive).

## O que já funciona (Fase 1, conforme pedido)

- criação de campanhas (nível 1: "Visão Geral dos RPGs"), com projeto de exemplo semeado automaticamente no primeiro uso;
- Canvas funcional com todas as interações acima;
- 26 tipos de card (25 tipos de conteúdo + grupo), cada um com ícone, cor padrão e tamanho padrão configuráveis;
- 21 tipos de relação, cada um com cor, estilo de traço (sólido/tracejado/pontilhado) e estilo de seta (triângulo/losango/círculo) próprios — dá para diferenciar o tipo de conexão só de olhar, sem clicar;
- grupos visuais aninhados;
- views (filtros salvos) — "Visão Geral", "NPCs", "Quests", "Facções", "Locais", "Mistérios" por padrão;
- busca global `Ctrl+K`;
- autosave granular, indicador de salvamento;
- backups automáticos (mais recente + histórico rotativo) e recuperação;
- exportar/importar campanha como arquivo único `.rpgworld`, com importação não destrutiva (recria IDs se já existe uma campanha igual);
- undo/redo.

## O que já funciona (Fase 2, conforme pedido)

- **NPC Brain**: painel dedicado no inspetor de NPC — identidade (idade, raça, profissão, organização, localização atual), personalidade (traços, comportamentos, valores, medos, desejos, objetivos, limites, hábitos — cada campo editável como lista curta), conhecimento (o que o NPC sabe, com estado `sabe`/`suspeita`/`nega`/`esconde`, badges coloridos) e possibilidades futuras (ideias soltas para o NPC evoluir, sem comprometer nada);
- **Quest Studio**: painel dedicado para quest/side quest — status (`Não iniciada`/`Ativa`/`Concluída`/`Falhou`/`Abandonada`), motivação, objetivo principal, objetivos secundários e ocultos (checáveis, adicionáveis em linha), condições de início, prazo, relógio de tensão (rótulo + progresso atual/máximo), recompensas, consequências e resoluções — mais dois tipos de relação novos (`unlocks_on_success`/`unlocks_on_fail`) para ramificar quests visualmente no Canvas (losango verde = desbloqueia se concluir, losango vermelho tracejado = desbloqueia se falhar);
- **Session System**: painel dedicado para sessão — número, data, duração, desenvolvimento, notas, consequências, recursos usados, transcrição colável, e a ação **"Finalizar sessão"** (marca `finalizedAt`, mostra selo de sessão encerrada, trava os campos);
- **Timeline**: painel global (`Timeline` na topbar) que agrega eventos e sessões, ordenados por data, com filtro de texto e checkboxes para mostrar/esconder cada tipo — clicar num item foca o elemento correspondente no Canvas;
- estatísticas numéricas opcionais (confiança/respeito/medo/dívida/conflito) em relações NPC↔NPC, editáveis direto no inspetor de relação, nunca obrigatórias.

## O que ainda não existe (fases seguintes, por design)

Seguindo exatamente a ordem de fases pedida — não implementado de forma superficial, simplesmente ainda não começado:

- **Fase 3** — Knowledge Engine, Mystery/Conspiracy Board com análise de grafo, Butterfly Effect/Causalidade, Rules Engine visual.
- **Fase 4** — World Progression/Settlement Engine, Project Engine, Economy Engine, Resource Engine.
- **Fase 5** — Scene Composer, Foreshadowing Engine, Ecology Engine, Rumor Engine com templates.
- **Fase 6** — Importação de transcrições, Campaign Health Dashboard, Player Knowledge View (o campo `visibility` em cada elemento já existe para isso, só falta a tela).
- **Fase 7** — Multiverse Engine completo (o formato `UniverseLink` já existe no schema), World Communication System.

Também deferido por escopo (não por dificuldade — já resolvido no RPG Canvas Studio e portável quando quiser): guias de alinhamento (snap), modo foco, exportar imagem PNG, empacotamento como `.exe` desktop via Tauri.

## Rodar

```bash
npm install
npm run dev
```

## Testes

```bash
npm test           # 45 testes automatizados (Vitest) — inclui IndexedDB real via fake-indexeddb
npm run build       # TypeScript estrito + build de produção (Vite)
npx playwright install chromium   # uma vez
npm run test:e2e    # teste visual/end-to-end (Playwright): abre a campanha de exemplo, arrasta um NPC real,
                     # tira screenshot antes/depois, recarrega e confirma que a posição persistiu
```

Cobertura atual: validação/serialização do arquivo de campanha (inclui rejeição de hierarquia circular de grupos e relação órfã); `CampaignStore` (criar/mover/desfazer/refazer, mover grupo com descendentes, exclusão em cascata, relação sem duplicar, duplicar preservando agrupamento, troca de view); `CanvasEngine` (fitAll seguro contra viewport 0×0, resize preservando câmera, arrastar, redimensionar, seleção múltipla, criar relação pela alça, clicar em filho de grupo arrasta o grupo, Alt+arrastar duplica, zoom no cursor, pan, `Esc` cancela); `repository` com IndexedDB real (diff granular não reescreve tudo, backup e restauração, cascata de relações órfãs); filtro de views; leitores de campos por tipo (NPC/Quest/Sessão/Evento/estatísticas de relação — sempre caem no padrão em vez de quebrar com dado antigo ou malformado).

Validação visual (Playwright, script avulso executado manualmente — não faz parte da suíte permanente): abrir NPC → editar traços e adicionar conhecimento; abrir quest → editar objetivo/status; abrir sessão → finalizar e conferir o selo; abrir Timeline e conferir a lista agregada.

## Limitações desta entrega

- Não empacotado como aplicativo desktop `.exe` ainda — roda como app web (Vite) local. O RPG Canvas Studio já tem esse caminho todo resolvido (Tauri + `BUILD_WINDOWS.bat`); portar é mecânico quando as Fases 2+ estiverem mais maduras.
- IndexedDB, não SQLite — decisão deliberada para a Fase 1 (zero dependência nativa, 100% local, interface pronta para trocar depois).
- Criar um elemento por duplo clique sempre cria um NPC por padrão (não há como perguntar "qual tipo?" num duplo clique); use o seletor de tipo na barra de ferramentas do canvas para os outros 24 tipos.
