// Registra o DOM do happy-dom como globais do processo de teste.
//
// Precisa ser importado ANTES de qualquer módulo de Testing Library: o
// `@testing-library/dom` captura `document.body` no momento da avaliação do
// módulo, então o DOM já deve existir quando ele for carregado.
import { GlobalRegistrator } from '@happy-dom/global-registrator'

if (!GlobalRegistrator.isRegistered) {
  GlobalRegistrator.register({ url: 'http://localhost/' })
}
