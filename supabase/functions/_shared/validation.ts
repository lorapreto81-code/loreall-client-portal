import { z } from "npm:zod";

export const phoneSchema = z.string()
  .min(10, "Número muito curto")
  .max(13, "Número muito longo")
  .regex(/^\d+$/, "Número deve conter apenas dígitos");

export const emailSchema = z.string()
  .email("E-mail inválido")
  .max(100, "E-mail muito longo");

export const identifierSchema = z.union([phoneSchema, emailSchema]);

export const otpCodeSchema = z.string()
  .length(6, "Código deve ter 6 dígitos")
  .regex(/^\d+$/, "Código deve conter apenas dígitos");

export const loginSchema = z.object({
  identifier: z.string().min(1).max(120),
  password: z.string().min(1).max(200),
});

export const otpRequestSchema = z.object({
  phone: z.string().min(1).max(120),
});

export const otpVerifySchema = z.object({
  phone: z.string().min(1).max(120),
  code: z.string().min(6).max(6),
});
