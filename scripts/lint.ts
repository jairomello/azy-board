const result = await Bun.$`bun run typecheck`.nothrow().quiet()
if (result.exitCode !== 0) throw new Error(result.stderr.toString())
console.log('Lint estático local concluído via TypeScript')
