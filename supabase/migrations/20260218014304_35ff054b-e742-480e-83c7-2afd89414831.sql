
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS has_retaining_wall boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS has_parking_structure boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS has_cooling_tower boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS has_water_tank boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS has_fire_alarm boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS has_standpipe boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS has_place_of_assembly boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS is_food_establishment boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS has_backflow_device boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS burns_no4_oil boolean DEFAULT false;
