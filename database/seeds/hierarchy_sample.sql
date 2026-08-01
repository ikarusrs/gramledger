-- Sample / placeholder hierarchy for development and testing.
--
-- WARNING: the LGD codes below are NOT official. They exist so the hierarchy
-- and search features are exercisable before the LGD ETL pipeline (data.gov.in
-- 'lgd' source) backfills authoritative codes and names. Replace this seed with
-- a real LGD snapshot before any public launch.
--
-- Idempotent: every INSERT uses ON CONFLICT DO NOTHING keyed on lgd_code, so
-- this file can be re-run safely after a partial load.
--
-- Insert order respects foreign keys: states -> districts -> talukas ->
-- panchayats -> villages (villages.panchayat_id references panchayats).
BEGIN;
-- States
INSERT INTO states (lgd_code, name_mr, name_en)
    VALUES (27, 'महाराष्ट्र', 'Maharashtra')
ON CONFLICT (lgd_code)
    DO NOTHING;
-- Districts (placeholder LGD codes)
INSERT INTO districts (state_id, lgd_code, name_mr, name_en)
    VALUES ((
            SELECT
                id
            FROM
                states
            WHERE
                lgd_code = 27), 27001, 'पुणे', 'Pune'), ((
        SELECT
            id
        FROM states
        WHERE
            lgd_code = 27), 27002, 'सातारा', 'Satara'), ((
        SELECT
            id
        FROM states
    WHERE
        lgd_code = 27), 27003, 'नागपूर', 'Nagpur'), ((
        SELECT
            id
        FROM states
    WHERE
        lgd_code = 27), 27004, 'नाशिक', 'Nashik'), ((
        SELECT
            id
        FROM states
    WHERE
        lgd_code = 27), 27005, 'कोल्हापूर', 'Kolhapur')
ON CONFLICT (lgd_code)
    DO NOTHING;
-- Talukas (placeholder LGD codes)
INSERT INTO talukas (district_id, lgd_code, name_mr, name_en)
    VALUES ((
            SELECT
                id
            FROM
                districts
            WHERE
                lgd_code = 27001), 2700101, 'हवेली', 'Haveli'), ((
        SELECT
            id
        FROM districts
        WHERE
            lgd_code = 27001), 2700102, 'मावळ', 'Maval'), ((
        SELECT
            id
        FROM districts
    WHERE
        lgd_code = 27001), 2700103, 'मुळशी', 'Mulshi'), ((
        SELECT
            id
        FROM districts
    WHERE
        lgd_code = 27002), 2700201, 'सातारा', 'Satara'), ((
        SELECT
            id
        FROM districts
    WHERE
        lgd_code = 27002), 2700202, 'कराड', 'Karad'), ((
        SELECT
            id
        FROM districts
    WHERE
        lgd_code = 27003), 2700301, 'रामटेक', 'Ramtek'), ((
        SELECT
            id
        FROM districts
    WHERE
        lgd_code = 27003), 2700302, 'पारशिवनी', 'Parseoni'), ((
        SELECT
            id
        FROM districts
    WHERE
        lgd_code = 27004), 2700401, 'नाशिक', 'Nashik'), ((
        SELECT
            id
        FROM districts
    WHERE
        lgd_code = 27004), 2700402, 'निफाड', 'Niphad'), ((
        SELECT
            id
        FROM districts
    WHERE
        lgd_code = 27005), 2700501, 'करवीर', 'Karveer'), ((
        SELECT
            id
        FROM districts
    WHERE
        lgd_code = 27005), 2700502, 'पन्हाळा', 'Panhala')
ON CONFLICT (lgd_code)
    DO NOTHING;
