# RPG World Canvas — v0.10.0 (Fase 7 + extras + Fase 8 + Fase 9)

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
              filtro de views, leitores de campos por tipo (um por tipo especializado), graph.ts (BFS/grau/cadeia
              causal — Mystery Board e Causalidade), rulesEngine.ts (avaliação pura do Rules Engine), modules.ts
              (registro dos módulos opcionais por campanha e o mapa tipo → módulo dono), rumorTemplates.ts
              (montagem determinística de texto por template para o Gerador de rumores), transcriptParser.ts
              (remoção de marcação SRT/VTT e busca por palavra-chave, ambos determinísticos)
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
- 31 tipos de card (30 tipos de conteúdo + grupo), cada um com ícone, cor padrão e tamanho padrão configuráveis;
- 26 tipos de relação, cada um com cor, estilo de traço (sólido/tracejado/pontilhado) e estilo de seta (triângulo/losango/círculo) próprios — dá para diferenciar o tipo de conexão só de olhar, sem clicar;
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

## O que já funciona (Fase 5, conforme pedido)

Cinco seções novas no inspetor mais um gerador global, todos determinísticos:

- **Scene Composer**: seção dedicada para cenas (`kind: "scene"`) — tom/clima, texto para ler em voz alta, detalhes sensoriais e complicações. Quem está presente e onde a cena acontece é expresso pelas relações já existentes ("envolve"/"acontece em"), nunca uma lista paralela.
- **Tema & Foreshadowing**: temas (`kind: "theme"`) guardam motivos recorrentes; presságios (`kind: "foreshadowing"`) têm status (`Plantado`/`Reforçado`/`Pago`/`Abandonado`), a pista plantada, o pagamento pretendido e um histórico anotado manualmente pelo mestre a cada vez que o presságio é reforçado em sessão — mesma disciplina do histórico de eventos do Settlement Engine.
- **Encounter Ecology**: seção dedicada para criaturas (`kind: "creature"`) — habitat, dieta, comportamento, nível de ameaça e tamanho de grupo. Novo tipo de relação `preys_on` ("caça") para montar cadeias de predador/presa como dado de grafo real, reaproveitável por qualquer ferramenta futura que leia relações.
- **Rumor Engine com templates**: seção dedicada para rumores (`kind: "rumor"`) — estado de verdade (só o mestre vê), fonte e como se espalha. O **Gerador de rumores** (novo painel global) monta a frase escolhendo um de seis templates fixos ("Dizem que {npc} foi visto perto de {local}...") e preenchendo cada espaço com um elemento já existente (ou texto livre) — é montagem de string determinística, nunca geração de texto; o botão "Criar rumor no Canvas" cria o card já com o resumo montado.

## Módulos por campanha alcançam todas as Fases 2–9

**Toda** ferramenta especializada — não só a de uma fase específica — é um módulo que cada campanha liga ou desliga em `Ferramentas → Módulos desta campanha`. Ver a seção "Módulos" acima para como isso funciona; o painel lista 28 módulos agrupados por fase (2 a 9). O Multiverse Engine é a única exceção deliberada: ele vive na tela de campanhas, acima de qualquer campanha individual, então nunca aparece nesse painel nem pode ser desligado — não faz sentido "desligar por campanha" uma ferramenta que liga campanhas entre si.

## O que já funciona (Fase 6, conforme pedido)

