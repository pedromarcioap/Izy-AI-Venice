// Sistema de gerenciamento de modelos OpenRouter - VERSÃO CORRIGIDA
class ModelsManager {
  constructor() {
    this.models = [];
    this.filteredModels = [];
    this.isLoading = false;
  }

  async fetchModels(apiKey) {
    if (this.isLoading) return this.models;
    
    this.isLoading = true;
    console.log('🔄 Buscando modelos da OpenRouter...');
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Modelos recebidos:', data.data?.length || 0);
      
      this.models = (data.data || [])
        .filter(model => model.id && model.name)
        .map(model => ({
          id: model.id,
          name: model.name,
          description: model.description || '',
          context_length: model.context_length || 0,
          category: this.getModelCategory(model.id),
          isPopular: this.isPopularModel(model.id),
          displayName: this.formatDisplayName(model)
        }))
        .sort((a, b) => {
          if (a.isPopular && !b.isPopular) return -1;
          if (!a.isPopular && b.isPopular) return 1;
          return a.name.localeCompare(b.name);
        });

      this.filteredModels = [...this.models];
      console.log('📊 Modelos processados:', this.models.length);
      
      return this.models;
    } catch (error) {
      console.error('❌ Erro ao buscar modelos:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  formatDisplayName(model) {
    const contextLength = model.context_length ? ` (${(model.context_length / 1000).toFixed(0)}k)` : '';
    return `${model.name}${contextLength}`;
  }

  getModelCategory(modelId) {
    if (modelId.includes('claude') || modelId.includes('anthropic')) return 'Anthropic';
    if (modelId.includes('gpt') || modelId.includes('openai')) return 'OpenAI';
    if (modelId.includes('llama') || modelId.includes('meta')) return 'Meta';
    if (modelId.includes('gemini') || modelId.includes('google')) return 'Google';
    if (modelId.includes('mistral')) return 'Mistral';
    return 'Outros';
  }

  isPopularModel(modelId) {
    const popularIds = [
      'anthropic/claude-3.5-sonnet',
      'anthropic/claude-3-5-haiku',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'meta-llama/llama-3.1-405b-instruct',
      'meta-llama/llama-3.1-70b-instruct',
      'google/gemini-pro-1.5'
    ];
    return popularIds.includes(modelId);
  }

  searchModels(query) {
    if (!query || query.trim() === '') {
      this.filteredModels = [...this.models];
      return this.filteredModels;
    }

    const searchTerm = query.toLowerCase().trim();
    this.filteredModels = this.models.filter(model => 
      model.id.toLowerCase().includes(searchTerm) ||
      model.name.toLowerCase().includes(searchTerm) ||
      model.description.toLowerCase().includes(searchTerm)
    );

    console.log(`🔍 Busca por "${query}": ${this.filteredModels.length} resultados`);
    return this.filteredModels;
  }

  getPopularModels() {
    return this.models.filter(model => model.isPopular);
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
}

// Instância global
window.modelsManager = new ModelsManager();