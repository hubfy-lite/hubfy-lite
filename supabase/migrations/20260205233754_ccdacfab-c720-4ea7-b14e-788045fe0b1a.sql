-- Update handle_new_user to read is_creator from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Always create profile
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  
  -- Only create role if is_creator = true
  -- Members will have their role assigned when they join a tenant
  IF NEW.raw_user_meta_data->>'is_creator' = 'true' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'creator');
  END IF;
  
  RETURN NEW;
END;
$function$;