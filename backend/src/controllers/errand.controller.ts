import { MUNICIPALITY_ID, NAMESPACE } from '@/config';
import { getApiBase } from '@/config/api-config';
import { HttpException } from '@/exceptions/http.exception';
import ApiService from '@/services/api.service';
import ApiTokenService from '@/services/api-token.service';
import ClassifyService from '@/services/classify.service';
import { logger } from '@/utils/logger';
import { apiURL } from '@/utils/util';
import axios from 'axios';
import { Request, Response } from 'express';
import { Controller, Get, Param, Post, Req, Res, UseBefore } from 'routing-controllers';
import multer from 'multer';
import FormData from 'form-data';
import proj4 from 'proj4';

// SWEREF99 TM (EPSG:3006)
proj4.defs('EPSG:3006', '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

interface ErrandFromApi {
  id: string;
  errandNumber?: string;
  title?: string;
  description?: string;
  status: string;
  created: string;
  classification?: { category?: string; type?: string };
  parameters?: { key: string; values: string[] }[];
}

interface ErrandsApiResponse {
  content: ErrandFromApi[];
  totalElements: number;
}

const MAX_UPLOAD_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_FILE_SIZE_BYTES,
    files: 10,
  },
  fileFilter: (_req, file, callback) => {
    if (ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new HttpException(400, 'Only image files are allowed'));
  },
});

@Controller()
export class ErrandController {
  private apiService = new ApiService();
  private apiTokenService = new ApiTokenService();
  private classifyService = new ClassifyService();
  private apiBase = getApiBase('supportmanagement');
  private errandBasePath = `${MUNICIPALITY_ID}/${NAMESPACE}/errands`;

  private async rollbackErrand(errandId: string): Promise<boolean> {
    try {
      await this.apiService.delete<unknown>({
        baseURL: apiURL(this.apiBase),
        url: `${this.errandBasePath}/${errandId}`,
      });
      logger.warn(`Rolled back errand ${errandId} after attachment upload failure`);
      return true;
    } catch (error) {
      if (error instanceof HttpException && error.status === 404) {
        // Treat as rolled back/already removed.
        return true;
      }

      logger.error(`Failed to rollback errand ${errandId}: ${JSON.stringify(error).slice(0, 300)}`);
      return false;
    }
  }

  @Post('/errands')
  @UseBefore(upload.array('images'))
  async createErrand(@Req() req: Request, @Res() response: Response): Promise<Response> {
    try {
      if (typeof req.body?.errand !== 'string') {
        throw new HttpException(400, 'Missing errand payload');
      }

      let errandData: Record<string, unknown>;
      try {
        errandData = JSON.parse(req.body.errand) as Record<string, unknown>;
      } catch (_error) {
        throw new HttpException(400, 'Invalid errand payload');
      }

      const files = (req.files as Express.Multer.File[]) || [];

      // Convert EPSG:3006 coordinates to WGS84 if present
      const parameters = errandData.parameters as { key: string; values: string[] }[] | undefined;
      if (parameters) {
        const coordParam = parameters.find(p => p.key === 'coordinates');
        const crsParam = parameters.find(p => p.key === 'coordinates_crs');

        if (coordParam && crsParam?.values[0] === 'EPSG:3006') {
          const [xStr, yStr] = coordParam.values[0].split(',');
          const x = parseFloat(xStr);
          const y = parseFloat(yStr);

          if (!isNaN(x) && !isNaN(y)) {
            const [lng, lat] = proj4('EPSG:3006', 'WGS84', [x, y]);
            coordParam.values = [`${lat},${lng}`];
          }

          // Remove the crs metadata param — no longer needed after conversion
          errandData.parameters = parameters.filter(p => p.key !== 'coordinates_crs');
        }
      }

      // AI classification (graceful fallback)
      const firstImage = files.length > 0 ? files[0] : undefined;
      const errandDescription = typeof errandData.description === 'string'
        ? errandData.description : undefined;
      const aiType = await this.classifyService.classify(firstImage, errandDescription);

      errandData.classification = {
        category: 'FELANMALAN',
        type: aiType,
      };

      // Fixed application ID used as reporterUserId for all anonymous fault reports
      const REPORTER_USER_ID = 'd4e5f6a7-b8c9-4d0e-a1f2-3b4c5d6e7f80';

      const payload = {
        ...errandData,
        reporterUserId: REPORTER_USER_ID,
        channel: 'ESERVICE_EXTERNAL',
        status: 'NEW',
      };

      logger.info(`Creating errand: classification=${aiType}, images=${files.length}`);

      // 1. Create the errand
      const errandRes = await this.apiService.post<{ id: string; errandNumber?: string }>({
        baseURL: apiURL(this.apiBase),
        url: this.errandBasePath,
        data: payload,
      });

      const errandId = errandRes.data.id;
      const errandNumber = errandRes.data.errandNumber;
      if (!errandId) {
        throw new HttpException(502, 'Errand creation failed');
      }

      // 2. Upload attachments
      try {
        for (const file of files) {
          const formData = new FormData();
          formData.append('errandAttachment', file.buffer, {
            filename: file.originalname,
            contentType: file.mimetype,
          });

          await this.apiService.post<unknown>({
            baseURL: apiURL(this.apiBase),
            url: `${this.errandBasePath}/${errandId}/attachments`,
            data: formData,
            headers: formData.getHeaders(),
          });
        }
      } catch (error) {
        const rolledBack = await this.rollbackErrand(errandId);
        if (!rolledBack) {
          throw new HttpException(502, 'Attachment upload failed and rollback failed');
        }
        throw new HttpException(502, 'Attachment upload failed');
      }

      return response.status(201).json({ id: errandId, errandNumber });
    } catch (error) {
      if (error instanceof HttpException) {
        return response.status(error.status).json({ message: error.message });
      }

      logger.error(`Error creating errand: ${JSON.stringify(error).slice(0, 300)}`);
      return response.status(502).json({ message: 'Failed to create errand' });
    }
  }