- **Transcrições**: seção dedicada para transcrições (`kind: "transcript"`) — cole o texto ou importe um arquivo `.txt`/`.srt`/`.vtt` (a importação só remove marcação de legenda — número do bloco, timestamps — nunca reescreve uma palavra da fala). Busca por palavra-chave (substring, sem diferenciar maiúsculas/minúsculas) mostra a contagem e o trecho de contexto de cada ocorrência. Selecionar um trecho no texto libera "Criar elemento no Canvas": escolhe o tipo, confirma o título, e o novo elemento nasce já conectado à transcrição pela relação `surgiu de` — a única "conversão" que essa ferramenta faz, e é sempre um clique deliberado do mestre, nunca automática.
- **Campaign Health Dashboard**: painel global com a contagem de elementos por tipo e uma lista de sinais de atenção recalculados ao vivo — elementos sem nenhuma relação, recursos em estoque crítico, regras desativadas, regras ativas que nunca dispararam, presságios ainda sem pagamento. Nenhum sinal novo: são os mesmos números que Mystery Board/Economia/Rules Engine já calculam, só que reunidos numa tela em vez de cinco.
- **Player Knowledge View**: painel global somente-leitura do que os jogadores sabem oficialmente, construído inteiramente a partir do campo `visibility` que cada elemento já tinha desde a Fase 1 — elementos `revelado` aparecem com resumo completo, `parcial` aparecem só como "existe, mas não em detalhe", e `só o mestre` não aparecem nessa tela. Nenhuma tabela nova: é a mesma visibilidade que já se define no inspetor, lida de um jeito diferente.

## O que já funciona (Fase 7, conforme pedido)

As duas últimas peças do plano original de 7 fases:

- **World Communication System**: novo tipo de card `message` (carta, mensageiro, feitiço de comunicação...) com meio, status de entrega (`Enviada`/`Em trânsito`/`Entregue`/`Interceptada`/`Perdida`) e conteúdo. Quem enviou e quem deveria receber nunca é um campo de texto paralelo — é a mesma relação de sempre (`surgiu de` para o remetente, a nova `endereçada a` para o destinatário), lida direto do grafo. O painel global "Cartas & mensageiros" lista todas as mensagens da campanha com remetente/destinatário resolvidos, e mensagens `Interceptada`/`Perdida` sobem para o topo da lista, destacadas, para o mestre nunca perder uma comunicação que deu errado no meio do caminho.
- **Multiverse Engine**: ligações entre campanhas inteiras (`UniverseLink`, guardado numa store própria do IndexedDB, sem tocar em nenhum dado das campanhas ligadas) — "essa campanha e aquela compartilham cosmologia", "é a mesma linha do tempo em eras diferentes". É deliberadamente um recurso **de nível de tela de campanhas**, não de dentro de uma campanha: abre pelo botão "Multiverso" ao lado de "Backups", nunca aparece na lista de módulos de uma campanha, e apagar uma campanha remove só as ligações que a referenciam, nunca a campanha do outro lado.

## Extras pós-Fase 7

Todas as 7 fases do plano original estavam completas; estes nove itens foram pedidos depois, como polimento sobre o núcleo já pronto — cada um construído em cima do grafo/dado que já existia, sem tabela nova nem conceito paralelo.

