import { getApiBase } from '@/config/api-config';
import ApiService from '@/services/api.service';
import { apiURL } from '@/utils/util';
import { logger } from '@/utils/logger';
import FormData from 'form-data';
import sharp from 'sharp';

// Max dimension (px) for images sent to the AI model for classification.
// Mobile cameras produce 4K-8K images (5-15MB) but the vision model only needs
// enough detail to distinguish fault types. 1080px keeps file size low (~50-150KB)
// which speeds up the Eneo upload and reduces processing time, while retaining
// sufficient detail for accurate classification. The original full-res image is
// still uploaded unmodified as the errand attachment.
const CLASSIFY_IMAGE_MAX_DIMENSION = 1080;

export const CLASSIFICATION_CATEGORIES = [
  'ROAD_DAMAGE',
  'LIGHTING',
  'WATER_SEWER',
  'PARK_MAINTENANCE',
  'GRAFFITI_VANDALISM',
  'SNOW_ICE',
  'TRAFFIC_SIGNS',
  'PLAYGROUND_EQUIPMENT',
  'WASTE_LITTERING',
  'SIDEWALK_CYCLING',
  'OTHER',
] as const;

export const DEFAULT_TYPE = 'OTHER';

interface IntricFileResponse {
  id: string;
}

interface IntricSessionResponse {
  answer: string;
}

class ClassifyService {
  private apiService = new ApiService();
  private apiBase = apiURL(getApiBase('eneo-sundsvall'));
  private assistantId = process.env.ENEO_ASSISTANT_ID;
  private apiKey = process.env.ENEO_API_KEY;

  async classify(
    image: Express.Multer.File | undefined,
    description: string | undefined,
  ): Promise<string> {
    try {
      if (!this.assistantId || !this.apiKey) {
        logger.info('AI classification skipped: ENEO_ASSISTANT_ID or ENEO_API_KEY not configured');
        return DEFAULT_TYPE;
      }

      if (!image && !description) {
        logger.info('AI classification skipped: no image or description provided');
        return DEFAULT_TYPE;
      }

      const fileIds: string[] = [];
      if (image) {
        const fileId = await this.uploadFile(image);
        if (fileId) {
          fileIds.push(fileId);
        }
      }

      const question = this.buildQuestion(description);
      const answer = await this.askAssistant(question, fileIds);

      if (!answer) {
        return DEFAULT_TYPE;
      }

      const category = this.parseCategory(answer);
      logger.info(`AI classification result: "${category}"`);
      return category;
    } catch (error) {
      logger.error(`AI classification failed, using default: ${JSON.stringify(error).slice(0, 300)}`);
      return DEFAULT_TYPE;
    }
  }

  private async resizeForClassification(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .resize(CLASSIFY_IMAGE_MAX_DIMENSION, CLASSIFY_IMAGE_MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();
  }

  private async uploadFile(file: Express.Multer.File): Promise<string | null> {
    try {
      const resized = await this.resizeForClassification(file.buffer);
      logger.info(`Eneo image resized: ${(file.buffer.length / 1024).toFixed(0)}KB → ${(resized.length / 1024).toFixed(0)}KB`);

      const formData = new FormData();
      formData.append('upload_file', resized, {
        filename: file.originalname,
        contentType: 'image/jpeg',
      });

      logger.info(`Eneo file upload → ${this.apiBase}/files/`);

      const res = await this.apiService.post<IntricFileResponse>({
        baseURL: this.apiBase,
        url: 'files/',
        data: formData,
        headers: { ...formData.getHeaders(), 'api-key': this.apiKey },
        timeout: 30000,
      });

      logger.info(`Eneo file upload OK, id: ${res.data.id}`);
      return res.data.id;
    } catch (error) {
      logger.warn(`Eneo file upload failed, continuing without image: ${JSON.stringify(error).slice(0, 300)}`);
      return null;
    }
  }

  private async askAssistant(question: string, fileIds: string[]): Promise<string | null> {
    try {
      const files = fileIds.map(id => ({ id }));

      const res = await this.apiService.post<IntricSessionResponse>({
        baseURL: this.apiBase,
        url: `assistants/${this.assistantId}/sessions/`,
        data: { question, files, stream: false },
        headers: { 'api-key': this.apiKey },
        timeout: 30000,
      });

      return res.data.answer;
    } catch (error) {
      logger.error(`Eneo assistant request failed: ${JSON.stringify(error).slice(0, 300)}`);
      return null;
    }
  }

  private buildQuestion(description: string | undefined): string {
    if (description) {
      return `Classify this fault report. Description: "${description}". Respond with ONLY the category code.`;
    }
    return 'Classify this fault report based on the image. Respond with ONLY the category code.';
  }

  private parseCategory(answer: string): string {
    const cleaned = answer.trim().replace(/['"]/g, '').toUpperCase();

    // Exact match
    const exactMatch = CLASSIFICATION_CATEGORIES.find(cat => cat === cleaned);
    if (exactMatch) {
      return exactMatch;
    }

    // Substring match
    const substringMatch = CLASSIFICATION_CATEGORIES.find(cat => cleaned.includes(cat));
    if (substringMatch) {
      return substringMatch;
    }

    return 'OTHER';
  }
}

export default ClassifyService;
