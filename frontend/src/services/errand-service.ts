'use client';

import { apiService } from './api-service';
import { ErrandMarker } from '@interfaces/errand-marker.types';

interface ErrandsResponse {
  errands: ErrandMarker[];
}

export const fetchActiveErrands = async (): Promise<ErrandMarker[]> => {
  const res = await apiService.get<ErrandsResponse>('errands');
  return res.data.errands;
};
