// [BOOT-TEST] Probe de import do composition root em processo isolado.
// Não chama startServer (não liga listener nem abre conexões de rede); apenas
// carrega o grafo de módulos e confirma que exportou a aplicação.
const indexModule = await import('../index')
if (!indexModule.app) throw new Error('index.ts não exportou app')

// Marcador intencional: o teste de boot compara este texto no stdout.
process.stdout.write('BOOT_IMPORT_OK\n')

export {}