  @Get('/errands')
  async getActiveErrands(@Res() response: Response): Promise<Response> {
    try {
      const res = await this.apiService.get<ErrandsApiResponse>({
        baseURL: apiURL(this.apiBase),
        url: this.errandBasePath,
        params: {
          filter: "status:'NEW' or status:'ONGOING'",
          size: 200,
        },
      });

      const errands = (res.data.content || [])
        .filter(errand => errand.classification?.category === 'FELANMALAN')
        .map(errand => {
          const coordParam = errand.parameters?.find(p => p.key === 'coordinates');
          let coordinates: { x: number; y: number } | null = null;

          if (coordParam?.values[0]) {
            const [latStr, lngStr] = coordParam.values[0].split(',');
            const lat = parseFloat(latStr);
            const lng = parseFloat(lngStr);

            if (!isNaN(lat) && !isNaN(lng)) {
              // WGS84 (lat,lng) → EPSG:3006 (easting, northing)
              const [x, y] = proj4('WGS84', 'EPSG:3006', [lng, lat]);
              coordinates = { x, y };
            }
          }

          return {
            id: errand.id,
            errandNumber: errand.errandNumber,
            title: errand.title,
            description: errand.description,
            status: errand.status,
            created: errand.created,
            coordinates,
          };
        }).filter(e => e.coordinates !== null);

      return response.json({ errands });
    } catch (error) {
      if (error instanceof HttpException) {
        return response.status(error.status).json({ message: error.message });
      }

      logger.error(`Error fetching errands: ${JSON.stringify(error).slice(0, 300)}`);
      return response.status(502).json({ message: 'Failed to fetch errands' });
    }
  }

  @Get('/errands/:errandId/attachments/:attachmentId')
  async getAttachment(
    @Param('errandId') errandId: string,
    @Param('attachmentId') attachmentId: string,
    @Res() response: Response,
  ): Promise<Response> {
    try {
      const token = await this.apiTokenService.getToken();

      const url = apiURL(this.apiBase, `${this.errandBasePath}/${errandId}/attachments/${attachmentId}`);
      const res = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Sent-By': 'felanmalan-app',
        },
      });

      const contentType = res.headers['content-type'] || 'application/octet-stream';
      response.set('Content-Type', contentType);
      response.set('Cache-Control', 'public, max-age=3600');
      return response.send(Buffer.from(res.data));
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status) {
        return response.status(error.response.status === 404 ? 404 : 502).json({ message: 'Attachment not found' });
      }

      logger.error(`Error fetching attachment: ${JSON.stringify(error).slice(0, 300)}`);
      return response.status(502).json({ message: 'Failed to fetch attachment' });
    }
  }
}
