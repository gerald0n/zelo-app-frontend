import { z } from 'zod';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Payload das regras de agendamento de uma categoria (parcial: só o que mudou). */
export const categorySchedulingSchema = z
  .object({
    allowSameDay: z.boolean(),
    sameDayLeadMinutes: z.number().int().min(0).max(1440),
    weekdayEarliest: z.string().regex(HHMM).nullable(),
    weekendEarliest: z.string().regex(HHMM).nullable(),
    slotIntervalMinutes: z.number().int().min(5).max(240),
  })
  .partial();

export type CategorySchedulingPayload = z.infer<
  typeof categorySchedulingSchema
>;
