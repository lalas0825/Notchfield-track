import { z } from 'zod';

export const CreatePunchItemSchema = z.object({
  areaId: z.string().uuid('Invalid area ID'),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  photos: z.array(z.string()).min(1, 'At least one photo is required'),
  assignedTo: z.string().uuid().optional(),
  planX: z.number().optional(),
  planY: z.number().optional(),
  drawingId: z.string().uuid().optional(),
});

export type CreatePunchItemInput = z.infer<typeof CreatePunchItemSchema>;
