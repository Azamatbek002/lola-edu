-- Resepshn marketolog ishini ham bajaradi: kampaniyalar, promokodlar va tadbirlarni boshqaradi.
-- (Lidlar, o'quvchiga aylantirish va SMS uchun ruxsatlar resepshnda avvaldan bor.)
-- ALTER POLICY — qoidani o'chirmasdan joyida yangilaydi.

alter policy mk_write on campaigns
  using (public.has_role('owner', 'admin', 'manager', 'marketer', 'reception'))
  with check (public.has_role('owner', 'admin', 'manager', 'marketer', 'reception'));

alter policy mk_write on promo_codes
  using (public.has_role('owner', 'admin', 'manager', 'marketer', 'reception'))
  with check (public.has_role('owner', 'admin', 'manager', 'marketer', 'reception'));

alter policy write_events on events
  using (public.has_role('owner', 'admin', 'manager', 'marketer', 'reception'))
  with check (public.has_role('owner', 'admin', 'manager', 'marketer', 'reception'));
