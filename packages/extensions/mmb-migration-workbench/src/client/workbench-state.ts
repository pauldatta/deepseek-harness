/**
 * Reactive state store for the Migration Center Workbench UI.
 * @module @deepseek-ai/dsh-mmb-migration-workbench/client/workbench-state
 */

export type WorkbenchTab = 'portfolio' | 'assessment' | 'ingress' | 'skills' | 'recipes'

export interface WorkbenchState {
  readonly isOpen: boolean
  readonly activeTab: WorkbenchTab
  readonly filterDomain?: 'all' | 'migrate' | 'modernize' | 'build'
  readonly searchQuery: string
  readonly selectedAssetId?: string
}

type Listener = (state: WorkbenchState) => void

let currentState: WorkbenchState = {
  isOpen: false,
  activeTab: 'portfolio',
  filterDomain: 'all',
  searchQuery: '',
}

const listeners = new Set<Listener>()

export const workbenchStore = {
  getSnapshot(): WorkbenchState {
    return currentState
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },

  setOpen(isOpen: boolean): void {
    currentState = { ...currentState, isOpen }
    notify()
  },

  toggleOpen(): void {
    currentState = { ...currentState, isOpen: !currentState.isOpen }
    notify()
  },

  setActiveTab(activeTab: WorkbenchTab): void {
    currentState = { ...currentState, activeTab, isOpen: true }
    notify()
  },

  setFilterDomain(filterDomain: 'all' | 'migrate' | 'modernize' | 'build'): void {
    currentState = { ...currentState, filterDomain }
    notify()
  },

  setSearchQuery(searchQuery: string): void {
    currentState = { ...currentState, searchQuery }
    notify()
  },

  selectAsset(assetId: string): void {
    currentState = { ...currentState, selectedAssetId: assetId, activeTab: 'portfolio', isOpen: true }
    notify()
  },
}

function notify(): void {
  for (const listener of listeners) {
    try {
      listener(currentState)
    } catch (e) {
      console.error('[mmb-workbench] listener error:', e)
    }
  }
}
