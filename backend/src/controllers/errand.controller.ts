import { MUNICIPALITY_ID, NAMESPACE } from '@/config';
import { getApiBase } from '@/config/api-config';
import { HttpException } from '@/exceptions/http.exception';
import ApiService from '@/services/api.service';
import { logger } from '@/utils/logger';
import { apiURL } from '@/utils/util';
import { Request, Response } from 'express';
import { Controller, Post, Req, Res, UseBefore } from 'routing-controllers';
import multer from 'multer';
import FormData from 'form-data';
import proj4 from 'proj4';

// SWEREF99 TM (EPSG:3006)
proj4.defs('EPSG:3006', '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

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

      // Fixed application ID used as reporterUserId for all anonymous fault reports
      const REPORTER_USER_ID = 'd4e5f6a7-b8c9-4d0e-a1f2-3b4c5d6e7f80';

      const payload = {
        ...errandData,
        reporterUserId: REPORTER_USER_ID,
        channel: 'ESERVICE_EXTERNAL',
        status: 'NEW',
      };

      // TODO: Remove after verifying coordinate transform
      logger.info(`Errand payload: ${JSON.stringify(payload, null, 2)}`);

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
}
