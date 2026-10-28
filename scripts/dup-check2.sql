
SELECT 'unique_by_anilist', COUNT(*) FROM (SELECT DISTINCT REPLACE(id,'anilist-','') FROM Work);