- **Modo Foco**: seleciona uma entidade e ativa (botão 🎯 no inspetor) — o resto do Canvas escurece, sobrando só ela e N níveis de conexão (1/2/3, ajustável ao vivo por um badge flutuante). `domain/graph.ts::focusNeighborhood()` reaproveita a mesma busca em largura do Mystery Board; `CanvasEngine` ganha `CanvasRenderState.focusSet`, que substitui a lógica de esmaecimento por seleção quando o modo está ativo.
- **Guias de alinhamento (snap)**: arrastar um card gruda automaticamente quando uma borda ou centro se alinha com outro elemento (~6px de tolerância na tela, independente por eixo X/Y) e desenha uma linha-guia tracejada enquanto isso acontece.
- **Alinhar/Distribuir seleção**: com 2+ elementos selecionados, alinhar por borda/centro (6 modos); com 3+, distribuir espaçamento uniforme (horizontal/vertical) mantendo as duas pontas fixas. `domain/alignment.ts` (puro, testado) calcula as novas posições; `CampaignStore.alignSelected`/`distributeSelected` aplicam via `moveEntities` já existente — uma única entrada de undo.
- **Fit Selection**: `Shift+Home` ou o botão "Enquadrar seleção" na CanvasToolbar enquadra só o que está selecionado, em vez de sempre a campanha inteira. Nova função pura `selectionBounds()` em `domain/spatial.ts`.
- **Exportar imagem PNG**: "Ferramentas → Exportar imagem PNG" exporta a seleção atual (ou a View inteira) reaproveitando o mesmo `paintScene()`/`drawCard()`/`drawRelation()` do Canvas ao vivo, pintado num canvas offscreen a 2x de resolução — não é screenshot de tela, é o mesmo motor de desenho.
- **Busca com ranking e destaque**: `domain/search.ts` ranqueia resultados por nome (que começa com a busca > que só contém) primeiro, depois tag, depois resumo — nome nunca perde para resumo, mesmo quando os dois batem no mesmo elemento. O trecho que casou fica destacado em roxo no Command Palette, e cada resultado mostra por qual campo bateu quando não foi o nome.
- **Favoritos**: estrela no inspetor (entidades) e ao lado do seletor de View — favoritos sobem para o topo do Command Palette quando a busca está vazia (navegando, não buscando) e ganham marca visual; `Campaign.favoriteEntityIds`/`favoriteViewIds`, fora da pilha de undo (mesma lógica de `enabledModules`).
- **Segunda campanha de exemplo**: fresh install agora semeia duas campanhas de gêneros diferentes — "Academia Mágica" (fantasia) e "Estação Kessler" (sci-fi, tripulação de resgate investigando uma estação à deriva) — provando que os tipos de card não são fantasia-específicos e que o sistema de módulos é uma escolha real desde o início (Kessler já nasce com Encounter Ecology e Settlement Engine desligados).
- **Tooltips em todo botão só-ícone**: title+aria-label consistentes em todo botão que só mostra um ícone, em vez de depender só do leitor de tela.

## Fase 8: cinco módulos grandes novos

Pedidos depois dos extras acima, com o mesmo critério: **genéricos para qualquer campanha/sistema**, nunca amarrados a uma regra de D&D ou de qualquer jogo específico, e construídos sobre a mesma `Entity`/`Relation`/módulo por campanha de sempre — nenhum conceito paralelo, nenhuma tabela nova fora do padrão já estabelecido.

- **Combat Tracker**: novo tipo de card `encounter` — lista de combatentes (nome, iniciativa, PV/PV máx., condições), cada um opcionalmente ligado a uma entidade já existente (`npc`/`player`/`creature`) só para navegação rápida, nunca uma segunda fonte de verdade para os dados dela. Ordenação automática por iniciativa, botão "Próximo turno" que avança turno e incrementa rodada ao dar a volta completa, histórico do combate. Painel global "Encontros" lista todos os combates da campanha, com o ativo em destaque.
- **Character Sheet**: nova seção no card de Personagem (`kind: "player"`) — PV/PV máx., nível/patente (texto livre, funciona pra nível numérico, rank ou tier de qualquer sistema) e uma lista de atributos genéricos (rótulo + valor livre, em vez de um stat block fixo). Inventário não duplica dado: usa o mesmo grafo de relações de sempre, através de um novo tipo `carrega`.
- **Faction Engine**: nova seção no card de Facção — objetivo, recursos e standing com o grupo (-100 a 100) em texto/número livre, mais uma lista de "relógios de progresso" no estilo Blades in the Dark (segmentos clicáveis que o mestre preenche à mão para acompanhar planos, cercos ou ameaças em andamento) e um histórico de eventos da facção.
- **Calendar Engine**: `Campaign.calendar` guarda um calendário totalmente customizável (nome da era, lista livre de meses com duração própria) e um dia absoluto que o mestre avança manualmente, com histórico de cada avanço. `domain/calendarFields.ts::resolveCalendarDate()` converte o dia absoluto em ano/mês/dia — pura e total mesmo para um calendário degenerado. Painel global "Calendário" mostra a data atual formatada e deixa configurar tudo.
- **Random Table Engine**: novo tipo de card `table` — lista de entradas com peso, botão "Rolar" com sorteio ponderado por RNG puro (nunca IA, mesma disciplina do Rules Engine) e histórico de rolagens. Painel global "Tabelas" lista todas as tabelas da campanha com um botão "Rolar" inline, pra sortear um nome/loot/rumor no meio da sessão sem abrir o inspetor.

