'use client';

import { create } from 'zustand';

export type WizardStep = 0 | 1 | 2;

interface WizardState {
  currentStep: WizardStep;

  // Images
  images: File[];
  imagePreviews: string[];

  // Map / Location (EPSG:3006)
  mapLocation: { x: number; y: number } | null;

  // Description
  description: string;

  // Contact (optional)
  email: string;
  phone: string;

  // Submit
  submitState: 'idle' | 'submitting' | 'success' | 'error';
  submitError: string | null;
  errandId: string | null;
  errandNumber: string | null;

  // Navigation
  goToStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;

  // Data setters
  addImages: (files: File[]) => void;
  removeImage: (index: number) => void;
  setMapLocation: (location: { x: number; y: number } | null) => void;
  setDescription: (description: string) => void;
  setEmail: (email: string) => void;
  setPhone: (phone: string) => void;
  setSubmitState: (state: 'idle' | 'submitting' | 'success' | 'error') => void;
  setSubmitError: (error: string | null) => void;
  setErrandId: (id: string | null) => void;
  setErrandNumber: (errandNumber: string | null) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  currentStep: 0 as WizardStep,
  images: [] as File[],
  imagePreviews: [] as string[],
  mapLocation: null as { x: number; y: number } | null,
  description: '',
  email: '',
  phone: '',
  submitState: 'idle' as const,
  submitError: null as string | null,
  errandId: null as string | null,
  errandNumber: null as string | null,
};

export const useWizardStore = create<WizardState>()((set, get) => ({
  ...initialState,

  goToStep: (step) => set({ currentStep: step }),
  nextStep: () => {
    const current = get().currentStep;
    if (current < 2) set({ currentStep: (current + 1) as WizardStep });
  },
  prevStep: () => {
    const current = get().currentStep;
    if (current > 0) set({ currentStep: (current - 1) as WizardStep });
  },

  addImages: (files) => {
    const current = get();
    const newImages = [...current.images, ...files];
    const newPreviews = [...current.imagePreviews, ...files.map((f) => URL.createObjectURL(f))];
    set({ images: newImages, imagePreviews: newPreviews });
  },
  removeImage: (index) => {
    const current = get();
    const preview = current.imagePreviews[index];
    if (preview) URL.revokeObjectURL(preview);
    set({
      images: current.images.filter((_, i) => i !== index),
      imagePreviews: current.imagePreviews.filter((_, i) => i !== index),
    });
  },
  setMapLocation: (location) => set({ mapLocation: location }),
  setDescription: (description) => set({ description }),
  setEmail: (email) => set({ email }),
  setPhone: (phone) => set({ phone }),
  setSubmitState: (state) => set({ submitState: state }),
  setSubmitError: (error) => set({ submitError: error }),
  setErrandId: (id) => set({ errandId: id }),
  setErrandNumber: (errandNumber) => set({ errandNumber }),

  reset: () => {
    // Revoke all object URLs before resetting
    const current = get();
    current.imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    set(initialState);
  },
}));
