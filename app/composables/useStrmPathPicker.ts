/**
 * STRM 输出路径选择（飞牛授权目录）
 */
import { clientLog } from '~/utils/client_log'

export interface StrmPathMessage {
  message: Ref<string>
  messageType: Ref<'success' | 'warning' | 'error'>
}

export function useStrmPathPicker(ui: StrmPathMessage) {
  const strmAccessiblePaths = ref<string[]>([])
  const showStrmPathPicker = ref(false)
  const strmPickerBreadcrumbs = ref<{ name: string; path: string }[]>([])
  const strmPickerDirs = ref<string[]>([])
  const strmPickerLoading = ref(false)
  const strmPickerCurrentPath = ref('')

  function pathBasename(p: string): string {
    return p.split(/[\\/]/).filter(Boolean).pop() || p
  }

  async function loadStrmAccessiblePaths(showFeedback = false) {
    try {
      const res = await $fetch<{ success?: boolean; data?: { paths?: string[] } }>('/api/strm/accessible-paths')
      if (res?.success && res.data) {
        strmAccessiblePaths.value = res.data.paths || []
      } else {
        strmAccessiblePaths.value = []
      }
      if (showFeedback) {
        const n = strmAccessiblePaths.value.length
        if (n > 0) {
          ui.message.value = `已刷新授权目录（${n} 个），无需重启应用`
          ui.messageType.value = 'success'
        } else {
          ui.message.value = '未检测到授权目录，请先在飞牛「应用设置」中授权存储目录后再刷新'
          ui.messageType.value = 'error'
        }
      }
    } catch (e: unknown) {
      clientLog.error('strm-path-picker', '加载授权目录失败:', e)
      strmAccessiblePaths.value = []
      if (showFeedback) {
        ui.message.value = '刷新授权目录失败'
        ui.messageType.value = 'error'
      }
    }
  }

  async function openStrmPathPicker() {
    await loadStrmAccessiblePaths()
    strmPickerBreadcrumbs.value = []
    strmPickerCurrentPath.value = ''
    strmPickerDirs.value = [...strmAccessiblePaths.value]
    showStrmPathPicker.value = true
    if (strmAccessiblePaths.value.length === 0) {
      ui.message.value = '未检测到授权目录，请先在飞牛「应用设置」中授权存储目录，然后点击「刷新授权目录」'
      ui.messageType.value = 'error'
    }
  }

  function strmPickerGoRoot() {
    strmPickerBreadcrumbs.value = []
    strmPickerCurrentPath.value = ''
    strmPickerDirs.value = [...strmAccessiblePaths.value]
  }

  async function strmPickerEnterDir(dir: string) {
    const dirName = pathBasename(dir)
    if (strmAccessiblePaths.value.includes(dir)) {
      strmPickerBreadcrumbs.value = [{ name: dirName, path: dir }]
    } else {
      strmPickerBreadcrumbs.value.push({ name: dirName, path: dir })
    }
    strmPickerCurrentPath.value = dir
    await loadStrmPickerSubDirs(dir)
  }

  function strmPickerNavigateTo(idx: number) {
    strmPickerBreadcrumbs.value = strmPickerBreadcrumbs.value.slice(0, idx + 1)
    const currentPath = strmPickerBreadcrumbs.value[idx]?.path || ''
    strmPickerCurrentPath.value = currentPath
    void loadStrmPickerSubDirs(currentPath)
  }

  async function loadStrmPickerSubDirs(dirPath: string) {
    strmPickerLoading.value = true
    try {
      const res = await $fetch<{ success?: boolean; data?: { dirs?: string[]; error?: string } }>(
        '/api/strm/accessible-paths/children',
        { query: { path: dirPath } }
      )
      if (res?.success && res.data) {
        strmPickerDirs.value = res.data.dirs || []
        if (res.data.error) {
          ui.message.value = res.data.error
          ui.messageType.value = 'error'
        }
      } else {
        strmPickerDirs.value = []
      }
    } catch (e: unknown) {
      clientLog.error('strm-path-picker', '加载子目录失败:', e)
      ui.message.value = '加载子目录失败'
      ui.messageType.value = 'error'
      strmPickerDirs.value = []
    } finally {
      strmPickerLoading.value = false
    }
  }

  function confirmStrmPathPick(assign: (path: string) => void) {
    if (!strmPickerCurrentPath.value) return
    assign(strmPickerCurrentPath.value)
    showStrmPathPicker.value = false
  }

  return {
    strmAccessiblePaths,
    showStrmPathPicker,
    strmPickerBreadcrumbs,
    strmPickerDirs,
    strmPickerLoading,
    strmPickerCurrentPath,
    pathBasename,
    loadStrmAccessiblePaths,
    openStrmPathPicker,
    strmPickerGoRoot,
    strmPickerEnterDir,
    strmPickerNavigateTo,
    loadStrmPickerSubDirs,
    confirmStrmPathPick
  }
}