As duas campanhas de exemplo (`seed.ts`) ganharam casos reais de cada módulo: uma jogadora com ficha própria, um encontro com combatentes vinculados a NPCs/criaturas já existentes, relógios de progresso na facção principal, uma tabela sorteável temática e um calendário já avançado com um registro no histórico.

## Fase 9: mais três módulos, e a primeira lição de arquitetura sobre coexistência

Os dois primeiros desta leva ainda são "uma ferramenta especializada por tipo de card". O terceiro é diferente: é a **primeira ferramenta genérica que qualquer card pode ter ao mesmo tempo que sua seção especializada** — e construí-la expôs (e corrigiu) um bug real que vinha desde a Fase 2.

- **Travel & Journey Engine**: novo tipo de card `journey` — uma rota feita de trechos entre locais já existentes (origem, destino, distância em texto livre, dias, concluído), com progresso total sempre **derivado** dos trechos (nunca armazenado), notas de suprimento e de encontros. Nada é simulado: o mestre desenha a rota e marca cada trecho conforme o grupo avança.
- **Modo Apresentação**: botão "Mostrar aos jogadores" (ícone de monitor) no cabeçalho do inspetor de qualquer card, exceto grupo — abre um overlay fullscreen (`Esc` fecha) cujo conteúdo é **derivado inteiramente do campo `visibility`** que todo card já tem desde a Fase 1, a mesma regra do Player Knowledge View: `gm_only` não mostra nada, `parcial` só confirma que existe, `revelado` mostra imagem + título + texto (prioriza o "texto para ler em voz alta" quando o card é uma cena). Nunca uma segunda flag "seguro pra jogador" pra manter sincronizada.
- **Agenda ("onde estão agora")**: `ModuleKey` sem `EntityKind` dono — a primeira seção que aparece em **qualquer** card, lado a lado com a seção especializada do seu tipo (um NPC pode ter Agenda *e* NPC Brain ao mesmo tempo). Cada entrada é um período livre ("Manhãs", "Durante o cerco") + um local vinculado + uma nota; o painel global "Onde estão agora" agrupa todas as entradas de todos os cards por local.

Essa última ferramenta só funciona porque corrigi um bug que ela expôs: quase toda seção especializada salvava reconstruindo o `fields` do card a partir do **próprio leitor** (`onUpdate({ ...readXFields(fields), ...partial })`), o que descarta silenciosamente qualquer chave de uma seção coexistente na próxima vez que aquela seção salvasse algo. Isso nunca se manifestou antes porque, até a Agenda, nenhum card tinha duas seções escrevendo no mesmo `fields` — agora toda seção espalha o `fields` bruto (`{ ...fields, ...partial }`), o mesmo padrão que `NpcSection`/`SessionSection`/`QuestSection` já usavam por acidente desde o início.

## O que ainda não existe

Todas as 7 fases do plano original, os nove extras pós-Fase 7 e os oito módulos das Fases 8–9 foram implementados. O que resta é puramente deferido por escopo (não por dificuldade): auto-layout automático do Canvas, temas além do escuro padrão.

## Rodar como app web (desenvolvimento)

```bash
npm install
npm run dev
```

## Empacotar como aplicativo desktop (Windows)

O mesmo caminho que o RPG Canvas Studio já resolvia — Tauri (`src-tauri/`) — agora existe aqui também. Não é um backend novo: o app inteiro já roda em cima de IndexedDB dentro do WebView, então "empacotar como desktop" é só trocar a aba do navegador por uma janela própria — nenhum dado muda de lugar, nenhum comando Rust novo foi escrito.

Na máquina Windows onde você vai gerar o `.exe` (não dá para compilar Windows a partir deste ambiente Linux):

