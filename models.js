// Sistema avançado de gerenciamento de modelos OpenRouter
class ModelsManager {
  constructor() {
    this.models = [];
    this.filteredModels = [];
    this.lastUpdate = null;
    this.updateInterval = 24 * 60 * 60 * 1000; // 24 horas
    this.isLoading = false;
    this.cache = new Map();
  }

  async fetchModels(apiKey) {
    if (this.isLoading) {
      throw new Error('Já existe uma requisição em andamento');
    }

    this.isLoading = true;
    
    try {
      console.log('🔄 Buscando modelos da OpenRouter...');
      
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin || 'chrome-extension://',
          'X-Title': 'Izy AI Venice',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Modelos recebidos:', data.data?.length || 0);
      
      return data.data || [];
    } catch (error) {
      console.error('❌ Erro ao buscar modelos:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  async syncModels(apiKey, forceUpdate = false) {
    if (!apiKey) {
      throw new Error('API key é obrigatória');
    }

    const now = Date.now();
    const lastUpdate = await this.getLastUpdateTime();

    // Verifica se precisa atualizar
    if (!forceUpdate && lastUpdate && (now - lastUpdate) < this.updateInterval) {
      console.log('📦 Usando modelos do cache...');
      this.models = await this.getCachedModels();
      if (this.models.length > 0) {
        this.filteredModels = [...this.models];
        return this.models;
      }
    }

    try {
      const rawModels = await this.fetchModels(apiKey);
      
      // Processa e organiza os modelos
      this.models = rawModels
        .filter(model => model.id && model.name)
        .map(model => this.processModel(model))
        .sort((a, b) => this.sortModels(a, b));

      console.log('🎯 Modelos processados:', this.models.length);

      // Salva no cache
      await this.saveModelsToCache(this.models);
      await this.saveLastUpdateTime(now);
      
      this.filteredModels = [...this.models];
      return this.models;
    } catch (error) {
      console.warn('⚠️ Erro na sincronização, tentando usar cache...');
      this.models = await this.getCachedModels();
      this.filteredModels = [...this.models];
      
      if (this.models.length === 0) {
        throw error;
      }
      
      return this.models;
    }
  }

  processModel(model) {
    return {
      id: model.id,
      name: model.name || model.id,
      description: model.description || '',
      context_length: model.context_length || 0,
      pricing: model.pricing || {},
      top_provider: model.top_provider || {},
      architecture: model.architecture || {},
      created: model.created || 0,
      category: this.getModelCategory(model.id),
      isPopular: this.isPopularModel(model.id),
      displayName: this.formatDisplayName(model),
      searchText: this.createSearchText(model)
    };
  }

  formatDisplayName(model) {
    const contextLength = model.context_length ? ` (${(model.context_length / 1000).toFixed(0)}k)` : '';
    return `${model.name}${contextLength}`;
  }

  createSearchText(model) {
    return [
      model.id,
      model.name,
      model.description,
      this.getModelCategory(model.id)
    ].filter(Boolean).join(' ').toLowerCase();
  }

  sortModels(a, b) {
    // Prioriza modelos populares
    if (a.isPopular && !b.isPopular) return -1;
    if (!a.isPopular && b.isPopular) return 1;
    
    // Depois por contexto
    const aContext = a.context_length || 0;
    const bContext = b.context_length || 0;
    if (aContext !== bContext) return bContext - aContext;
    
    // Por último, alfabético
    return a.name.localeCompare(b.name);
  }

  searchModels(query) {
    if (!query || query.trim() === '') {
      this.filteredModels = [...this.models];
      return this.filteredModels;
    }

    const searchTerm = query.toLowerCase().trim();
    const terms = searchTerm.split(' ').filter(term => term.length > 0);
    
    this.filteredModels = this.models.filter(model => {
      return terms.every(term => 
        model.searchText.includes(term)
      );
    });

    console.log(`🔍 Busca por "${query}": ${this.filteredModels.length} resultados`);
    return this.filteredModels;
  }

  getPopularModels() {
    return this.models.filter(model => model.isPopular);
  }

  isPopularModel(modelId) {
    const popularIds = [
      'anthropic/claude-3.5-sonnet',
      'anthropic/claude-3-5-haiku',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'openai/gpt-4-turbo',
      'meta-llama/llama-3.1-405b-instruct',
      'meta-llama/llama-3.1-70b-instruct',
      'meta-llama/llama-3.1-8b-instruct',
      'google/gemini-pro-1.5',
      'mistralai/mixtral-8x7b-instruct',
      'anthropic/claude-3-opus',
      'anthropic/claude-3-sonnet',
      'anthropic/claude-3-haiku'
    ];
    return popularIds.includes(modelId);
  }

  getModelCategory(modelId) {
    if (modelId.includes('claude') || modelId.includes('anthropic')) return 'Anthropic';
    if (modelId.includes('gpt') || modelId.includes('openai')) return 'OpenAI';
    if (modelId.includes('llama') || modelId.includes('meta')) return 'Meta';
    if (modelId.includes('gemini') || modelId.includes('google')) return 'Google';
    if (modelId.includes('mistral')) return 'Mistral';
    if (modelId.includes('cohere')) return 'Cohere';
    if (modelId.includes('perplexity')) return 'Perplexity';
    return 'Outros';
  }

  // Métodos de cache melhorados
  async saveModelsToCache(models) {
    try {
      const cacheData = {
        models: models,
        timestamp: Date.now(),
        version: '1.0'
      };

      if (typeof chrome !== 'undefined' && chrome.storage) {
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ 'cached_models': cacheData }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
      } else {
        localStorage.setItem('cached_models', JSON.stringify(cacheData));
      }
      
      console.log('💾 Modelos salvos no cache');
    } catch (error) {
      console.error('❌ Erro ao salvar cache:', error);
    }
  }

  async getCachedModels() {
    try {
      let cacheData;
      
      if (typeof chrome !== 'undefined' && chrome.storage) {
        cacheData = await new Promise((resolve) => {
          chrome.storage.local.get(['cached_models'], (result) => {
            resolve(result.cached_models);
          });
        });
      } else {
        const cached = localStorage.getItem('cached_models');
        cacheData = cached ? JSON.parse(cached) : null;
      }

      if (cacheData && cacheData.models && Array.isArray(cacheData.models)) {
        console.log('📦 Modelos carregados do cache:', cacheData.models.length);
        return cacheData.models;
      }
      
      return [];
    } catch (error) {
      console.error('❌ Erro ao carregar cache:', error);
      return [];
    }
  }

  async saveLastUpdateTime(timestamp) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await new Promise((resolve) => {
          chrome.storage.local.set({ 'models_last_update': timestamp }, resolve);
        });
      } else {
        localStorage.setItem('models_last_update', timestamp.toString());
      }
    } catch (error) {
      console.error('❌ Erro ao salvar timestamp:', error);
    }
  }

  async getLastUpdateTime() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        return await new Promise((resolve) => {
          chrome.storage.local.get(['models_last_update'], (result) => {
            resolve(result.models_last_update || null);
          });
        });
      } else {
        const lastUpdate = localStorage.getItem('models_last_update');
        return lastUpdate ? parseInt(lastUpdate) : null;
      }
    } catch (error) {
      console.error('❌ Erro ao carregar timestamp:', error);
      return null;
    }
  }

  getModelStats() {
    const stats = {
      total: this.models.length,
      categories: {},
      popular: this.getPopularModels().length,
      filtered: this.filteredModels.length
    };

    this.models.forEach(model => {
      stats.categories[model.category] = (stats.categories[model.category] || 0) + 1;
    });

    return stats;
  }

  async clearCache() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await new Promise((resolve) => {
          chrome.storage.local.remove(['cached_models', 'models_last_update'], resolve);
        });
      } else {
        localStorage.removeItem('cached_models');
        localStorage.removeItem('models_last_update');
      }
      
      this.models = [];
      this.filteredModels = [];
      console.log('🗑️ Cache limpo');
    } catch (error) {
      console.error('❌ Erro ao limpar cache:', error);
    }
  }
}

// Instância global
window.modelsManager = new ModelsManager();