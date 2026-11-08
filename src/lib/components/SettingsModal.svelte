<script lang="ts">
  import type { AppSettings, CustomThemePalette, ThemeMode, AiProvider } from '../types';
  import { generateRandomTheme, applyThemePalette } from '../themeRandomizer';
  import {
    t,
    getLocale,
    setLocale,
    getAvailableLocales,
    registerCustomLocale,
    getTemplateLocaleJson
  } from '../i18n/index.svelte';
  import { saveFileWithDialog } from '../fileExporter';
  import {
    PRESET_FONTS,
    isLocalFontAccessSupported,
    scanLocalSystemFonts,
    loadCustomFontFile,
    applyAppFont
  } from '../fontManager';
  import {
    fetchProviderLiveModels,
    getProviderLabel,
    type ProviderLiveModel
  } from '../ai/llmClient';

  interface Props {
    isOpen: boolean;
    settings: AppSettings;
    onClose: () => void;
    onUpdateSettings: (newSettings: AppSettings) => void;
  }

  let { isOpen, settings, onClose, onUpdateSettings }: Props = $props();

  let selectedProvider = $state<AiProvider>('gemini');
  let geminiKey = $state('');
  let claudeKey = $state('');
  let openaiKey = $state('');
  let openrouterKey = $state('');
  let openrouterModel = $state('anthropic/claude-3.5-sonnet');
  let geminiModel = $state('gemini-2.5-flash');
  let claudeModel = $state('claude-3-5-sonnet-latest');
  let openaiModel = $state('gpt-4o');

  // Unified dynamic models state for all 4 providers (Gemini, Claude, OpenAI, OpenRouter)
  let liveModels = $state<ProviderLiveModel[]>([]);
  let isLoadingLiveModels = $state(false);
  let liveModelsError = $state<string | null>(null);
  let modelSearchQuery = $state('');
  let isCustomModel = $state(false);

  let activeModel = $derived.by(() => {
    if (selectedProvider === 'gemini') return geminiModel;
    if (selectedProvider === 'claude') return claudeModel;
    if (selectedProvider === 'openai') return openaiModel;
    return openrouterModel;
  });

  function setActiveModel(modelId: string) {
    if (selectedProvider === 'gemini') geminiModel = modelId;
    else if (selectedProvider === 'claude') claudeModel = modelId;
    else if (selectedProvider === 'openai') openaiModel = modelId;
    else openrouterModel = modelId;
  }

  let filteredLiveModels = $derived(
    liveModels.filter((m) => {
      if (!modelSearchQuery.trim()) return true;
      const q = modelSearchQuery.toLowerCase();
      return m.id.toLowerCase().includes(q) || (m.name || '').toLowerCase().includes(q);
    })
  );

  async function loadModelsForProvider(provider: AiProvider, apiKey?: string) {
    const key = apiKey || (
      provider === 'gemini' ? geminiKey :
      provider === 'claude' ? claudeKey :
      provider === 'openai' ? openaiKey : openrouterKey
    );
    if (!key && provider !== 'openrouter') {
      liveModels = [];
      return;
    }

    isLoadingLiveModels = true;
    liveModelsError = null;
    try {
      const models = await fetchProviderLiveModels(provider, key);
      liveModels = models;
      if (models.length === 0 && key) {
        liveModelsError = 'No models returned for this key. You can enter any custom Model ID below.';
      }
    } catch (err: any) {
      liveModelsError = err?.message || 'Failed to fetch models from API.';
    } finally {
      isLoadingLiveModels = false;
    }
  }

  let currentThemeMode = $state<ThemeMode>('dark');
  let currentPalette = $state<CustomThemePalette | undefined>(undefined);
  let showApiKey = $state(false);
  let saveFeedback = $state(false);
  let localeFeedback = $state<string | null>(null);
  let availableLocales = $derived(getAvailableLocales());
  let activeLocale = $derived(getLocale());

  // Font customization state
  let selectedFontFamily = $state<string>('Inter');
  let customFontName = $state<string | undefined>(undefined);
  let customFontData = $state<string | undefined>(undefined);
  let manualFontInput = $state<string>('');
  let localSystemFonts = $state<string[]>([]);
  let isScanningFonts = $state(false);
  let localFontSearchQuery = $state('');
  let fontFeedback = $state<string | null>(null);

  let filteredLocalFonts = $derived(
    localSystemFonts.filter((f) => {
      if (!localFontSearchQuery.trim()) return true;
      return f.toLowerCase().includes(localFontSearchQuery.toLowerCase());
    })
  );

  async function handleExportLocaleTemplate() {
    const json = getTemplateLocaleJson();
    const ok = await saveFileWithDialog(
      'en.json',
      json,
      'application/json',
      'json',
      'DokAI Language Template (*.json)'
    );
    if (ok) {
      localeFeedback = 'Language template saved! Edit & import your <lang>.json file.';
      setTimeout(() => (localeFeedback = null), 3000);
    }
  }

  function handleImportLocaleFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = ev.target?.result as string;
        const meta = registerCustomLocale(raw, file.name);
        localeFeedback = `✓ Loaded language: ${meta.flag} ${meta.nativeName} (${meta.code}.json)`;
        setTimeout(() => (localeFeedback = null), 3500);
      } catch (err: any) {
        localeFeedback = `⚠️ Invalid locale JSON: ${err?.message || 'Parse error'}`;
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  // Testing states
  let isTesting = $state(false);
  let testStatus = $state<'idle' | 'success' | 'error'>('idle');
  let testMessage = $state<string>('');

  let wasOpen = false;

  $effect(() => {
    if (isOpen && !wasOpen) {
      wasOpen = true;
      selectedProvider = settings.aiProvider || 'gemini';
      geminiKey = settings.geminiApiKey || settings.apiKey || '';
      claudeKey = settings.claudeApiKey || '';
      openaiKey = settings.openaiApiKey || '';
      openrouterKey = settings.openrouterApiKey || '';
      openrouterModel = settings.openrouterModel || 'anthropic/claude-3.5-sonnet';
      geminiModel = settings.geminiModel || 'gemini-2.5-flash';
      claudeModel = settings.claudeModel || 'claude-3-5-sonnet-latest';
      openaiModel = settings.openaiModel || 'gpt-4o';
      isCustomModel = false;
      currentThemeMode = settings.themeMode || 'dark';
      currentPalette = settings.customPalette;
      selectedFontFamily = settings.appFontFamily || 'Inter';
      customFontName = settings.customFontName;
      customFontData = settings.customFontData;
      manualFontInput = '';
      fontFeedback = null;
      testStatus = 'idle';
      testMessage = '';

      loadModelsForProvider(selectedProvider, getActiveKey());
    } else if (!isOpen) {
      wasOpen = false;
    }
  });



  function getActiveKey(): string {
    if (selectedProvider === 'gemini') return geminiKey;
    if (selectedProvider === 'claude') return claudeKey;
    if (selectedProvider === 'openai') return openaiKey;
    return openrouterKey;
  }

  async function handleTestApiKey() {
    const key = getActiveKey().trim();
    if (!key) {
      testStatus = 'error';
      testMessage = 'Please enter an API key to test.';
      return;
    }

    isTesting = true;
    testStatus = 'idle';
    testMessage = '';

    try {
      if (selectedProvider === 'openrouter') {
        const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: {
            'Authorization': `Bearer ${key}`
          }
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const detail = errData?.error?.message || `HTTP ${res.status}`;
          throw new Error(detail);
        }
        const data = await res.json();
        const limitStr = data?.data?.limit != null ? ` (Limit: $${data.data.limit})` : '';
        testStatus = 'success';
        testMessage = `OpenRouter Key verified! Label: ${data?.data?.label || 'Active'}${limitStr}`;
        loadModelsForProvider('openrouter', key);
      } else if (selectedProvider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const detail = errData?.error?.message || `HTTP ${res.status}`;
          throw new Error(detail);
        }
        testStatus = 'success';
        testMessage = 'Connection Successful! Google Gemini API key authenticated.';
        loadModelsForProvider('gemini', key);
      } else if (selectedProvider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${key}` }
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const detail = errData?.error?.message || `HTTP ${res.status}`;
          throw new Error(detail);
        }
        testStatus = 'success';
        testMessage = 'Connection Successful! OpenAI API key verified.';
        loadModelsForProvider('openai', key);
      } else if (selectedProvider === 'claude') {
        if (key.startsWith('sk-ant-') && key.length > 25) {
          testStatus = 'success';
          testMessage = 'Anthropic Claude key structure verified.';
          loadModelsForProvider('claude', key);
        } else {
          throw new Error('Invalid Claude API key format. Expected "sk-ant-..." key.');
        }
      }
    } catch (err: any) {
      testStatus = 'error';
      testMessage = `Connection Failed: ${err.message || 'Unknown error'}`;
    } finally {
      isTesting = false;
    }
  }

  function handleSave() {
    const updated: AppSettings = {
      ...settings,
      aiProvider: selectedProvider,
      geminiApiKey: geminiKey.trim(),
      claudeApiKey: claudeKey.trim(),
      openaiApiKey: openaiKey.trim(),
      openrouterApiKey: openrouterKey.trim(),
      geminiModel: geminiModel.trim(),
      claudeModel: claudeModel.trim(),
      openaiModel: openaiModel.trim(),
      openrouterModel: openrouterModel.trim(),
      apiKey: geminiKey.trim() || settings.apiKey,
      themeMode: currentThemeMode,
      customPalette: currentPalette,
      appFontFamily: selectedFontFamily,
      customFontName,
      customFontData
    };
    onUpdateSettings(updated);
    saveFeedback = true;
    setTimeout(() => {
      saveFeedback = false;
      onClose();
    }, 400);
  }

  function handleSelectPresetFont(family: string) {
    selectedFontFamily = family;
    applyAppFont(family, customFontData, customFontName);
    fontFeedback = `✓ Font applied: ${family}`;
    setTimeout(() => (fontFeedback = null), 2000);
  }

  async function handleScanLocalFonts() {
    isScanningFonts = true;
    fontFeedback = null;
    try {
      const fonts = await scanLocalSystemFonts();
      if (fonts.length > 0) {
        localSystemFonts = fonts;
        fontFeedback = `✓ Found ${fonts.length} fonts installed on your computer!`;
      } else {
        fontFeedback = '⚠️ Local font scan requires permission or is not supported. You can type any font name below.';
      }
    } catch (e: any) {
      fontFeedback = '⚠️ Could not access local fonts. You can type any font name below.';
    } finally {
      isScanningFonts = false;
      setTimeout(() => (fontFeedback = null), 3500);
    }
  }

  function handleApplyManualFont() {
    if (!manualFontInput.trim()) return;
    const name = manualFontInput.trim();
    selectedFontFamily = name;
    applyAppFont(name);
    fontFeedback = `✓ Font applied: "${name}"`;
    setTimeout(() => (fontFeedback = null), 2500);
  }

  async function handleUploadFontFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const res = await loadCustomFontFile(file);
      customFontName = res.fontName;
      customFontData = res.fontDataUrl;
      selectedFontFamily = res.fontName;
      applyAppFont(res.fontName, res.fontDataUrl, res.fontName);
      fontFeedback = `✓ Loaded custom font: ${file.name}`;
      setTimeout(() => (fontFeedback = null), 3500);
    } catch (err: any) {
      fontFeedback = `⚠️ Failed to load font file: ${err?.message || 'Invalid font'}`;
    }
    input.value = '';
  }

  function handleResetFont() {
    selectedFontFamily = 'Inter';
    customFontName = undefined;
    customFontData = undefined;
    applyAppFont('Inter');
    fontFeedback = '✓ Reverted to default Inter font.';
    setTimeout(() => (fontFeedback = null), 2000);
  }

  function selectMode(mode: 'dark' | 'light') {
    currentThemeMode = mode;
    currentPalette = undefined;
    applyThemePalette(null, mode);
  }

  function handleRandomizeTheme() {
    const isDark = currentThemeMode !== 'light';
    const newPalette = generateRandomTheme(isDark);
    currentThemeMode = 'custom';
    currentPalette = newPalette;
    applyThemePalette(newPalette, 'custom');
  }

  function handleResetTheme() {
    currentThemeMode = 'dark';
    currentPalette = undefined;
    applyThemePalette(null, 'dark');
  }
</script>

{#if isOpen}
  <div class="modal-backdrop" onclick={onClose} aria-hidden="true"></div>

  <div class="modal-container" role="dialog" aria-modal="true">
    <div class="modal-header">
      <div class="header-info">
        <h2 class="modal-title">{t('settings.title', 'Settings')}</h2>
        <p class="modal-subtitle">{t('settings.subtitle', 'Manage AI providers, test API credentials, and customize application themes.')}</p>
      </div>
      <button class="close-btn" onclick={onClose} title={t('common.close', 'Close')}>✕</button>
    </div>

    <div class="modal-body">
      <!-- Section: AI Provider & Credentials -->
      <div class="settings-group">
        <h3 class="group-title">{t('settings.aiProviderTitle', '🤖 AI Assistant Provider')}</h3>
        <p class="group-desc">
          {t('settings.aiProviderDesc', 'Select your provider (including OpenRouter for multiple models), enter credentials, and run a live connection test.')}
        </p>

        <!-- Provider Switcher -->
        <div class="provider-tabs">
          <button
            type="button"
            class="prov-tab"
            class:active={selectedProvider === 'gemini'}
            onclick={() => {
              selectedProvider = 'gemini';
              testStatus = 'idle';
              loadModelsForProvider('gemini');
            }}
          >
            <span class="prov-icon">✨</span>
            <span class="prov-name">Gemini</span>
          </button>
          <button
            type="button"
            class="prov-tab"
            class:active={selectedProvider === 'claude'}
            onclick={() => {
              selectedProvider = 'claude';
              testStatus = 'idle';
              loadModelsForProvider('claude');
            }}
          >
            <span class="prov-icon">🧠</span>
            <span class="prov-name">Claude</span>
          </button>
          <button
            type="button"
            class="prov-tab"
            class:active={selectedProvider === 'openai'}
            onclick={() => {
              selectedProvider = 'openai';
              testStatus = 'idle';
              loadModelsForProvider('openai');
            }}
          >
            <span class="prov-icon">⚡</span>
            <span class="prov-name">OpenAI</span>
          </button>
          <button
            type="button"
            class="prov-tab"
            class:active={selectedProvider === 'openrouter'}
            onclick={() => {
              selectedProvider = 'openrouter';
              testStatus = 'idle';
              loadModelsForProvider('openrouter');
            }}
          >
            <span class="prov-icon">🌐</span>
            <span class="prov-name">OpenRouter</span>
          </button>
        </div>

        <!-- API Key Input Field based on Provider -->
        <div class="api-key-container">
          <div class="input-wrap">
            {#if selectedProvider === 'gemini'}
              <input
                type={showApiKey ? 'text' : 'password'}
                bind:value={geminiKey}
                placeholder="AIzaSy... (Google AI Studio Key)"
                class="settings-input"
              />
            {:else if selectedProvider === 'claude'}
              <input
                type={showApiKey ? 'text' : 'password'}
                bind:value={claudeKey}
                placeholder="sk-ant-api03-... (Anthropic Claude Key)"
                class="settings-input"
              />
            {:else if selectedProvider === 'openai'}
              <input
                type={showApiKey ? 'text' : 'password'}
                bind:value={openaiKey}
                placeholder="sk-proj-... (OpenAI API Key)"
                class="settings-input"
              />
            {:else}
              <input
                type={showApiKey ? 'text' : 'password'}
                bind:value={openrouterKey}
                placeholder="sk-or-v1-... (OpenRouter API Key)"
                class="settings-input"
              />
            {/if}

            <button
              type="button"
              class="toggle-visibility-btn"
              onclick={() => (showApiKey = !showApiKey)}
            >
              {showApiKey ? t('settings.hide', 'Hide') : t('settings.show', 'Show')}
            </button>

            <!-- Test Connection Button -->
            <button
              type="button"
              class="test-btn"
              disabled={isTesting}
              onclick={handleTestApiKey}
              title={t('settings.testKeyTitle', 'Test API Key Connection')}
            >
              {#if isTesting}
                <span class="btn-spinner"></span>
                <span>{t('settings.testing', 'Testing...')}</span>
              {:else}
                <span>⚡ {t('settings.testKey', 'Test Key')}</span>
              {/if}
            </button>
          </div>

          <!-- Unified Dynamic Live Model Selection for All Providers (Gemini, Claude, OpenAI, OpenRouter) -->
          <div class="model-picker-box">
            <div class="model-box-header">
              <div class="box-header-info">
                <span class="box-title">{getProviderLabel(selectedProvider)} {t('settings.models', 'Models')}</span>
                {#if liveModels.length > 0}
                  <span class="count-pill">{liveModels.length} {t('settings.modelsCount', 'live')}</span>
                {/if}
              </div>
              <div class="box-header-actions">
                <button
                  type="button"
                  class="action-mini-btn"
                  onclick={() => loadModelsForProvider(selectedProvider, getActiveKey())}
                  disabled={isLoadingLiveModels}
                  title="Fetch and reload live active models from {getProviderLabel(selectedProvider)} API"
                >
                  {#if isLoadingLiveModels}
                    <span class="btn-spinner mini"></span>
                    <span>{t('settings.loadingModels', 'Loading...')}</span>
                  {:else}
                    <span>🔄 {t('settings.refresh', 'Refresh')}</span>
                  {/if}
                </button>
                <button
                  type="button"
                  class="action-mini-btn"
                  class:active={isCustomModel}
                  onclick={() => (isCustomModel = !isCustomModel)}
                  title="Toggle Custom Model ID input"
                >
                  ✏️ {t('settings.customId', 'Custom ID')}
                </button>
              </div>
            </div>

            <!-- Current Selected Model Display -->
            <div class="selected-model-banner">
              <span class="sel-label">{t('settings.selectedModel', 'Selected Model')}:</span>
              <span class="sel-name" title={activeModel}>{activeModel || t('settings.noModelSelected', 'None selected')}</span>
            </div>

            {#if isCustomModel}
              <div class="custom-model-row">
                <input
                  type="text"
                  value={activeModel}
                  oninput={(e) => setActiveModel(e.currentTarget.value)}
                  placeholder="e.g. gemini-3.8-flash, gpt-4o, claude-3-7-sonnet-latest..."
                  class="custom-model-input"
                />
                <span class="custom-hint">{t('settings.customModelHint', 'Enter any custom or preview model identifier directly')}</span>
              </div>
            {/if}

            <!-- States: Loading, Error, Empty, or Searchable List -->
            {#if isLoadingLiveModels}
              <div class="models-status-card loading">
                <span class="btn-spinner"></span>
                <span>{t('settings.fetchingLiveModels', 'Fetching live active models from')} {getProviderLabel(selectedProvider)} API...</span>
              </div>
            {:else if liveModelsError}
              <div class="models-status-card error">
                <span>⚠️ {liveModelsError}</span>
                <button type="button" class="retry-btn" onclick={() => loadModelsForProvider(selectedProvider, getActiveKey())}>
                  {t('settings.retry', 'Retry')}
                </button>
              </div>
            {:else if liveModels.length === 0}
              <div class="models-status-card empty">
                {#if !getActiveKey().trim()}
                  <span>🔑 {t('settings.enterApiKeyPrompt', 'Enter your API key above, then click')} <strong>"🔄 {t('settings.refresh', 'Refresh')}"</strong> {t('settings.or', 'or')} <strong>"⚡ {t('settings.testKey', 'Test Key')}"</strong> {t('settings.toFetchActiveModels', 'to fetch live models.')}</span>
                {:else}
                  <div class="empty-ready">
                    <span>{t('settings.keyDetectedPrompt', 'Key detected! Click below to retrieve active models from')} {getProviderLabel(selectedProvider)}:</span>
                    <button type="button" class="fetch-action-btn" onclick={() => loadModelsForProvider(selectedProvider, getActiveKey())}>
                      <span>{t('settings.loadActiveModels', 'Load Active Models')}</span>
                    </button>
                  </div>
                {/if}
              </div>
            {:else}
              <!-- Search & Live Models List -->
              <div class="models-browser">
                <div class="search-bar">
                  <span class="search-icon">🔍</span>
                  <input
                    type="text"
                    bind:value={modelSearchQuery}
                    placeholder="{t('settings.searchModels', 'Search')} {liveModels.length} {t('settings.models', 'models')}..."
                    class="search-input"
                  />
                  {#if modelSearchQuery}
                    <button
                      type="button"
                      class="clear-btn"
                      onclick={() => (modelSearchQuery = '')}
                      title="Clear search"
                    >✕</button>
                  {/if}
                </div>

                <div class="models-list" role="listbox">
                  {#if filteredLiveModels.length === 0}
                    <div class="no-results">
                      <span>{t('settings.noMatchingModels', 'No models matching')} "{modelSearchQuery}"</span>
                    </div>
                  {:else}
                    {#each filteredLiveModels as m (m.id)}
                      <button
                        type="button"
                        class="model-row"
                        class:selected={activeModel === m.id}
                        onclick={() => setActiveModel(m.id)}
                        role="option"
                        aria-selected={activeModel === m.id}
                        title={m.name + ' (' + m.id + ')'}
                      >
                        <div class="model-row-left">
                          <span class="row-name">{m.name}</span>
                          <span class="row-id">{m.id}</span>
                        </div>
                        <div class="model-row-right">
                          {#if m.contextLength}
                            <span class="row-ctx">{Math.round(m.contextLength / 1000)}k ctx</span>
                          {/if}
                          {#if activeModel === m.id}
                            <span class="row-check">✓</span>
                          {/if}
                        </div>
                      </button>
                    {/each}
                  {/if}
                </div>
              </div>
            {/if}
          </div>



          <!-- Test Result Feedback -->
          {#if testStatus === 'success'}
            <div class="test-banner success">
              <span>{testMessage}</span>
            </div>
          {:else if testStatus === 'error'}
            <div class="test-banner error">
              <span>⚠️ {testMessage}</span>
            </div>
          {/if}
        </div>
      </div>

      <div class="settings-divider"></div>

      <!-- Section: Interface Language (Drop-in JSON i18n) -->
      <div class="settings-group">
        <h3 class="group-title">{t('settings.languageTitle', '🌐 Interface Language')}</h3>
        <p class="group-desc">
          {t('settings.languageDesc', 'Select the application language or add a new language by dropping a <lang>.json into src/lib/i18n/locales/ or importing below.')}
        </p>

        <div class="locale-row">
          <div class="locale-pills">
            {#each availableLocales as loc (loc.code)}
              <button
                type="button"
                class="locale-btn"
                class:active={activeLocale === loc.code}
                onclick={() => setLocale(loc.code)}
              >
                <span class="loc-flag">{loc.flag}</span>
                <span class="loc-name">{loc.nativeName}</span>
                <span class="loc-code">{loc.code}.json</span>
              </button>
            {/each}
          </div>

          <div class="locale-actions">
            <button type="button" class="loc-action-btn" onclick={handleExportLocaleTemplate}>
              📥 {t('settings.exportLocaleTemplate', 'Export Template (en.json)')}
            </button>
            <label class="loc-action-btn upload">
              📤 {t('settings.importLocaleFile', 'Import Language (.json)')}
              <input type="file" accept=".json" onchange={handleImportLocaleFile} class="hidden-file-input" />
            </label>
          </div>

          {#if localeFeedback}
            <div class="locale-feedback">{localeFeedback}</div>
          {/if}
        </div>
      </div>

      <div class="settings-divider"></div>

      <!-- Section: Theme & Appearance -->
      <div class="settings-group">
        <h3 class="group-title">{t('settings.themeTitle', '🎨 Appearance & Themes')}</h3>
        <p class="group-desc">
          {t('settings.themeDesc', 'Choose a baseline mode or generate an aesthetic random palette.')}
        </p>

        <div class="theme-options-row">
          <button
            type="button"
            class="theme-card"
            class:active={currentThemeMode === 'dark' && !currentPalette}
            onclick={() => selectMode('dark')}
          >
            <span class="theme-icon">🌙</span>
            <span class="theme-name">{t('settings.darkMode', 'Dark Mode')}</span>
          </button>

          <button
            type="button"
            class="theme-card"
            class:active={currentThemeMode === 'light'}
            onclick={() => selectMode('light')}
          >
            <span class="theme-icon">☀️</span>
            <span class="theme-name">{t('settings.lightMode', 'Light Mode')}</span>
          </button>

          <button
            type="button"
            class="theme-card randomize-btn"
            class:active={currentThemeMode === 'custom'}
            onclick={handleRandomizeTheme}
            title={t('settings.randomThemeTitle', 'Generate a completely randomized aesthetic theme')}
          >
            <span class="theme-icon">🎲</span>
            <span class="theme-name">{t('settings.randomTheme', 'Surprise Me!')}</span>
          </button>
        </div>

        {#if currentPalette}
          <div class="custom-palette-preview">
            <span class="preview-label">{t('settings.activeCustomPalette', 'Active Custom Palette')}:</span>
            <div class="color-chips">
              <span class="chip" style="background: {currentPalette.primary};" title="Primary Accent"></span>
              <span class="chip" style="background: {currentPalette.titlebarBg};" title="Titlebar"></span>
              <span class="chip" style="background: {currentPalette.sidebarBg};" title="Sidebar"></span>
              <span class="chip" style="background: {currentPalette.editorBg};" title="Editor"></span>
              <span class="chip" style="background: {currentPalette.previewBg};" title="Preview"></span>
            </div>
            <button type="button" class="reset-link-btn" onclick={handleResetTheme}>
              {t('settings.resetTheme', 'Reset to Default')}
            </button>
          </div>
        {/if}
      </div>

      <!-- Section: Typography & Global Font -->
      <div class="setting-section">
        <h3>{t('settings.fontTitle', 'Typography & Global Font')}</h3>
        <p class="section-desc">{t('settings.fontDesc', 'Customize the font applied across the entire DokAI interface and editor.')}</p>

        <!-- Current Active Font preview card -->
        <div class="font-active-card">
          <div class="font-info">
            <span class="font-label">{t('settings.activeFont', 'Active Font')}:</span>
            <strong class="font-value" style="font-family: {selectedFontFamily};">{selectedFontFamily}</strong>
            {#if customFontName}
              <span class="custom-font-badge">{t('settings.loadedCustomFile', 'Loaded Custom File')} ({customFontName})</span>
            {/if}
          </div>
          <button type="button" class="btn-subtle" onclick={handleResetFont}>
            {t('settings.resetFont', 'Reset to Default')}
          </button>
        </div>

        <!-- Live Preview Text -->
        <div class="font-preview-box" style="font-family: {selectedFontFamily};">
          <p class="preview-title">DokAI — The Quick Brown Fox Jumps Over The Lazy Dog 0123456789</p>
          <p class="preview-sub">Typography preview: Aa Bb Cc Dd Ee Ff Gg 0123456789. Code: <code>const dokai = () =&gt; true;</code></p>
        </div>

        {#if fontFeedback}
          <div class="font-feedback-banner">
            {fontFeedback}
          </div>
        {/if}

        <!-- Presets -->
        <span class="setting-subheading">{t('settings.popularPresets', 'Popular Presets')}</span>
        <div class="font-presets-grid">
          {#each PRESET_FONTS as preset}
            <button
              type="button"
              class="font-preset-btn"
              class:active={selectedFontFamily === preset.family && !customFontName}
              onclick={() => handleSelectPresetFont(preset.family)}
              style="font-family: {preset.family};"
            >
              <span class="font-name">{preset.name}</span>
              <span class="font-cat">{preset.category}</span>
            </button>
          {/each}
        </div>

        <!-- PC System Fonts & Upload -->
        <div class="font-tools-grid">
          <div class="font-tool-col">
            <span class="setting-subheading">{t('settings.systemFonts', 'System Fonts (Your PC)')}</span>
            <div class="font-system-actions">
              <button
                type="button"
                class="btn secondary font-action-btn"
                onclick={handleScanLocalFonts}
                disabled={isScanningFonts}
              >
                {isScanningFonts ? t('settings.scanning', 'Scanning...') : t('settings.scanLocalFonts', '🔍 Scan Installed PC Fonts')}
              </button>
            </div>

            {#if localSystemFonts.length > 0}
              <div class="local-fonts-list-container">
                <input
                  type="text"
                  class="font-search-input"
                  placeholder={t('settings.filterLocalFonts', 'Filter local fonts...')}
                  bind:value={manualFontInput}
                />
                <div class="local-fonts-list">
                  {#each filteredLocalFonts as font}
                    <button
                      type="button"
                      class="local-font-item"
                      class:active={selectedFontFamily === font}
                      onclick={() => handleSelectPresetFont(font)}
                      style="font-family: '{font}', sans-serif;"
                    >
                      {font}
                    </button>
                  {/each}
                </div>
              </div>
            {:else}
              <div class="manual-font-row">
                <input
                  type="text"
                  class="font-search-input"
                  placeholder={t('settings.typeFontName', 'Or type font name (e.g. Arial, Consolas, Helvetica)')}
                  bind:value={manualFontInput}
                  onkeydown={(e) => e.key === 'Enter' && handleApplyManualFont()}
                />
                <button type="button" class="btn secondary" onclick={handleApplyManualFont}>{t('settings.apply', 'Apply')}</button>
              </div>
            {/if}
          </div>

          <div class="font-tool-col">
            <span class="setting-subheading">{t('settings.customFontFile', 'Custom Font File')}</span>
            <p class="font-help-text">{t('settings.customFontFileDesc', 'Upload any .ttf, .otf, .woff, or .woff2 font file to use it in DokAI.')}</p>
            <label class="font-upload-card">
              <span class="upload-icon">📁</span>
              <span class="upload-text">{t('settings.uploadFontFile', 'Select Font File (.ttf, .otf, .woff2)')}</span>
              <input
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                class="hidden-file-input"
                onchange={handleUploadFontFile}
              />
            </label>
            {#if customFontName}
              <div class="uploaded-font-status">
                <span>{t('settings.loaded', 'Loaded')}: <strong>{customFontName}</strong></span>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      {#if saveFeedback}
        <span class="feedback-msg">✓ {t('settings.preferencesSaved', 'Preferences saved!')}</span>
      {/if}
      <button type="button" class="btn secondary" onclick={onClose}>{t('common.cancel', 'Cancel')}</button>
      <button type="button" class="btn primary" onclick={handleSave}>{t('settings.saveSettings', 'Save Preferences')}</button>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(4px);
    z-index: 1000;
  }

  .modal-container {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 620px;
    max-height: 90vh;
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
    z-index: 1001;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 22px;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  .modal-subtitle {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 2px 0 0 0;
  }

  .close-btn {
    background: transparent;
    border: none;
    font-size: 14px;
    color: var(--text-secondary);
    cursor: pointer;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .modal-body {
    padding: 22px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    overflow-y: auto;
    max-height: calc(90vh - 140px);
  }

  .settings-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .group-title {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .group-desc {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 0 0 4px 0;
    line-height: 1.4;
  }

  .provider-tabs {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin-bottom: 4px;
  }

  .prov-tab {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 8px 6px;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    background: var(--input-bg);
    color: var(--text-secondary);
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .prov-tab:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .prov-tab.active {
    background: var(--accent-subtle);
    border-color: var(--accent-color);
    color: var(--accent-color);
  }

  .prov-icon {
    font-size: 13px;
  }

  .api-key-container {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .input-wrap {
    display: flex;
    gap: 8px;
  }

  .settings-input {
    flex: 1;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 13px;
    color: var(--text-primary);
    outline: none;
    transition: border-color 0.15s ease;
  }

  .settings-input:focus {
    border-color: var(--accent-color);
  }

  .toggle-visibility-btn {
    background: var(--btn-bg);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 0 12px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .toggle-visibility-btn:hover {
    background: var(--btn-hover-bg);
    color: var(--text-primary);
  }

  .test-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
    border: 1px solid var(--accent-color);
    border-radius: 6px;
    padding: 0 14px;
    font-size: 12px;
    font-weight: 600;
    color: var(--accent-color);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .test-btn:hover:not(:disabled) {
    background: var(--accent-color);
    color: #ffffff;
  }

  .test-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .model-picker-box {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--bg-base);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 10px 12px;
    margin-top: 4px;
  }

  .model-box-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .box-header-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .box-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .count-pill {
    font-size: 10.5px;
    padding: 1px 7px;
    border-radius: 10px;
    background: var(--badge-bg);
    color: var(--accent-color);
    font-weight: 600;
  }

  .box-header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .action-mini-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    padding: 4px 8px;
    background: var(--btn-bg);
    border: 1px solid var(--border-color);
    border-radius: 5px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .action-mini-btn:hover:not(:disabled) {
    background: var(--btn-hover-bg);
    color: var(--text-primary);
    border-color: var(--border-hover-color);
  }

  .action-mini-btn.active {
    background: var(--accent-subtle);
    border-color: var(--accent-color);
    color: var(--accent-color);
  }

  .action-mini-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .selected-model-banner {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(99, 102, 241, 0.08);
    border: 1px solid rgba(99, 102, 241, 0.25);
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 11.5px;
  }

  .sel-label {
    color: var(--text-secondary);
    font-weight: 500;
    white-space: nowrap;
  }

  .sel-name {
    color: var(--accent-color);
    font-weight: 600;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .custom-model-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 8px;
    background: var(--bg-surface);
    border: 1px dashed var(--border-color);
    border-radius: 6px;
  }

  .custom-model-input {
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    border-radius: 5px;
    padding: 6px 10px;
    font-size: 12px;
    outline: none;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  .custom-model-input:focus {
    border-color: var(--accent-color);
  }

  .custom-hint {
    font-size: 10.5px;
    color: var(--text-secondary);
  }

  .models-status-card {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    border-radius: 6px;
    font-size: 12px;
    text-align: center;
  }

  .models-status-card.loading {
    background: var(--bg-surface);
    color: var(--text-secondary);
  }

  .models-status-card.error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: #ef4444;
  }

  .models-status-card.empty {
    background: var(--bg-surface);
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .empty-ready {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .fetch-action-btn, .retry-btn {
    background: var(--accent-color);
    color: #ffffff;
    border: none;
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
  }

  .models-browser {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .search-bar {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 9px;
    font-size: 11px;
    pointer-events: none;
    opacity: 0.7;
  }

  .search-input {
    width: 100%;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 6px 28px 6px 28px;
    font-size: 11.5px;
    color: var(--text-primary);
    outline: none;
  }

  .search-input:focus {
    border-color: var(--accent-color);
  }

  .clear-btn {
    position: absolute;
    right: 8px;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 11px;
    cursor: pointer;
  }

  .models-list {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-surface);
    display: flex;
    flex-direction: column;
  }

  .model-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    border: none;
    background: transparent;
    border-bottom: 1px solid var(--border-color);
    cursor: pointer;
    text-align: left;
    transition: background 0.12s ease;
  }

  .model-row:last-child {
    border-bottom: none;
  }

  .model-row:hover {
    background: var(--bg-hover);
  }

  .model-row.selected {
    background: var(--accent-subtle);
  }

  .model-row-left {
    display: flex;
    flex-direction: column;
    gap: 1px;
    overflow: hidden;
  }

  .row-name {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .row-id {
    font-size: 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .model-row-right {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: 8px;
    flex-shrink: 0;
  }

  .row-ctx {
    font-size: 10px;
    padding: 1px 5px;
    background: var(--bg-base);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-secondary);
  }

  .row-check {
    font-size: 12px;
    font-weight: 700;
    color: var(--accent-color);
  }

  .no-results {
    padding: 16px;
    text-align: center;
    color: var(--text-secondary);
    font-size: 11.5px;
  }

  .btn-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  .btn-spinner.mini {
    width: 10px;
    height: 10px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .test-banner {
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
  }

  .test-banner.success {
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid #10b981;
    color: #10b981;
  }

  .test-banner.error {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid #ef4444;
    color: #ef4444;
  }

  .settings-divider {
    height: 1px;
    background: var(--border-color);
  }

  .theme-options-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-top: 4px;
  }

  .theme-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 12px 10px;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .theme-card:hover {
    border-color: var(--accent-color);
    background: var(--bg-hover);
  }

  .theme-card.active {
    border-color: var(--accent-color);
    background: var(--accent-subtle);
    box-shadow: 0 0 0 1px var(--accent-color);
  }

  .theme-card.randomize-btn {
    background: linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%);
    border-color: rgba(236, 72, 153, 0.3);
  }

  .theme-card.randomize-btn:hover {
    background: linear-gradient(135deg, rgba(236, 72, 153, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
    border-color: #ec4899;
  }

  .theme-icon {
    font-size: 20px;
  }

  .theme-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .custom-palette-preview {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
    padding: 8px 12px;
    background: var(--input-bg);
    border-radius: 6px;
    border: 1px dashed var(--border-color);
  }

  .preview-label {
    font-size: 11.5px;
    color: var(--text-secondary);
  }

  .color-chips {
    display: flex;
    gap: 4px;
  }

  .chip {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .reset-link-btn {
    margin-left: auto;
    background: transparent;
    border: none;
    font-size: 11.5px;
    color: var(--text-secondary);
    text-decoration: underline;
    cursor: pointer;
  }

  .reset-link-btn:hover {
    color: var(--accent-color);
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 22px;
    border-top: 1px solid var(--border-color);
    background: var(--toolbar-bg);
  }

  .feedback-msg {
    font-size: 12px;
    color: #10b981;
    margin-right: auto;
    font-weight: 500;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s ease;
  }

  .btn.secondary {
    background: var(--btn-bg);
    border-color: var(--border-color);
    color: var(--text-secondary);
  }

  .btn.secondary:hover {
    background: var(--btn-hover-bg);
    color: var(--text-primary);
  }

  .btn.primary {
    background: var(--accent-color);
    color: #ffffff;
  }

  .btn.primary:hover {
    opacity: 0.95;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
  }

  .locale-row {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .locale-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .locale-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--input-bg);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 12.5px;
    font-weight: 600;
    transition: all 0.15s ease;
  }

  .locale-btn:hover {
    border-color: var(--accent-color);
  }

  .locale-btn.active {
    border-color: var(--accent-color);
    background: var(--accent-subtle);
    box-shadow: 0 0 0 1px var(--accent-color);
  }

  .loc-code {
    font-size: 10.5px;
    font-family: 'JetBrains Mono', Consolas, monospace;
    color: var(--text-secondary);
    background: var(--btn-bg);
    padding: 1px 6px;
    border-radius: 4px;
  }

  .locale-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .loc-action-btn {
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    background: var(--btn-bg);
    color: var(--text-secondary);
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .loc-action-btn:hover {
    background: var(--btn-hover-bg);
    color: var(--text-primary);
    border-color: var(--accent-color);
  }

  .hidden-file-input {
    display: none;
  }

  .locale-feedback {
    font-size: 12px;
    color: #10b981;
    font-weight: 500;
  }

  /* Typography & Global Font Section */
  .font-active-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    margin-bottom: 12px;
  }

  .font-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .font-label {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .font-value {
    font-size: 14px;
    color: var(--accent-color);
  }

  .custom-font-badge {
    font-size: 10px;
    padding: 2px 7px;
    background: rgba(99, 102, 241, 0.15);
    color: #818cf8;
    border-radius: 12px;
    border: 1px solid rgba(99, 102, 241, 0.3);
  }

  .btn-subtle {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 11px;
    cursor: pointer;
    text-decoration: underline;
    padding: 4px;
  }

  .btn-subtle:hover {
    color: var(--text-primary);
  }

  .font-preview-box {
    padding: 14px 16px;
    background: var(--bg-primary);
    border: 1px dashed var(--border-color);
    border-radius: 8px;
    margin-bottom: 16px;
    transition: font-family 0.2s ease;
  }

  .font-preview-box .preview-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 6px 0;
    line-height: 1.4;
  }

  .font-preview-box .preview-sub {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 0;
  }

  .font-preview-box code {
    background: var(--btn-bg);
    padding: 2px 5px;
    border-radius: 4px;
    font-size: 11px;
  }

  .font-feedback-banner {
    padding: 8px 12px;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: #10b981;
    border-radius: 6px;
    font-size: 12px;
    margin-bottom: 14px;
  }

  .font-presets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 8px;
    margin-bottom: 16px;
  }

  .font-preset-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 8px 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }

  .font-preset-btn:hover {
    border-color: var(--accent-color);
    background: var(--btn-hover-bg);
  }

  .font-preset-btn.active {
    border-color: var(--accent-color);
    background: rgba(99, 102, 241, 0.12);
  }

  .font-preset-btn .font-name {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .font-preset-btn .font-cat {
    font-size: 10px;
    color: var(--text-secondary);
    margin-top: 2px;
  }

  .font-tools-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }

  @media (max-width: 640px) {
    .font-tools-grid {
      grid-template-columns: 1fr;
    }
  }

  .font-tool-col {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .font-system-actions {
    display: flex;
    gap: 8px;
  }

  .font-action-btn {
    width: 100%;
    justify-content: center;
    font-size: 12px;
    padding: 8px 12px;
  }

  .font-search-input {
    width: 100%;
    padding: 7px 10px;
    font-size: 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
  }

  .font-search-input:focus {
    outline: none;
    border-color: var(--accent-color);
  }

  .manual-font-row {
    display: flex;
    gap: 8px;
  }

  .manual-font-row .font-search-input {
    flex: 1;
  }

  .local-fonts-list-container {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .local-fonts-list {
    max-height: 140px;
    overflow-y: auto;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .local-font-item {
    text-align: left;
    background: transparent;
    border: none;
    border-radius: 4px;
    padding: 5px 8px;
    font-size: 12px;
    color: var(--text-primary);
    cursor: pointer;
    transition: background 0.1s ease;
  }

  .local-font-item:hover {
    background: var(--btn-hover-bg);
  }

  .local-font-item.active {
    background: rgba(99, 102, 241, 0.15);
    color: var(--accent-color);
    font-weight: 600;
  }

  .font-help-text {
    font-size: 11.5px;
    color: var(--text-secondary);
    margin: 0;
  }

  .font-upload-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 16px 12px;
    border: 1px dashed var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    cursor: pointer;
    text-align: center;
    transition: all 0.15s ease;
  }

  .font-upload-card:hover {
    border-color: var(--accent-color);
    background: var(--btn-hover-bg);
  }

  .font-upload-card .upload-icon {
    font-size: 20px;
  }

  .font-upload-card .upload-text {
    font-size: 11.5px;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .uploaded-font-status {
    font-size: 11.5px;
    color: #10b981;
    padding: 4px 8px;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 4px;
  }
</style>