```bat
INSTALAR.bat        REM confere Node.js e Rust, roda npm install
BUILD_WINDOWS.bat   REM confere linker MSVC e WebView2, roda os testes, compila o .exe e os instaladores
ABRIR.bat           REM abre o .exe já compilado
ABRIR_DEV.bat        REM janela nativa apontando pro Vite em modo dev, pra testar mudanças sem recompilar o Rust
```

Pré-requisitos (o `BUILD_WINDOWS.bat` verifica cada um e explica como instalar o que faltar): Node.js LTS, Rust (`rustup.rs`), Visual Studio Build Tools com o workload "Desktop development with C++" (para o linker `link.exe`), e o WebView2 Runtime (já vem com Windows 10/11 na grande maioria dos casos). O build gera três formas do mesmo aplicativo em `src-tauri/target/release/`: um `.exe` portátil e instaladores `.msi`/NSIS `.exe`.

## Testes

```bash
npm test           # 211 testes automatizados (Vitest) — inclui IndexedDB real via fake-indexeddb
npm run build       # TypeScript estrito + build de produção (Vite)
npx playwright install chromium   # uma vez
npm run test:e2e    # teste visual/end-to-end (Playwright): abre a campanha de exemplo, arrasta um NPC real,
                     # tira screenshot antes/depois, recarrega e confirma que a posição persistiu
```

Cobertura atual: validação/serialização do arquivo de campanha (inclui rejeição de hierarquia circular de grupos e relação órfã, além de leitura defensiva de `enabledModules` ausente ou com chaves desconhecidas em arquivos antigos); `CampaignStore` (criar/mover/desfazer/refazer, mover grupo com descendentes, exclusão em cascata, relação sem duplicar, duplicar preservando agrupamento, troca de view, **regra semeada dispara sozinha ao mudar o status observado e não dispara de novo enquanto o status não muda de novo**, desligar `rules_engine` para a avaliação sem apagar a regra, `setEnabledModules` persiste fora do histórico de undo); `CanvasEngine` (fitAll seguro contra viewport 0×0, resize preservando câmera, arrastar, redimensionar, seleção múltipla, criar relação pela alça, clicar em filho de grupo arrasta o grupo, Alt+arrastar duplica, zoom no cursor, pan, `Esc` cancela); `repository` com IndexedDB real (diff granular não reescreve tudo, backup e restauração, cascata de relações órfãs, **Multiverse Engine**: criar/listar/remover uma `UniverseLink` entre duas campanhas e apagar uma campanha remove só as ligações que a referenciam); filtro de views; leitores de campos por tipo (um por tipo especializado — sempre caem no padrão em vez de quebrar com dado antigo ou malformado, incluindo prosperidade/estabilidade sempre entre 0–100 e progresso/estoque-crítico sempre derivados, nunca armazenados, e a mensagem sempre cai num meio/status válido mesmo com dado velho ou malformado); `graph.ts` (busca em largura com limite de profundidade, contagem de grau, pistas soltas, cadeia causal recursiva à prova de ciclo); `rulesEngine.ts` (dispara só na transição para o valor do gatilho, regra desativada nunca dispara, `create_relation` não duplica uma relação já existente, `mark_important` não mexe no status); `rumorTemplates.ts` (todo template tem ao menos um slot, prévia mostra placeholder para slot vazio, `templateIsComplete` exige todo slot preenchido); `transcriptParser.ts` (detecção de formato pela extensão, remoção de índice/timestamp de SRT/VTT sem alterar a fala, TXT passa intacto, busca por palavra-chave sem diferenciar maiúsculas/minúsculas com trecho de contexto); `modules.ts` (todo módulo do registro tem chave única e reconhecida, todo tipo em `MODULE_FOR_KIND` aponta para um módulo válido, um tipo sem módulo dono está sempre liberado); `alignment.ts` (6 modos de alinhar e 2 eixos de distribuir, sempre preservando as pontas e o eixo intocado); `spatial.ts` (`selectionBounds` retorna null sem seleção, `cameraForBounds` centraliza o centro das bounds exatamente no centro do viewport); `search.ts` (hierarquia de rank nome > tag > resumo mesmo quando os três coincidem no mesmo elemento, acento/maiúscula ignorados, `highlightSegments` preserva o texto original, `sortFavoritesFirst` é um stable sort genérico); `seed.ts` (as duas campanhas de exemplo passam por `validateCampaignData`, nenhuma relação aponta para uma entidade inexistente, os dois seeds nunca colidem em ID, o subconjunto de módulos curado da Estação Kessler); `encounterFields.ts` (ordenação por iniciativa estável em empate, `advanceTurn` cicla e incrementa rodada ao voltar ao início, `turnIndex` sempre grampeado à contagem atual de combatentes); `characterFields.ts` (leitura defensiva de atributos malformados); `factionFields.ts` (`setClockFilled` sempre grampeado a `[0, segments]`, standing sempre grampeado a `[-100, 100]`); `calendarFields.ts` (`resolveCalendarDate` é pura e total mesmo com calendário degenerado, respeita meses de duração desigual, `formatCalendarDate` cai para "Ano N" sem era nomeada); `tableFields.ts` (`rollTable` com RNG injetável escolhe deterministicamente por peso acumulado, nunca sorteia entrada de peso zero, retorna `null` sem entrada sorteável); `journeyFields.ts` (`totalDays`/`daysRemaining`/`legsDone` sempre recalculados a partir dos trechos, nunca armazenados); `presentation.ts` (conteúdo derivado só de `visibility`, cena prioriza o texto de leitura sobre o resumo, título nunca fica vazio); `scheduleFields.ts` (lê só a chave `schedule`, nunca toca em nenhuma outra chave do mesmo fields bag — a prova em teste unitário da correção de merge descrita na Fase 9).

