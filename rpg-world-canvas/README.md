# RPG World Canvas — v0.4.1 (Fase 4 + módulos por campanha)

Um motor visual de campanhas de RPG de mesa: NPCs, quests, locais, facções, segredos, sessões e tudo mais vivem como o **mesmo dado**, visto de formas diferentes (Canvas, Views, busca). Não é um VTT, não é uma wiki, não é um gerenciador de projeto — é uma memória visual e interativa do universo.

Este é um **projeto novo**, código-fonte independente do RPG Canvas Studio (pasta raiz deste repositório). Nenhuma UI ou lógica foi reaproveitada — só as lições de arquitetura aprendidas da forma mais difícil.

## Regra fundamental

**Nenhuma funcionalidade depende de IA.** Tudo é banco de dados local, grafo, filtros e regras determinísticas. O programa nunca inventa o cânone — ele organiza, conecta, lembra e analisa estrutura. Quem decide o que aconteceu é você.

## Decisão arquitetural central: um único dado, várias lentes

Todo elemento do RPG — NPC, quest, side quest, evento, local, cidade, região, facção, criatura, item, segredo, conhecimento, pista, rumor, decisão, possibilidade, cena, projeto, recurso, tema, foreshadowing, transcrição, universo — é uma linha na **mesma tabela `entities`**, diferenciada só pelo campo `kind`. Conexões com significado (`conhece`, `odeia`, `trabalha para`, `revela`, `causou`, `aponta para`...) são linhas reais na tabela `relations`, com tipo, rótulo, descrição, importância e histórico — nunca apenas uma linha visual.

Um **grupo visual** (a "área" onde você arrasta a FAMÍLIA KAMAU ou a SESSÃO 14) também é uma `Entity`, só que de `kind: "group"` — a mesma tabela, o mesmo sistema de busca, a mesma persistência. Isso é o que a pergunta do usuário pedia: "não quero informação duplicada."

Uma **View** nunca duplica dados — ela só guarda um filtro (`kinds`, `tags`, `groupIds`, `status`, `search`) e decide o que aparece. "NPCs", "Quests", "Mistérios" já vêm prontas; criar uma view nova é só salvar outro filtro.

## Módulos: cada campanha liga só o que quer usar

A partir da Fase 2, toda ferramenta especializada (NPC Brain, Quest Studio, Mystery Board, Rules Engine, Settlement Engine...) é um **módulo opcional por campanha** — uma campanha de mistério de uma sessão só pode querer Mystery Board + Causalidade, sem nada de economia ou progresso de assentamento; uma sandbox longa pode querer o oposto. `Campaign.enabledModules` guarda a lista; `Ferramentas → Módulos desta campanha` liga/desliga a qualquer momento.

Desligar um módulo nunca apaga nada: ele só esconde a seção especializada daquele tipo de card no inspetor (ex.: `NpcSection` some se `npc_brain` estiver desligado) e o item correspondente no menu Ferramentas. O tipo de elemento em si (`npc`, `city`, `rule`...) continua existindo como um card normal — título, resumo, etiquetas, relações — porque a arquitetura é "um dado, várias lentes": um módulo é só mais uma lente, não uma tabela separada. Religar o módulo faz a seção reaparecer com exatamente os mesmos dados. A única exceção com efeito colateral real é o `rules_engine`: desligado, o `CampaignStore` também para de avaliar as regras da campanha (nenhuma automação roda escondida).

