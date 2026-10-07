// Regras de coerência dos filtros do board.
//
// Quando um catálogo (versões/sprints/centros de custo) termina de carregar, um
// filtro selecionado que não existe mais é limpo. O board simples também não
// usa filtro por módulo. Mantém os filtros por projeto íntegros sem espalhar a
// regra pela composição da tela.
import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { isEmptyFilterValue } from '@azy-board/ui-contracts'
import type { BoardFilterState } from '../../../components/BoardFilters'
import type { CostCenter, ProjectVersion } from '../../../components/ItemModal'
import type { Sprint } from '../model/types'

export interface BoardFilterValidationOptions {
  filters: BoardFilterState
  setFilters: Dispatch<SetStateAction<BoardFilterState>>
  isSimpleBoard: boolean
  versionsLoaded: boolean
  projectVersions: ProjectVersion[]
  sprints: Sprint[]
  costCentersLoaded: boolean
  projectCostCenters: CostCenter[]
}

export function useBoardFilterValidation(options: BoardFilterValidationOptions) {
  const {
    filters, setFilters, isSimpleBoard, versionsLoaded, projectVersions,
    sprints, costCentersLoaded, projectCostCenters,
  } = options

  useEffect(() => {
    if (versionsLoaded && filters.versionId && !isEmptyFilterValue(filters.versionId) && !projectVersions.some(version => version.id === filters.versionId)) {
      setFilters(previous => ({ ...previous, versionId: '' }))
    }
  }, [filters.versionId, projectVersions, versionsLoaded, setFilters])

  useEffect(() => {
    if (filters.sprintId && !isEmptyFilterValue(filters.sprintId) && sprints.length > 0 && !sprints.some(sprint => sprint.id === filters.sprintId)) {
      setFilters(previous => ({ ...previous, sprintId: '' }))
    }
  }, [filters.sprintId, sprints, setFilters])

  useEffect(() => {
    if (costCentersLoaded && filters.costCenterId && !isEmptyFilterValue(filters.costCenterId) && !projectCostCenters.some(center => center.id === filters.costCenterId)) {
      setFilters(previous => ({ ...previous, costCenterId: '' }))
    }
  }, [filters.costCenterId, projectCostCenters, costCentersLoaded, setFilters])

  useEffect(() => {
    if (isSimpleBoard && filters.moduleId) {
      setFilters(previous => ({ ...previous, moduleId: '' }))
    }
  }, [isSimpleBoard, filters.moduleId, setFilters])
}
