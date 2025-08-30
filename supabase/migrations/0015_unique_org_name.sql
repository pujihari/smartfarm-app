ALTER TABLE public.organizations
ADD CONSTRAINT organizations_name_unique UNIQUE (name);