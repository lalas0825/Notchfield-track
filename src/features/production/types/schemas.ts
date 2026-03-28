import { z } from 'zod';

export const DailyReportSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  organizationId: z.string().uuid('Invalid organization ID'),
  foremanId: z.string().uuid('Invalid foreman ID'),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  areasWorked: z.array(z.string()).min(1, 'At least one area required'),
  progressSummary: z.string().max(5000).default(''),
  totalManHours: z.number().nonnegative(),
  photosCount: z.number().int().nonnegative(),
});

export type DailyReportInput = z.infer<typeof DailyReportSchema>;
