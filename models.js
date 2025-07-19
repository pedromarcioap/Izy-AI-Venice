// Sistema de gerenciamento de modelos OpenRouter
class ModelsManager {
  constructor() {
    this.models = [];
    this.filteredModels = [];
    this.lastUpdate = null;
    this.updateInterval = 24 * 60 * 60 * 1000; // 24 horas
  }

  async fetchModels(apiKey) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin || 'chrome-extension://',
          'X-Title': 'Izy AI Venice'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ao buscar modelos: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Erro ao buscar modelos:', error);
      throw error;
    }
  }

  async syncModels(apiKey, forceUpdate = false) {
    const now = Date.now();
    const lastUpdate = this.getLastUpdateTime();

    // Verifica se precisa atualizar
    if (!forceUpdate && lastUpdate && (now - lastUpdate) < this.updateInterval) {
      this.models = this.getCachedModels();
      return this.models;
    }

    try {
      const models = await this.fetchModels(apiKey);
      
      // Processa e organiza os modelos
      this.models = models
        .filter(model => model.id && model.name)
        .map(model => ({
          id: model.id,
          name: model.name,
          description: model.description || '',
          context_length: model.context_length || 0,
          pricing: model.pricing || {},
          top_provider: model.top_provider || {},
          architecture: model.architecture || {},
          created: model.created || 0
        }))
        .sort((a, b) => {
          // Ordena por popularidade/qualidade (baseado no top_provider)
          const aScore = (a.top_provider.max_completion_tokens || 0) + (a.context_length || 0);
          const bScore = (b.top_provider.max_completion_tokens || 0) + (b.context_length || 0);
          return bScore - aScore;
        });

      // Salva no cache
      this.saveModelsToCache(this.models);
      this.saveLastUpdateTime(now);
      
      return this.models;
    } catch (error) {
      // Se falhar, tenta usar cache
      this.models = this.getCachedModels();
      throw error;
    }
  }

  searchModels(query) {
    if (!query || query.trim() === '') {
      this.filteredModels = this.models;
      return this.filteredModels;
    }

    const searchTerm = query.toLowerCase().trim();
    this.filteredModels = this.models.filter(model => 
      model.name.toLowerCase().includes(searchTerm) ||
      model.id.toLowerCase().includes(searchTerm) ||
      (model.description && model.description.toLowerCase().includes(searchTerm))
    );

    return this.filteredModels;
  }

  getPopularModels() {
    // Retorna os modelos mais populares/recomendados
    const popularIds = [
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'openai/gpt-4',
      'anthropic/claude-3-haiku',
      'meta-llama/llama-3.1-8b-instruct',
      'google/gemini-pro',
      'mistralai/mixtral-8x7b-instruct'
    ];

    return this.models.filter(model => 
      popularIds.includes(model.id)
    ).sort((a, b) => {
      const aIndex = popularIds.indexOf(a.id);
      const bIndex = popularIds.indexOf(b.id);
      return aIndex - bIndex;
    });
  }

  // Métodos de cache
  saveModelsToCache(models) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ 'cached_models': models });
    } else {
      localStorage.setItem('cached_models', JSON.stringify(models));
    }
  }

  getCachedModels() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['cached_models'], (result) => {
          resolve(result.cached_models || []);
        });
      });
    } else {
      const cached = localStorage.getItem('cached_models');
      return cached ? JSON.parse(cached) : [];
    }
  }

  saveLastUpdateTime(timestamp) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ 'models_last_update': timestamp });
    } else {
      localStorage.setItem('models_last_update', timestamp.toString());
    }
  }

  getLastUpdateTime() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['models_last_update'], (result) => {
          resolve(result.models_last_update || null);
        });
      });
    } else {
      const lastUpdate = localStorage.getItem('models_last_update');
      return lastUpdate ? parseInt(lastUpdate) : null;
    }
  }

  formatModelForDisplay(model) {
    const contextLength = model.context_length ? `${(model.context_length / 1000).toFixed(0)}k` : '';
    const pricing = model.pricing?.prompt ? `$${(model.pricing.prompt * 1000000).toFixed(2)}/1M` : '';
    
    return {
      ...model,
      displayName: model.name,
      subtitle: [contextLength, pricing].filter(Boolean).join(' • '),
      category: this.getModelCategory(model.id)
    };
  }

  getModelCategory(modelId) {
    if (modelId.includes('claude')) return 'Anthropic';
    if (modelId.includes('gpt') || modelId.includes('openai')) return 'OpenAI';
    if (modelId.includes('llama')) return 'Meta';
    if (modelId.includes('gemini') || modelId.includes('google')) return 'Google';
    if (modelId.includes('mistral')) return 'Mistral';
    return 'Outros';
  }
}

// Instância global
window.modelsManager = new ModelsManager();