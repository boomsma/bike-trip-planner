-- CreateEnum
CREATE TYPE "SuggestionConditionType" AS ENUM ('weather_rain', 'weather_cold', 'weather_hot', 'terrain_hilly', 'terrain_mountainous', 'country');

-- AlterTable
ALTER TABLE "routes" ADD COLUMN     "countries" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "packing_suggestion_rules" (
    "id" UUID NOT NULL,
    "condition_type" "SuggestionConditionType" NOT NULL,
    "condition_value" TEXT,
    "item_name" TEXT NOT NULL,
    "category_name" TEXT NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "packing_suggestion_rules_pkey" PRIMARY KEY ("id")
);

-- Reference/config data — readable by anyone, writable only via migration
-- (no app-level create/edit UI yet).
alter table public.packing_suggestion_rules enable row level security;

create policy "anyone can read suggestion rules" on public.packing_suggestion_rules
  for select using (true);

INSERT INTO "packing_suggestion_rules" ("id", "condition_type", "condition_value", "item_name", "category_name", "reason") VALUES
  (gen_random_uuid(), 'weather_rain', NULL, 'Rain jacket', 'Rain layers', 'Rain expected on this trip'),
  (gen_random_uuid(), 'weather_rain', NULL, 'Waterproof pannier covers', 'Rain layers', 'Rain expected on this trip'),
  (gen_random_uuid(), 'weather_rain', NULL, 'Fenders/mudguards', 'Rain layers', 'Rain expected on this trip'),
  (gen_random_uuid(), 'weather_cold', NULL, 'Thermal base layer', 'Clothing', 'Cold nights expected'),
  (gen_random_uuid(), 'weather_cold', NULL, 'Warm gloves', 'Clothing', 'Cold nights expected'),
  (gen_random_uuid(), 'weather_cold', NULL, 'Insulated sleeping bag liner', 'Sleep', 'Cold nights expected'),
  (gen_random_uuid(), 'weather_hot', NULL, 'Sunscreen', 'Essentials', 'Hot weather expected'),
  (gen_random_uuid(), 'weather_hot', NULL, 'Extra water bottles', 'Essentials', 'Hot weather expected'),
  (gen_random_uuid(), 'weather_hot', NULL, 'Lightweight sun sleeves', 'Clothing', 'Hot weather expected'),
  (gen_random_uuid(), 'terrain_hilly', NULL, 'Extra energy snacks', 'Food', 'Hilly terrain along this route'),
  (gen_random_uuid(), 'terrain_mountainous', NULL, 'Spare brake pads', 'Repair', 'Mountainous terrain means more braking wear'),
  (gen_random_uuid(), 'terrain_mountainous', NULL, 'Extra warm layer for descents', 'Clothing', 'Mountainous terrain — descents get cold fast'),
  (gen_random_uuid(), 'country', 'Netherlands', 'Sturdy bicycle lock', 'Essentials', 'Bike theft is common in the Netherlands');
