import { NextFunction, Request, Response } from 'express';
import { HttpException } from '@exceptions/http.exception';
import { logger } from '@utils/logger';
import multer from 'multer';

function sanitizeLogInput(input: string): string {
  return input.replace(/[\r\n]/g, '');
}

const mapKnownError = (error: unknown): HttpException => {
  if (error instanceof HttpException) {
    return error;
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return new HttpException(413, 'Each file can be at most 25MB');
    }

    return new HttpException(400, error.message);
  }

  logger.error(`Unhandled error type: ${error?.constructor?.name}, details: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object)).slice(0, 500)}`);
  return new HttpException(500, 'Something went wrong');
};

const errorMiddleware = (error: unknown, req: Request, res: Response, next: NextFunction) => {
  try {
    const mappedError = mapKnownError(error);
    const status: number = mappedError.status;
    const message: string = mappedError.message;

    const safeMethod = sanitizeLogInput(String(req.method));
    const safePath = sanitizeLogInput(String(req.path));
    const safeMessage = sanitizeLogInput(String(message));

    logger.error(`[${safeMethod}] ${safePath} >> StatusCode:: ${status}, Message:: ${safeMessage}`);
    res.status(status).json({ message });
  } catch (error) {
    next(error);
  }
};

export default errorMiddleware;
