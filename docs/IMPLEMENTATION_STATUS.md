# Estado da implementação — v1.2.0

## Funcional

- projetos locais;
- canvas Canvas2D único (visível e interativo, sem camadas separadas) com pan, zoom e zoom ao redor do cursor;
- duplo clique para criar e escrever uma caixa imediatamente;
- seleção múltipla por Shift ou área, mover em grupo, copiar, colar, duplicar e excluir;
- redimensionamento direto de nós por alça, preservado como uma operação de undo;
- regiões, regiões aninhadas e regiões de sessão com movimento/redimensionamento direto;
- movimento hierárquico de uma região junto com regiões filhas e nós associados;
- fluxogramas com conexões direcionadas por arraste e ramificações;
- imagens redimensionadas para WebP antes de serem salvas;
- imagens externas por URL HTTP/HTTPS;
- referências sincronizadas de NPCs, locais, itens e outros nós;
- zoom semântico, culling, índice espacial e `Ver tudo`;
- limite inteligente de objetos visíveis para impedir travamentos em áreas superdensas;
- minimapa navegável;
- busca global `Ctrl+K` e foco no resultado;
- painel de sessões com progresso, foco no mapa, reinício isolado e resumo Markdown;
- autosave, `Ctrl+S`, undo e redo;
- biblioteca MP3 por pasta/subpasta e player persistente;
- SQLite com WAL, RTree e FTS5 no backend Tauri;
- fallback no navegador usando armazenamento local;
- arquivos de projeto `.rpgcanvas` versionados e validados;
- importação não destrutiva com remapeamento de projetos, regiões, nós, referências e conexões;
- backup automático mais recente e até 10 cópias históricas por projeto;
- restauração manual e recuperação automática quando a fonte principal falha.
- seleção e edição completa de conexões, incluindo direção, tipo, texto e cor;
- menu contextual para caixas, regiões e espaço vazio do canvas.
- templates prontos de NPC, cena e sessão, além de modelos personalizados persistentes;
- etiquetas persistentes, busca filtrada e edição em massa de tipo, cor, destaque e etiquetas;
- roteiro automático da sessão com ramificações, progresso, foco no mapa e impressão/PDF;
- onboarding, atalhos, diagnóstico de integridade, aviso de saída e tela de recuperação;

## Validação realizada

- 33 testes automatizados aprovados;
- teste sintético do índice com 50.000 elementos;
- TypeScript estrito aprovado;
- build Vite de produção aprovado;
- comandos nativos de arquivo e backup revisados; compilação Rust pendente na máquina de destino.

## Validação dependente da máquina de destino

O build desktop completo precisa dos pré-requisitos nativos do Tauri. No Windows, use `INSTALAR.bat` e `BUILD_WINDOWS.bat`. Neste ambiente Linux não estavam disponíveis GTK/WebKit/pkg-config; por isso a linkagem final do executável deve ser feita na máquina Windows de destino ou em CI Windows.
