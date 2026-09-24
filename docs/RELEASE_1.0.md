# RPG Canvas Studio 1.0

## Validado

- 33 testes automatizados aprovados;
- build TypeScript/Vite aprovado;
- importação, exportação e backups cobertos por testes;
- diagnóstico interno de integridade disponível na Central de ajuda;
- recuperação visual para falhas fatais da interface.

## Gerar o aplicativo Windows

1. Execute `INSTALAR.bat` uma vez.
2. Execute `BUILD_WINDOWS.bat`.
3. Abra `src-tauri\target\release\bundle\` para encontrar o instalador.

O executável Windows precisa ser compilado em Windows com Rust e as dependências do Tauri instaladas.
