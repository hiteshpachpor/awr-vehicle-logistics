import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .default("postgres://awr:awr@localhost:5432/awr"),
});

export function getEnvironment() {
  return environmentSchema.parse(process.env);
}
