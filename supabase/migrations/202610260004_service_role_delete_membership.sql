-- Service role (Edge Function admin-users) menghapus baris memberships saat
-- mencabut akses staf. Di project ini service_role tidak mewarisi DELETE pada
-- tabel memberships (platform default-nya parsial), sehingga izin diberikan
-- eksplisit. service_role tidak pernah dipakai browser, jadi ini aman.
grant delete on public.memberships to service_role;
