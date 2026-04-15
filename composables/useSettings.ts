export interface SettingsData {
  embyBaseUrl?: string
  embyApiKey?: string
  embyProxyEnabled?: boolean
  embyProxyPort?: number
  pan115Cookie?: string
  pan115SaveDir?: string
  pan115MediaDir?: string
  pan115AppId?: string
  pan115OpenToken?: string
  tmdbApiUrl?: string
  tmdbApiKey?: string
  strmServerUrl?: string
  fnosCookie?: string
  gladosCookie?: string
  hdhiveCookie?: string
  hdhiveBaseUrl?: string
  renameMovieTemplate?: string
  renameTvTemplate?: string
  classificationStrategy?: string
  builtinReleaseGroups?: string[]
  customReleaseGroups?: string
  aiRecognizeEnabled?: string
  aiApiKey?: string
  aiApiUrl?: string
  aiModel?: string
  pathMapping?: string
}

export interface SettingsResponse {
  success: boolean
  data?: SettingsData
  error?: string
}

let pendingSettingsPromise: Promise<SettingsResponse> | null = null

export function useSettings() {
  const settingsResponse = useState<SettingsResponse | null>('settings-response', () => null)

  async function loadSettings(force: boolean = false): Promise<SettingsResponse> {
    if (!force && settingsResponse.value?.success) {
      return settingsResponse.value
    }

    if (!force && pendingSettingsPromise) {
      return await pendingSettingsPromise
    }

    pendingSettingsPromise = $fetch<SettingsResponse>('/api/settings')

    try {
      const response = await pendingSettingsPromise
      settingsResponse.value = response
      return response
    } finally {
      pendingSettingsPromise = null
    }
  }

  function setSettingsResponse(response: SettingsResponse | null): void {
    settingsResponse.value = response
  }

  function updateSettingsData(patch: Partial<SettingsData>): void {
    const currentData = settingsResponse.value?.data || {}
    settingsResponse.value = {
      success: true,
      data: {
        ...currentData,
        ...patch
      }
    }
  }

  return {
    settingsResponse,
    loadSettings,
    setSettingsResponse,
    updateSettingsData
  }
}