Dentro do próprio `CanvasEngine.test.ts`: snap grudando um card na borda de outro durante um arrasto real simulado por pointer events, `exportPNG()` restaurando a câmera/estado do Canvas ao vivo depois de exportar (cardIndex/entityById/relationsByEntityId reconstruídos e desfeitos, nunca vazando pro frame seguinte).

Validação visual (Playwright, script avulso executado manualmente — não faz parte da suíte permanente): Fase 2 — abrir NPC → editar traços e adicionar conhecimento; abrir quest → editar objetivo/status; abrir sessão → finalizar e conferir o selo; abrir Timeline. Fase 3 — abrir Conhecimento → escolher um segredo → conferir conexões; abrir Mistério → explorar a partir de um elemento; abrir Causalidade → conferir a árvore causal; abrir Regras → conferir a regra semeada; **mudar o status de "A Dungeon" para "Instável" ao vivo no Canvas e confirmar que "O Exercício Perigoso" muda sozinho para "Suspensa"**, sem nenhum clique manual nessa segunda mudança. Fase 4 — abrir a cidade "Vilarejo de Ashgrove" → editar necessidades; abrir o projeto "Restaurar a Ala Leste" → marcar uma etapa e conferir a barra de progresso recalculada; abrir o item "Anel do Vínculo" e o recurso "Rações da Academia"; abrir os painéis "Progresso do mundo" e "Economia & recursos" e conferir os dados agregados. Fase 5 — abrir a criatura, a cena, o tema, o presságio e o rumor semeados, conferindo cada seção; abrir o Gerador de rumores, escolher o template "Fulano foi visto fazendo algo estranho", preencher com NPC + local reais, conferir a prévia montada e **criar o rumor no Canvas, confirmando que o card nasce com o texto exato da prévia como resumo**. Fase 6 — abrir a transcrição semeada, buscar por "runa" e conferir a contagem de ocorrências, selecionar um trecho e **criar um elemento no Canvas a partir da seleção, confirmando a relação "surgiu de" até a transcrição**; abrir a Saúde da campanha e expandir um sinal de atenção; abrir o Player Knowledge View e conferir que um elemento "revelado" mostra o resumo completo e um "parcial" mostra só o selo, sem vazar detalhe. Fase 7 — abrir "Cartas & mensageiros" e conferir que a mensagem `Interceptada` aparece destacada no topo com remetente/destinatário corretos; abrir uma mensagem no inspetor e conferir a seção de Comunicação; na tela de campanhas, com só uma campanha, conferir que o Multiverso avisa que faltam campanhas para ligar; criar uma segunda campanha e **ligá-la à primeira pelo Multiverso, conferindo que a ligação aparece na lista com os dois títulos resolvidos, e depois removê-la**. Módulos — desligar `npc_brain` e confirmar que a seção some do card e volta ao religar com os mesmos dados; desligar `rules_engine` e confirmar que "Regras" some do menu Ferramentas; desligar `world_communication` e confirmar que "Cartas & mensageiros" some do menu Ferramentas sem apagar as mensagens já criadas. Extras — ativar o Modo Foco e conferir o esmaecimento + a linha-guia de snap ao arrastar um card perto de outro; selecionar três NPCs e usar Alinhar + Distribuir + Enquadrar seleção; exportar a campanha como PNG e conferir a assinatura do arquivo e o conteúdo renderizado; buscar por um trecho que só existe no resumo de um NPC e conferir o destaque e o selo "por resumo"; favoritar uma entidade e uma View e conferir que sobem para o topo do Command Palette e do seletor de Views; abrir a Estação Kessler pela primeira vez e conferir que Encounter Ecology/Settlement Engine já nascem desligados. Fase 8 — abrir o encontro semeado "Emboscada na Dungeon", conferir a ordenação por iniciativa e que "Próximo turno" troca o combatente em destaque; criar uma jogadora e conferir a Character Sheet, adicionar um atributo e confirmar que "carrega" aparece no seletor de relação; abrir a facção "Ordem dos Selos" e conferir o relógio de progresso já com segmentos preenchidos, clicar num segmento e ver o contador atualizar; abrir o Calendário e avançar alguns dias, conferindo que a data formatada muda corretamente pro mês seguinte; criar uma tabela, adicionar uma entrada e rolar tanto pelo inspetor quanto pelo painel "Tabelas", conferindo que o resultado persiste no histórico dos dois lugares. Fase 9 — criar uma viagem, adicionar um trecho entre dois locais reais e marcá-lo concluído, conferindo o progresso recalculado; abrir um elemento revelado e clicar "Mostrar aos jogadores", conferindo o overlay fullscreen, depois repetir com um elemento `gm_only` e confirmar que nada aparece; abrir um NPC já com dados de NPC Brain, adicionar uma entrada de Agenda, editar em seguida um campo da seção de NPC (ex.: Idade), fechar e reabrir o card, e **confirmar que tanto a mudança do NPC Brain quanto a entrada de Agenda sobreviveram juntas** — a prova visual da correção de merge; abrir o painel "Onde estão agora" e conferir que a entrada aparece agrupada sob o local certo.

## Limitações desta entrega

- O empacotamento Windows (`src-tauri/` + `BUILD_WINDOWS.bat`) foi validado até onde este ambiente permite: o Cargo.toml resolve e a árvore de dependências do Tauri compila normalmente (confirmado com `cargo check`), mas o link final só roda numa máquina Windows de verdade com o MSVC Build Tools — este ambiente é Linux e não tem as bibliotecas gráficas nem o linker do Windows. O ícone do app (`src-tauri/icons/`) já foi gerado a partir de `app-icon.svg`.
- IndexedDB, não SQLite — decisão deliberada para a Fase 1 (zero dependência nativa, 100% local, interface pronta para trocar depois). Isso vale também dentro do `.exe`: o WebView nativo (WebView2 no Windows) já tem IndexedDB embutido, então nenhum dado muda de lugar ao empacotar.
- Criar um elemento por duplo clique sempre cria um NPC por padrão (não há como perguntar "qual tipo?" num duplo clique); use o seletor de tipo na barra de ferramentas do canvas para os outros 29 tipos.
