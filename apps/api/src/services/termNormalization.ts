// Normalização lexical de termos compartilhada pelas consultas do Azy Agent.
//
// Vive em módulo próprio (e não em `assistantKnowledge.ts`) porque o pacote
// curado contém, no próprio texto, caminhos de outros apps: importá-lo a partir
// de um serviço de runtime puxaria esses literais para o bundle da API e
// quebraria o gate `check:api-boundary`. A implementação continua única, usada
// pela busca no pacote curado e pela busca na documentação do produto.
export function normalizeTerms(value: string): string[] {
  return value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9_]+/g) ?? []
}
