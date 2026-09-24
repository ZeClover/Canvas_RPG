# Schema SQLite

O schema executável está em `src-tauri/migrations/001_initial.sql`.

## Entidades principais

| Tabela | Finalidade |
| --- | --- |
| `projects` | campanhas/projetos |
| `regions` | regiões aninhadas e sessões |
| `nodes` | caixas, imagens e referências |
| `node_spatial` | índice RTree dos limites dos nós |
| `connections` | setas e relações |
| `session_progress` | caminho ativo percorrido |
| `assets` | imagens externas e miniaturas |
| `music_folders` | raízes locais de músicas |
| `music_tracks` | catálogo MP3 indexado |
| `settings` | preferências locais |
| `change_log` | base para recuperação e diagnóstico |

FTS5 indexa título e corpo dos nós. Triggers mantêm FTS e RTree sincronizados.

