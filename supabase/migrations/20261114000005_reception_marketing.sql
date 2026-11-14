-- Resepshn marketolog ishini ham bajaradi: kampaniyalar, promokodlar va tadbirlarni boshqaradi.
-- (Lidlar, o'quvchiga aylantirish va SMS uchun ruxsatlar resepshnda avvaldan bor.)

drop policy if exists mk_write on campaigns;
create policy mk_write on campaigns for all to authenticated
  using (public.has_role('owner', 'admin', 'manager', 'marketer', 'reception'))
  with check (public.has_role('owner', 'admin', 'manager', 'marketer', 'reception'));

drop policy if exists mk_write on promo_codes;
create policy mk_write on promo_codes for all to authenticated
  using (public.has_role('owner', 'admin', 'manager', 'marketer', 'reception'))
  with check (public.has_role('owner', 'admin', 'manager', 'marketer', 'reception'));

drop policy if exists write_events on events;
create policy write_events on events for all to authenticated
  using (public.has_role('owner', 'admin', 'manager', 'marketer', 'reception'))
  with check (public.has_role('owner', 'admin', 'manager', 'marketer', 'reception'));
