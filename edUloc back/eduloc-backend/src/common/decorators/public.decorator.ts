import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marque une route comme accessible sans JWT (UC-A01, recherche B03...). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
