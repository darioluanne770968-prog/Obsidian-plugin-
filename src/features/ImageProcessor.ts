import { TFile, Vault } from 'obsidian';
import { AIService } from '../services/AIService';

export interface OCRResult {
  text: string;
  confidence: number;
  language?: string;
}

export interface ImageAnalysis {
  description: string;
  objects: string[];
  text?: string;
  colors?: string[];
  scene?: string;
}

export class ImageProcessor {
  private aiService: AIService;
  private vault: Vault;

  constructor(aiService: AIService, vault: Vault) {
    this.aiService = aiService;
    this.vault = vault;
  }

  private async fileToBase64(file: TFile): Promise<string> {
    const arrayBuffer = await this.vault.readBinary(file);
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  async extractText(imageFile: TFile): Promise<OCRResult> {
    const base64 = await this.fileToBase64(imageFile);

    const response = await this.aiService.analyzeImage(
      base64,
      `Extract all text from this image. Return ONLY the extracted text, preserving the original layout as much as possible. If there's no text, say "No text found."`
    );

    const hasText = !response.content.toLowerCase().includes('no text found');

    return {
      text: response.content,
      confidence: hasText ? 0.9 : 0,
      language: undefined,
    };
  }

  async extractTextFromBase64(base64: string): Promise<OCRResult> {
    const response = await this.aiService.analyzeImage(
      base64,
      `Extract all text from this image. Return ONLY the extracted text, preserving the original layout. If no text, say "No text found."`
    );

    return {
      text: response.content,
      confidence: response.content.toLowerCase().includes('no text found') ? 0 : 0.9,
    };
  }

  async analyzeImage(imageFile: TFile): Promise<ImageAnalysis> {
    const base64 = await this.fileToBase64(imageFile);

    const response = await this.aiService.analyzeImage(
      base64,
      `Analyze this image and provide:
1. A detailed description of what you see
2. List of main objects/elements
3. Any text present
4. Dominant colors
5. Type of scene (indoor, outdoor, diagram, screenshot, etc.)

Format your response as:
DESCRIPTION: [description]
OBJECTS: [comma-separated list]
TEXT: [any text found, or "none"]
COLORS: [comma-separated list]
SCENE: [scene type]`
    );

    // Parse the response
    const content = response.content;
    const description = content.match(/DESCRIPTION:\s*(.+?)(?=OBJECTS:|$)/s)?.[1]?.trim() || '';
    const objectsMatch = content.match(/OBJECTS:\s*(.+?)(?=TEXT:|$)/s)?.[1]?.trim() || '';
    const textMatch = content.match(/TEXT:\s*(.+?)(?=COLORS:|$)/s)?.[1]?.trim() || '';
    const colorsMatch = content.match(/COLORS:\s*(.+?)(?=SCENE:|$)/s)?.[1]?.trim() || '';
    const sceneMatch = content.match(/SCENE:\s*(.+?)$/s)?.[1]?.trim() || '';

    return {
      description,
      objects: objectsMatch.split(',').map(s => s.trim()).filter(s => s),
      text: textMatch.toLowerCase() !== 'none' ? textMatch : undefined,
      colors: colorsMatch.split(',').map(s => s.trim()).filter(s => s),
      scene: sceneMatch,
    };
  }

  async describeImage(imageFile: TFile): Promise<string> {
    const base64 = await this.fileToBase64(imageFile);

    const response = await this.aiService.analyzeImage(
      base64,
      `Describe this image in detail. Focus on what's important and relevant. Write 2-3 sentences.`
    );

    return response.content;
  }

  async generateCaption(imageFile: TFile): Promise<string> {
    const base64 = await this.fileToBase64(imageFile);

    const response = await this.aiService.analyzeImage(
      base64,
      `Write a short, descriptive caption for this image. Keep it under 15 words.`
    );

    return response.content;
  }

  async generateAltText(imageFile: TFile): Promise<string> {
    const base64 = await this.fileToBase64(imageFile);

    const response = await this.aiService.analyzeImage(
      base64,
      `Write an accessibility-friendly alt text for this image. Be concise but descriptive. Include relevant text visible in the image.`
    );

    return response.content;
  }

  async interpretChart(imageFile: TFile): Promise<string> {
    const base64 = await this.fileToBase64(imageFile);

    const response = await this.aiService.analyzeImage(
      base64,
      `This appears to be a chart, graph, or diagram. Please:
1. Identify the type of visualization
2. Describe what data it represents
3. Summarize the key findings or trends
4. Note any important values or labels

If this is not a chart/graph, describe what you see instead.`
    );

    return response.content;
  }

  async convertDiagramToText(imageFile: TFile): Promise<string> {
    const base64 = await this.fileToBase64(imageFile);

    const response = await this.aiService.analyzeImage(
      base64,
      `Convert this diagram/flowchart into a textual description or markdown representation.
If it's a flowchart, describe the flow.
If it's a mind map, create a hierarchical list.
If it's an org chart, list the hierarchy.
If it's a process diagram, describe the steps.`
    );

    return response.content;
  }

  async extractTableData(imageFile: TFile): Promise<string> {
    const base64 = await this.fileToBase64(imageFile);

    const response = await this.aiService.analyzeImage(
      base64,
      `Extract the table data from this image and convert it to a markdown table.
If there's no table, describe what you see instead.`
    );

    return response.content;
  }

  async screenshotToNotes(imageFile: TFile): Promise<string> {
    const base64 = await this.fileToBase64(imageFile);

    const response = await this.aiService.analyzeImage(
      base64,
      `This is a screenshot. Extract useful information and convert it into organized notes:
1. Identify what application/website this is from (if identifiable)
2. Extract all important text content
3. Note any key UI elements or buttons visible
4. Summarize the main information

Format the output as clean markdown notes.`
    );

    return response.content;
  }

  isSupportedImage(file: TFile): boolean {
    const supportedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    return supportedExtensions.includes(file.extension.toLowerCase());
  }
}
