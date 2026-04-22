import { requestUrl } from 'obsidian';
import { LocalAISettings } from '../settings';

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: {
    start: number;
    end: number;
    text: string;
  }[];
}

export interface VoiceInputOptions {
  language?: string;
  translate?: boolean;
  timestamps?: boolean;
}

export class VoiceInput {
  private settings: LocalAISettings;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording: boolean = false;

  constructor(settings: LocalAISettings) {
    this.settings = settings;
  }

  updateSettings(settings: LocalAISettings): void {
    this.settings = settings;
  }

  async startRecording(): Promise<void> {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus',
    });

    this.audioChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(1000); // Collect data every second
    this.isRecording = true;
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('Not recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.audioChunks = [];
        this.isRecording = false;

        // Stop all tracks
        this.mediaRecorder?.stream.getTracks().forEach(track => track.stop());
        this.mediaRecorder = null;

        resolve(audioBlob);
      };

      this.mediaRecorder.onerror = (event) => {
        reject(new Error('Recording error'));
      };

      this.mediaRecorder.stop();
    });
  }

  cancelRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.mediaRecorder = null;
      this.audioChunks = [];
      this.isRecording = false;
    }
  }

  getRecordingState(): boolean {
    return this.isRecording;
  }

  async transcribe(audioBlob: Blob, options?: VoiceInputOptions): Promise<TranscriptionResult> {
    // Convert blob to base64 for API
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64Audio = this.arrayBufferToBase64(arrayBuffer);

    // Use local Whisper API (via Ollama or compatible service)
    const whisperUrl = this.settings.whisperUrl || 'http://localhost:8080/inference';

    try {
      // Try Whisper.cpp compatible API first
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');

      if (options?.language) {
        formData.append('language', options.language);
      }
      if (options?.translate) {
        formData.append('translate', 'true');
      }

      const response = await fetch(whisperUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Whisper API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        text: data.text || data.transcription || '',
        language: data.language,
        duration: data.duration,
        segments: data.segments,
      };
    } catch (error) {
      console.error('Transcription failed:', error);

      // Fallback: Try OpenAI-compatible API
      try {
        return await this.transcribeOpenAICompatible(audioBlob, options);
      } catch (fallbackError) {
        throw new Error(`Transcription failed: ${(error as Error).message}`);
      }
    }
  }

  private async transcribeOpenAICompatible(
    audioBlob: Blob,
    options?: VoiceInputOptions
  ): Promise<TranscriptionResult> {
    const baseUrl = this.settings.customApiUrl || 'http://localhost:1234';
    const apiKey = this.settings.customApiKey;

    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model', 'whisper-1');

    if (options?.language) {
      formData.append('language', options.language);
    }

    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      text: data.text || '',
      language: options?.language,
    };
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  async transcribeFile(filePath: string): Promise<TranscriptionResult> {
    // This would need vault access to read the file
    throw new Error('File transcription not implemented - use audio blob instead');
  }

  // Utility to check if browser supports required APIs
  static isSupported(): boolean {
    return !!(
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      window.MediaRecorder
    );
  }

  // Request microphone permission
  static async requestPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  }
}

// Voice command handler
export class VoiceCommands {
  private voiceInput: VoiceInput;
  private commands: Map<string, () => void> = new Map();

  constructor(voiceInput: VoiceInput) {
    this.voiceInput = voiceInput;
  }

  registerCommand(phrase: string, callback: () => void): void {
    this.commands.set(phrase.toLowerCase(), callback);
  }

  async processVoiceCommand(audioBlob: Blob): Promise<string | null> {
    const result = await this.voiceInput.transcribe(audioBlob);
    const text = result.text.toLowerCase().trim();

    for (const [phrase, callback] of this.commands) {
      if (text.includes(phrase)) {
        callback();
        return phrase;
      }
    }

    return null;
  }

  getRegisteredCommands(): string[] {
    return Array.from(this.commands.keys());
  }
}