-- Gram Panchayats (placeholder LGD codes; level defaults to 'gram')
INSERT INTO panchayats (state_id, district_id, taluka_id, lgd_code, name_mr, name_en)
    VALUES ((
            SELECT
                id
            FROM
                states
            WHERE
                lgd_code = 27), (
                SELECT
                    id
                FROM
                    districts
                WHERE
                    lgd_code = 27001), (
                    SELECT
                        id
                    FROM
                        talukas
                    WHERE
                        lgd_code = 2700101), 270010101, 'वडगाव बुद्रुक', 'Wadgaon Budruk'), ((
                SELECT
                    id
                FROM states
            WHERE
                lgd_code = 27), (
            SELECT
                id
            FROM districts
        WHERE
            lgd_code = 27001), (
        SELECT
            id
        FROM talukas
    WHERE
        lgd_code = 2700102), 270010201, 'तळेगाव', 'Talegaon'), ((
            SELECT
                id
            FROM states
        WHERE
            lgd_code = 27), (
        SELECT
            id
        FROM districts
    WHERE
        lgd_code = 27002), (
    SELECT
        id
    FROM talukas
WHERE
    lgd_code = 2700201), 270020101, 'रहिमतपूर', 'Rahimatpur'), ((
        SELECT
            id
        FROM states
    WHERE
        lgd_code = 27), (
    SELECT
        id
    FROM districts
WHERE
    lgd_code = 27002), (
    SELECT
        id
    FROM talukas
WHERE
    lgd_code = 2700201), 270020102, 'वाठार', 'Vathar'), ((
        SELECT
            id
        FROM states
    WHERE
        lgd_code = 27), (
    SELECT
        id
    FROM districts
WHERE
    lgd_code = 27002), (
    SELECT
        id
    FROM talukas
WHERE
    lgd_code = 2700202), 270020201, 'उंब्रज', 'Umbraj'), ((
        SELECT
            id
        FROM states
    WHERE
        lgd_code = 27), (
    SELECT
        id
    FROM districts
WHERE
    lgd_code = 27003), (
    SELECT
        id
    FROM talukas
WHERE
    lgd_code = 2700301), 270030101, 'रामटेक', 'Ramtek'), ((
        SELECT
            id
        FROM states
    WHERE
        lgd_code = 27), (
    SELECT
        id
    FROM districts
WHERE
    lgd_code = 27004), (
    SELECT
        id
    FROM talukas
WHERE
    lgd_code = 2700402), 270040201, 'निफाड', 'Niphad'), ((
        SELECT
            id
        FROM states
    WHERE
        lgd_code = 27), (
    SELECT
        id
    FROM districts
WHERE
    lgd_code = 27005), (
    SELECT
        id
    FROM talukas
WHERE
    lgd_code = 2700501), 270050101, 'करवीर', 'Karveer')
ON CONFLICT (lgd_code)
    DO NOTHING;
-- Villages (placeholder LGD codes; mapped to their Gram Panchayat)
INSERT INTO villages (taluka_id, panchayat_id, lgd_code, name_mr, name_en)
    VALUES ((
            SELECT
                id
            FROM
                talukas
            WHERE
                lgd_code = 2700101), (
                SELECT
                    id
                FROM
                    panchayats
                WHERE
                    lgd_code = 270010101), 27001010101, 'वडगाव बुद्रुक', 'Wadgaon Budruk'), ((
            SELECT
                id
            FROM talukas
        WHERE
            lgd_code = 2700101), (
        SELECT
            id
        FROM panchayats
    WHERE
        lgd_code = 270010101), 27001010102, 'शिवणे', 'Shivane'), ((
        SELECT
            id
        FROM talukas
    WHERE
        lgd_code = 2700102), (
    SELECT
        id
    FROM panchayats
WHERE
    lgd_code = 270010201), 27001020101, 'तळेगाव', 'Talegaon'), ((
        SELECT
            id
        FROM talukas
    WHERE
        lgd_code = 2700102), (
    SELECT
        id
    FROM panchayats
WHERE
    lgd_code = 270010201), 27001020102, 'वडगाव', 'Vadgaon'), ((
        SELECT
            id
        FROM talukas
    WHERE
        lgd_code = 2700201), (
    SELECT
        id
    FROM panchayats
WHERE
    lgd_code = 270020101), 27002010101, 'रहिमतपूर', 'Rahimatpur'), ((
        SELECT
            id
        FROM talukas
    WHERE
        lgd_code = 2700201), (
    SELECT
        id
    FROM panchayats
WHERE
    lgd_code = 270020102), 27002010201, 'वाठार', 'Vathar'), ((
        SELECT
            id
        FROM talukas
    WHERE
        lgd_code = 2700202), (
    SELECT
        id
    FROM panchayats
WHERE
    lgd_code = 270020201), 27002020101, 'उंब्रज', 'Umbraj'), ((
        SELECT
            id
        FROM talukas
    WHERE
        lgd_code = 2700301), (
    SELECT
        id
    FROM panchayats
WHERE
    lgd_code = 270030101), 27003010101, 'रामटेक', 'Ramtek'), ((
        SELECT
            id
        FROM talukas
    WHERE
        lgd_code = 2700402), (
    SELECT
        id
    FROM panchayats
WHERE
    lgd_code = 270040201), 27004020101, 'निफाड', 'Niphad'), ((
        SELECT
            id
        FROM talukas
    WHERE
        lgd_code = 2700501), (
    SELECT
        id
    FROM panchayats
WHERE
    lgd_code = 270050101), 27005010101, 'करवीर', 'Karveer')
ON CONFLICT (lgd_code)
    DO NOTHING;
COMMIT;
