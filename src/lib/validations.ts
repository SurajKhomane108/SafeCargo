import { z } from "zod";

const SAFECARGO_PAYLOAD_VERSION = 1 as const;

export const safeCargoStatusEnum = z.enum([
  "NORMAL",
  "LOW",
  "MEDIUM",
  "WARNING",
  "HIGH",
  "CRITICAL",
]);

export const safeCargoEventTypeEnum = z.enum([
  "SHOCK",
  "TILT",
  "MOTION",
  "LIGHT",
]);

export const safeCargoSeverityEnum = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
]);

const eventCountsV1Schema = z.object({
  shock: z.number().int().min(0).default(0),
  tilt: z.number().int().min(0).default(0),
  light: z.number().int().min(0).default(0),
  motion: z.number().int().min(0).default(0),
});

const maxMeasurementsV1Schema = z.object({
  g: z.number().nullish(),
  tilt: z.number().nullish(),
  gyro: z.number().nullish(),
});

const lastEventV1Schema = z.object({
  id: z.number().int().nullish(),
  type: safeCargoEventTypeEnum,
  severity: safeCargoSeverityEnum,
  time: z.string(),
  measurement: z.number().nullish(),
  durationMs: z.number().int().nullish(),
  details: z.record(z.string(), z.unknown()).nullish(),
});

export const safeCargoNfcPayloadV1Schema = z.object({
  v: z.literal(SAFECARGO_PAYLOAD_VERSION),
  device: z.string().min(1).max(64),
  status: safeCargoStatusEnum.default("NORMAL"),
  time: z.string().nullish(),
  timeValid: z.boolean().default(true),
  events: eventCountsV1Schema.default({
    shock: 0,
    tilt: 0,
    light: 0,
    motion: 0,
  }),
  max: maxMeasurementsV1Schema.default({ g: null, tilt: null, gyro: null }),
  last: lastEventV1Schema.nullish(),
  pending: z.number().int().min(0).nullish(),
  sensor: z
    .object({
      accel: z.string().nullish(),
      gyro: z.string().nullish(),
      nfc: z.string().nullish(),
      fw: z.string().nullish(),
      esp: z.string().nullish(),
    })
    .nullish(),
  ts: z.string().nullish(),
});

export const safeCargoNfcPayloadAnyVersionSchema = z.object({
  v: z.number().int(),
});

export type SafeCargoNfcPayloadV1 = z.infer<
  typeof safeCargoNfcPayloadV1Schema
>;

export const eventIngestionSchema = z.object({
  v: z.literal(SAFECARGO_PAYLOAD_VERSION).default(1),
  eventId: z.number().int(),
  device: z.string().min(1).max(64),
  type: safeCargoEventTypeEnum,
  severity: safeCargoSeverityEnum,
  timestamp: z.string(),
  timeValid: z.boolean().default(true),
  accelerationG: z.number().nullish(),
  tiltDeg: z.number().nullish(),
  gyroDps: z.number().nullish(),
  ldrValue: z.number().nullish(),
  measurement: z.number().nullish(),
  durationMs: z.number().int().nullish(),
  details: z.record(z.string(), z.unknown()).nullish(),
  source: z.enum(["WIFI", "NFC_MANUAL"]).default("WIFI"),
});

export const reportIngestionSchema = z.object({
  v: z.number().int().default(1),
  device: z.string().min(1).max(64).nullish(),
  status: safeCargoStatusEnum.default("NORMAL"),
  time: z.string().nullish(),
  timeValid: z.boolean().default(true),
  events: eventCountsV1Schema.default({
    shock: 0,
    tilt: 0,
    light: 0,
    motion: 0,
  }),
  max: maxMeasurementsV1Schema.default({ g: null, tilt: null, gyro: null }),
  last: lastEventV1Schema.nullish(),
  pending: z.number().int().min(0).nullish(),
  sensor: z
    .object({
      accel: z.string().nullish(),
      gyro: z.string().nullish(),
      nfc: z.string().nullish(),
      fw: z.string().nullish(),
      esp: z.string().nullish(),
    })
    .nullish(),
  timestamp: z.string().nullish(),
  newEvents: z.array(eventIngestionSchema).nullish().default([]),
});

export { SAFECARGO_PAYLOAD_VERSION };
