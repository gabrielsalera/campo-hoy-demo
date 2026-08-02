-- Datos públicos ficticios; los usuarios Auth se crean con scripts administrativos locales.
insert into public.organizations(id,name) values ('10000000-0000-0000-0000-000000000001','Campo Hoy Demo');
insert into public.farms(id,organization_id,name) values
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Tambo Soutomayor'),
('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Campo Galisteo');
