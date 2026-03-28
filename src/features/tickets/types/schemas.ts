import { z } from 'zod';

export const CreateTicketSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).default(''),
  floor: z.string().nullable().default(null),
  area: z.string().nullable().default(null),
  photos: z.array(z.string().url()).default([]),
  status: z.enum(['draft', 'submitted', 'reviewed', 'closed']).default('draft'),
});

export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;
