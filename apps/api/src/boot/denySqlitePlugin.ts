// [BOOT-TEST] Preload que reprova qualquer resolução de `bun:sqlite` no grafo
// de módulos carregado. Usado para provar que o boot ADVANCED não abre o driver
// SQLite — nem por import transitivo. Carregado via `bun --preload`.
Bun.plugin({
  name: 'deny-sqlite',
  setup(build) {
    build.onResolve({ filter: /^bun:sqlite$/ }, () => {
      throw new Error('SQLITE_DRIVER_ACCESSED: o grafo ADVANCED tentou importar bun:sqlite.')
    })
  },
})
