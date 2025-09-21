-- Add notes column to production_data table
ALTER TABLE public.production_data
ADD COLUMN notes TEXT;

-- Update add_daily_log function to include notes
CREATE OR REPLACE FUNCTION public.add_daily_log(
    p_flock_id bigint,
    p_date date,
    p_normal_eggs integer,
    p_white_eggs integer,
    p_cracked_eggs integer,
    p_normal_eggs_weight_kg numeric,
    p_white_eggs_weight_kg numeric,
    p_cracked_eggs_weight_kg numeric,
    p_feed_consumption jsonb[],
    p_mortality_count integer,
    p_culling_count integer,
    p_notes TEXT -- New parameter
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_organization_id UUID;
    v_production_id BIGINT;
    feed_item JSONB;
    v_feed_code TEXT;
    v_quantity_kg NUMERIC;
    v_current_stock NUMERIC;
BEGIN
    -- Get the organization_id for the current user
    SELECT organization_id INTO v_organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
    LIMIT 1;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION 'Pengguna tidak terkait dengan organisasi manapun.';
    END IF;

    -- Insert into production_data
    INSERT INTO public.production_data (
        flock_id, organization_id, date, normal_eggs, white_eggs, cracked_eggs,
        normal_eggs_weight_kg, white_eggs_weight_kg, cracked_eggs_weight_kg, notes -- Include notes
    )
    VALUES (
        p_flock_id, v_organization_id, p_date, p_normal_eggs, p_white_eggs, p_cracked_eggs,
        p_normal_eggs_weight_kg, p_white_eggs_weight_kg, p_cracked_eggs_weight_kg, p_notes -- Include notes
    )
    RETURNING id INTO v_production_id;

    -- Process feed consumption and deduct from inventory
    IF p_feed_consumption IS NOT NULL THEN
        FOR feed_item IN SELECT * FROM UNNEST(p_feed_consumption)
        LOOP
            v_feed_code := feed_item->>'feed_code';
            v_quantity_kg := (feed_item->>'quantity_kg')::NUMERIC;

            -- Check current stock (FOR UPDATE to prevent race conditions)
            SELECT quantity INTO v_current_stock
            FROM public.inventory_items
            WHERE organization_id = v_organization_id
              AND item_type = 'PAKAN'
              AND item_code = v_feed_code
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Kode pakan \\\"%\\\" tidak ditemukan di inventori.', v_feed_code;
            END IF;

            IF v_current_stock < v_quantity_kg THEN
                RAISE EXCEPTION 'Stok pakan \\\"%\\\" tidak mencukupi. Tersedia: % kg, Dibutuhkan: % kg.', v_feed_code, v_current_stock, v_quantity_kg;
            END IF;

            -- Deduct from inventory
            UPDATE public.inventory_items
            SET quantity = quantity - v_quantity_kg
            WHERE organization_id = v_organization_id
              AND item_type = 'PAKAN'
              AND item_code = v_feed_code;

            -- Insert into feed_consumption
            INSERT INTO public.feed_consumption (
                production_data_id, organization_id, feed_code, quantity_kg
            )
            VALUES (
                v_production_id, v_organization_id, v_feed_code, v_quantity_kg
            );
        END LOOP;
    END IF;

    -- Insert into mortality_data if there is any depletion
    IF p_mortality_count > 0 OR p_culling_count > 0 THEN
        INSERT INTO public.mortality_data (
            flock_id, organization_id, date, mortality_count, culling_count
        )
        VALUES (
            p_flock_id, v_organization_id, p_date, p_mortality_count, p_culling_count
        )
        ON CONFLICT (flock_id, date) DO UPDATE SET
            mortality_count = mortality_data.mortality_count + EXCLUDED.mortality_count,
            culling_count = mortality_data.culling_count + EXCLUDED.culling_count;
    END IF;
END;
$function$;

-- Update update_production_data_with_feed function to include notes
CREATE OR REPLACE FUNCTION public.update_production_data_with_feed(
    p_production_id bigint,
    p_flock_id bigint,
    p_date date,
    p_normal_eggs integer,
    p_white_eggs integer,
    p_cracked_eggs integer,
    p_normal_eggs_weight_kg numeric,
    p_white_eggs_weight_kg numeric,
    p_cracked_eggs_weight_kg numeric,
    p_feed_consumption jsonb[],
    p_notes TEXT -- New parameter
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_organization_id UUID;
    old_feed_item RECORD;
    new_feed_item JSONB;
    v_feed_code TEXT;
    v_quantity_kg NUMERIC;
    v_current_stock NUMERIC;
BEGIN
    -- Get the organization_id for the current user
    SELECT organization_id INTO v_organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
    LIMIT 1;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION 'Pengguna tidak terkait dengan organisasi manapun.';
    END IF;

    -- Revert old feed consumption from inventory
    FOR old_feed_item IN SELECT feed_code, quantity_kg FROM public.feed_consumption WHERE production_data_id = p_production_id
    LOOP
        UPDATE public.inventory_items
        SET quantity = quantity + old_feed_item.quantity_kg
        WHERE organization_id = v_organization_id
          AND item_type = 'PAKAN'
          AND item_code = old_feed_item.feed_code;
    END LOOP;

    -- Delete old feed consumption records
    DELETE FROM public.feed_consumption WHERE production_data_id = p_production_id;

    -- Update production_data
    UPDATE public.production_data
    SET
        flock_id = p_flock_id,
        date = p_date,
        normal_eggs = p_normal_eggs,
        white_eggs = p_white_eggs,
        cracked_eggs = p_cracked_eggs,
        normal_eggs_weight_kg = p_normal_eggs_weight_kg,
        white_eggs_weight_kg = p_white_eggs_weight_kg,
        cracked_eggs_weight_kg = p_cracked_eggs_weight_kg,
        notes = p_notes -- Include notes
    WHERE id = p_production_id
      AND organization_id = v_organization_id;

    -- Process new feed consumption and deduct from inventory
    FOR new_feed_item IN SELECT * FROM UNNEST(p_feed_consumption)
    LOOP
        v_feed_code := new_feed_item->>'feed_code';
        v_quantity_kg := (new_feed_item->>'quantity_kg')::NUMERIC;

        -- Check current stock
        SELECT quantity INTO v_current_stock
        FROM public.inventory_items
        WHERE organization_id = v_organization_id
          AND item_type = 'PAKAN'
          AND item_code = v_feed_code
        FOR UPDATE; -- Lock row for update

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Kode pakan \\\"%\\\" tidak ditemukan di inventori.', v_feed_code;
        END IF;

        IF v_current_stock < v_quantity_kg THEN
            RAISE EXCEPTION 'Stok pakan \\\"%\\\" tidak mencukupi. Tersedia: % kg, Dibutuhkan: % kg.', v_feed_code, v_current_stock, v_quantity_kg;
        END IF;

        -- Deduct from inventory
        UPDATE public.inventory_items
        SET quantity = quantity - v_quantity_kg
        WHERE organization_id = v_organization_id
          AND item_type = 'PAKAN'
          AND item_code = v_feed_code;

        -- Insert into feed_consumption
        INSERT INTO public.feed_consumption (
            production_data_id, organization_id, feed_code, quantity_kg
        )
        VALUES (
            p_production_id, v_organization_id, v_feed_code, v_quantity_kg
        );
    END LOOP;
END;
$function$;