export interface ErrandMarker {
  id: string;
  errandNumber?: string;
  title?: string;
  description?: string;
  classificationType?: string;
  status: string;
  created: string;
  touched?: string;
  coordinates: { x: number; y: number };
}
