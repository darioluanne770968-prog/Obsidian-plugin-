import { requestUrl, RequestUrlParam } from 'obsidian';
import { LocalAISettings } from '../settings';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[]; // base64 encoded images for vision models
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface StreamCallback {
  onToken: (token: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
}

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
}

export class AIService {
  private settings: LocalAISettings;

  constructor(settings: LocalAISettings) {
    this.settings = settings;
  }

  updateSettings(settings: LocalAISettings) {
    this.settings = settings;
  }

  private getBaseUrl(): string {
    switch (this.settings.provider) {
      case 'ollama':
        return this.settings.ollamaUrl || 'http://localhost:11434';
      case 'lmstudio':
        return this.settings.lmStudioUrl || 'http://localhost:1234';
      case 'custom':
        return this.settings.customApiUrl || '';
      default:
        return 'http://localhost:11434';
    }
  }

  private getApiEndpoint(): string {
    const baseUrl = this.getBaseUrl();
    switch (this.settings.provider) {
      case 'ollama':
        return `${baseUrl}/api/chat`;
      case 'lmstudio':
      case 'custom':
        return `${baseUrl}/v1/chat/completions`;
      default:
        return `${baseUrl}/api/chat`;
    }
  }

  private getEmbeddingEndpoint(): string {
    const baseUrl = this.getBaseUrl();
    switch (this.settings.provider) {
      case 'ollama':
        return `${baseUrl}/api/embeddings`;
      case 'lmstudio':
      case 'custom':
        return `${baseUrl}/v1/embeddings`;
      default:
        return `${baseUrl}/api/embeddings`;
    }
  }

  async chat(messages: ChatMessage[], options?: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  }): Promise<AIResponse> {
    const model = options?.model || this.settings.model;
    const temperature = options?.temperature ?? this.settings.temperature;
    const maxTokens = options?.maxTokens ?? this.settings.maxTokens;

    if (this.settings.provider === 'ollama') {
      return this.chatOllama(messages, model, temperature, maxTokens);
    } else {
      return this.chatOpenAICompatible(messages, model, temperature, maxTokens);
    }
  }

  private async chatOllama(
    messages: ChatMessage[],
    model: string,
    temperature: number,
    maxTokens: number
  ): Promise<AIResponse> {
    const response = await requestUrl({
      url: this.getApiEndpoint(),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature,
          num_predict: maxTokens,
        },
      }),
    });

    const data = response.json;
    return {
      content: data.message?.content || '',
      model: data.model || model,
      usage: data.prompt_eval_count ? {
        prompt_tokens: data.prompt_eval_count,
        completion_tokens: data.eval_count || 0,
        total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      } : undefined,
    };
  }

  private async chatOpenAICompatible(
    messages: ChatMessage[],
    model: string,
    temperature: number,
    maxTokens: number
  ): Promise<AIResponse> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.settings.customApiKey) {
      headers['Authorization'] = `Bearer ${this.settings.customApiKey}`;
    }

    const response = await requestUrl({
      url: this.getApiEndpoint(),
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
    });

    const data = response.json;
    return {
      content: data.choices?.[0]?.message?.content || '',
      model: data.model || model,
      usage: data.usage,
    };
  }

  async chatStream(
    messages: ChatMessage[],
    callback: StreamCallback,
    options?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    }
  ): Promise<void> {
    const model = options?.model || this.settings.model;
    const temperature = options?.temperature ?? this.settings.temperature;
    const maxTokens = options?.maxTokens ?? this.settings.maxTokens;

    try {
      const baseUrl = this.getBaseUrl();
      let url: string;
      let body: any;

      if (this.settings.provider === 'ollama') {
        url = `${baseUrl}/api/chat`;
        body = {
          model,
          messages,
          stream: true,
          options: { temperature, num_predict: maxTokens },
        };
      } else {
        url = `${baseUrl}/v1/chat/completions`;
        body = {
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.settings.customApiKey && { 'Authorization': `Bearer ${this.settings.customApiKey}` }),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const token = parsed.choices?.[0]?.delta?.content || '';
              if (token) {
                fullResponse += token;
                callback.onToken(token);
              }
            } catch {
              // Ollama format
              try {
                const parsed = JSON.parse(line);
                const token = parsed.message?.content || '';
                if (token) {
                  fullResponse += token;
                  callback.onToken(token);
                }
              } catch {
                // ignore parse errors
              }
            }
          } else {
            // Try parsing as Ollama format
            try {
              const parsed = JSON.parse(line);
              const token = parsed.message?.content || '';
              if (token) {
                fullResponse += token;
                callback.onToken(token);
              }
            } catch {
              // ignore
            }
          }
        }
      }

      callback.onComplete(fullResponse);
    } catch (error) {
      callback.onError(error as Error);
    }
  }

  async getEmbedding(text: string, model?: string): Promise<EmbeddingResponse> {
    const embeddingModel = model || this.settings.embeddingModel || 'nomic-embed-text';

    if (this.settings.provider === 'ollama') {
      const response = await requestUrl({
        url: this.getEmbeddingEndpoint(),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: embeddingModel,
          prompt: text,
        }),
      });

      return {
        embedding: response.json.embedding,
        model: embeddingModel,
      };
    } else {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.settings.customApiKey) {
        headers['Authorization'] = `Bearer ${this.settings.customApiKey}`;
      }

      const response = await requestUrl({
        url: this.getEmbeddingEndpoint(),
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: embeddingModel,
          input: text,
        }),
      });

      return {
        embedding: response.json.data?.[0]?.embedding || [],
        model: embeddingModel,
      };
    }
  }

  async getEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse[]> {
    // Batch embedding for efficiency
    const results: EmbeddingResponse[] = [];
    for (const text of texts) {
      const result = await this.getEmbedding(text, model);
      results.push(result);
    }
    return results;
  }

  async listModels(): Promise<string[]> {
    try {
      const baseUrl = this.getBaseUrl();

      if (this.settings.provider === 'ollama') {
        const response = await requestUrl({
          url: `${baseUrl}/api/tags`,
          method: 'GET',
        });
        return response.json.models?.map((m: any) => m.name) || [];
      } else {
        const headers: Record<string, string> = {};
        if (this.settings.customApiKey) {
          headers['Authorization'] = `Bearer ${this.settings.customApiKey}`;
        }

        const response = await requestUrl({
          url: `${baseUrl}/v1/models`,
          method: 'GET',
          headers,
        });
        return response.json.data?.map((m: any) => m.id) || [];
      }
    } catch (error) {
      console.error('Failed to list models:', error);
      return [];
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string; models?: string[] }> {
    try {
      const models = await this.listModels();
      if (models.length > 0) {
        return {
          success: true,
          message: `Connected successfully. Found ${models.length} models.`,
          models,
        };
      } else {
        return {
          success: true,
          message: 'Connected but no models found. Please install a model.',
          models: [],
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${(error as Error).message}`,
      };
    }
  }

  // Vision support for image analysis
  async analyzeImage(
    imageBase64: string,
    prompt: string,
    model?: string
  ): Promise<AIResponse> {
    const visionModel = model || this.settings.visionModel || 'llava';

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: prompt,
        images: [imageBase64],
      },
    ];

    return this.chat(messages, { model: visionModel });
  }
}
