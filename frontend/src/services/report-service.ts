'use client';

import { apiService } from './api-service';
import { CreateErrandPayload } from '@interfaces/errand.types';

interface SubmitErrandResult {
  id: string;
  errandNumber?: string;
}

export const submitErrand = async (
  payload: CreateErrandPayload,
  images: File[]
): Promise<SubmitErrandResult> => {
  const formData = new FormData();
  formData.append('errand', JSON.stringify(payload));
  images.forEach((file) => formData.append('images', file));

  const res = await apiService.postFormData<SubmitErrandResult>('errands', formData);
  return res.data;
};
