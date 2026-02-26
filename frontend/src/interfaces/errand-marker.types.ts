export interface ErrandMarker {
  id: string;
  errandNumber?: string;
  title?: string;
  description?: string;
  status: string;
  created: string;
  coordinates: { x: number; y: number };
}