```
src/
  domain/     tipos, registro de tipos de card/relação, câmera/espaço, índice espacial, orçamento de renderização,
              filtro de views, leitores de campos por tipo (NPC/Quest/Sessão/Evento/Regra), graph.ts (BFS/grau/
              cadeia causal — Mystery Board e Causalidade), rulesEngine.ts (avaliação pura do Rules Engine),
              modules.ts (registro dos módulos opcionais por campanha e o mapa tipo → módulo dono)
  data/       IndexedDB (banco 100% local), arquivo de campanha (.rpgworld) com validação estrita, seed/demo
  state/      CampaignStore — única fonte de verdade reativa (undo/redo, autosave granular, avalia as regras)
  canvas/     CanvasEngine — um único <canvas> visível e interativo (ver abaixo)
  components/ Topbar (com o menu Ferramentas), toolbar, inspetor genérico + seções por tipo, busca (Ctrl+K),
              minimapa, tela de campanhas, painéis globais (Timeline/Conhecimento/Mistério/Causalidade/Regras)
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
- 27 tipos de card (26 tipos de conteúdo + grupo), cada um com ícone, cor padrão e tamanho padrão configuráveis;
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

## O que já funciona (Fase 3, conforme pedido)

Todas as quatro ferramentas abaixo são **apenas leituras diferentes das mesmas `entities`/`relations`** — nenhuma tabela paralela, nenhuma IA, tudo recalculado ao vivo a partir do grafo que você já desenhou no Canvas. Ficam agrupadas atrás de um único botão **Ferramentas** na topbar (em vez de um botão por ferramenta) para não lotar a barra conforme novas fases adicionam mais:

- **Knowledge Engine**: escolha um segredo/pista/rumor/conhecimento e veja tudo que está conectado a ele (quem sabe, o que revela, de onde surgiu) — é a mesma tabela `relations` que você edita no inspetor, só que lida de trás para frente;
- **Mystery/Conspiracy Board**: "mais conectados" (ranking por grau, sem inferência — só contagem de relações), "pistas soltas" (segredos/pistas/rumores sem nenhuma conexão ainda) e um explorador de vizinhança (escolha um elemento e uma profundidade, veja tudo dentro de N passos via busca em largura);
- **Butterfly Effect / Causalidade**: escolha uma decisão/evento/quest e veja a árvore completa — o que levou a isso e o que isso causou — seguindo as relações `causou`/`leva a`/`desbloqueia se…`, recursivo e à prova de ciclo;
- **Rules Engine**: automação 100% determinística — "quando `<entidade>` chega ao status `<valor>`, então mude o status de `<entidade alvo>` / marque como importante / crie uma relação". Uma regra é uma `Entity` como qualquer outra (`kind: "rule"`), editada no mesmo inspetor de sempre; o `CampaignStore` avalia todas as regras a cada mudança, em passes limitados (no máximo 5) para permitir uma regra disparar outra (efeito cascata) sem nunca poder entrar em loop infinito. Cada disparo fica registrado no histórico da própria regra.

## O que já funciona (Fase 4, conforme pedido)

Quatro seções novas no inspetor (uma por tipo de card) mais dois painéis globais, todos determinísticos — nenhum número é simulado ou inferido, tudo é o que o mestre digitou:

- **World Progression / Settlement Engine**: seção dedicada para cidades (`kind: "city"`) — estágio de crescimento (Acampamento → Metrópole → Em ruínas…), população, prosperidade e estabilidade (0–100), governança, defesas, necessidades e um histórico de eventos que o mestre anota manualmente após cada sessão (nunca gerado sozinho). O painel global **Progresso do mundo** lista todas as cidades ordenadas por prosperidade ou estabilidade.
- **Project Engine**: seção dedicada para projetos (`kind: "project"`) — objetivo, etapas marcáveis (reaproveitando o mesmo editor de checklist da Quest Studio), prazo, bloqueios e notas. O progresso (`X/Y · Z%`) é sempre **derivado** das etapas marcadas, nunca armazenado — não tem como ficar dessincronizado.
- **Economy Engine**: seção dedicada para itens (`kind: "item"`) — preço, moeda e raridade. O painel global **Economia & recursos** lista todos os itens ordenados por preço, com a média calculada ao vivo.
- **Resource & Survival Engine**: seção dedicada para recursos (`kind: "resource"`) — estoque, unidade, limite crítico e nota de reposição/consumo. "Crítico" também é sempre derivado (estoque ≤ limite), nunca armazenado; o mesmo painel **Economia & recursos** lista os recursos com os críticos destacados em vermelho e ordenados primeiro.

A topbar não ganhou botões novos — os dois painéis desta fase entraram no mesmo menu **Ferramentas** da Fase 3, que já foi desenhado para crescer sem estourar a barra.

## O que ainda não existe (fases seguintes, por design)

Seguindo exatamente a ordem de fases pedida — não implementado de forma superficial, simplesmente ainda não começado:

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
npm test           # 81 testes automatizados (Vitest) — inclui IndexedDB real via fake-indexeddb
npm run build       # TypeScript estrito + build de produção (Vite)
npx playwright install chromium   # uma vez
npm run test:e2e    # teste visual/end-to-end (Playwright): abre a campanha de exemplo, arrasta um NPC real,
                     # tira screenshot antes/depois, recarrega e confirma que a posição persistiu
```

