import { z } from 'zod';

export const globalSearchQuerySchema = z.object({
  q: z.string().trim().min(1),
});

export type GlobalSearchQueryDto = z.infer<typeof globalSearchQuerySchema>;
