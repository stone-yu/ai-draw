import {create} from 'zustand'
import {persist} from 'zustand/middleware'
import {v4 as uuidv4} from 'uuid'

export type StorageMode = 'local' | 'cloud'

interface StorageModeState {
  mode: StorageMode
  localUserId: string
  setMode: (mode: StorageMode) => void
}

export const useStorageModeStore = create<StorageModeState>()(
  persist(
    (set) => ({
      mode: 'local', // Default to local mode
      localUserId: uuidv4(), // Generate a unique ID for local user
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'storage-mode',
    }
  )
)