Cobertura atual: validação/serialização do arquivo de campanha (inclui rejeição de hierarquia circular de grupos e relação órfã); `CampaignStore` (criar/mover/desfazer/refazer, mover grupo com descendentes, exclusão em cascata, relação sem duplicar, duplicar preservando agrupamento, troca de view, **regra semeada dispara sozinha ao mudar o status observado e não dispara de novo enquanto o status não muda de novo**); `CanvasEngine` (fitAll seguro contra viewport 0×0, resize preservando câmera, arrastar, redimensionar, seleção múltipla, criar relação pela alça, clicar em filho de grupo arrasta o grupo, Alt+arrastar duplica, zoom no cursor, pan, `Esc` cancela); `repository` com IndexedDB real (diff granular não reescreve tudo, backup e restauração, cascata de relações órfãs); filtro de views; leitores de campos por tipo (NPC/Quest/Sessão/Evento/Regra/Assentamento/Projeto/Economia/Recurso/estatísticas de relação — sempre caem no padrão em vez de quebrar com dado antigo ou malformado, incluindo prosperidade/estabilidade sempre entre 0–100 e progresso/estoque-crítico sempre derivados, nunca armazenados); `graph.ts` (busca em largura com limite de profundidade, contagem de grau, pistas soltas, cadeia causal recursiva à prova de ciclo); `rulesEngine.ts` (dispara só na transição para o valor do gatilho, regra desativada nunca dispara, `create_relation` não duplica uma relação já existente, `mark_important` não mexe no status).

Validação visual (Playwright, script avulso executado manualmente — não faz parte da suíte permanente): Fase 2 — abrir NPC → editar traços e adicionar conhecimento; abrir quest → editar objetivo/status; abrir sessão → finalizar e conferir o selo; abrir Timeline. Fase 3 — abrir Conhecimento → escolher um segredo → conferir conexões; abrir Mistério → explorar a partir de um elemento; abrir Causalidade → conferir a árvore causal; abrir Regras → conferir a regra semeada; **mudar o status de "A Dungeon" para "Instável" ao vivo no Canvas e confirmar que "O Exercício Perigoso" muda sozinho para "Suspensa"**, sem nenhum clique manual nessa segunda mudança. Fase 4 — abrir a cidade "Vilarejo de Ashgrove" → editar necessidades; abrir o projeto "Restaurar a Ala Leste" → marcar uma etapa e conferir a barra de progresso recalculada; abrir o item "Anel do Vínculo" e o recurso "Rações da Academia"; abrir os painéis "Progresso do mundo" e "Economia & recursos" e conferir os dados agregados.

## Limitações desta entrega

- Não empacotado como aplicativo desktop `.exe` ainda — roda como app web (Vite) local. O RPG Canvas Studio já tem esse caminho todo resolvido (Tauri + `BUILD_WINDOWS.bat`); portar é mecânico quando as Fases 2+ estiverem mais maduras.
- IndexedDB, não SQLite — decisão deliberada para a Fase 1 (zero dependência nativa, 100% local, interface pronta para trocar depois).
- Criar um elemento por duplo clique sempre cria um NPC por padrão (não há como perguntar "qual tipo?" num duplo clique); use o seletor de tipo na barra de ferramentas do canvas para os outros 24 tipos.
