import { z } from 'zod';

export const explainBody = z.object({
  mode: z.enum(['simple', 'detailed']).default('simple'),
});

export const chatBody = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1, 'Message cannot be empty.').max(1000, 'Message is too long.'),
      })
    )
    .min(1)
    .max(12, 'The conversation is too long. Start a new chat.')
    .refine((messages) => messages.length > 0 && messages[messages.length - 1].role === 'user', {
      message: 'The last message must come from the user.',
    }),
});
