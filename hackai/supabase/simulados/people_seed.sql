-- Generado por npm run people:seed desde lib/adapters/synthetic-data.ts. No lo edites a mano.

begin;

delete from people_accounts where person_id = any (array['p-mledesma', 'p-gferreyra', 'p-cbustos', 'p-darrieta', 'p-srosales', 'p-taguirre', 'p-lbenitez', 'p-mcabrera', 'p-sdominguez', 'p-jescobar', 'p-vfunes', 'p-agimenez', 'p-nherrera', 'p-cibarra', 'p-fjuarez']::text[]) and system <> 'discord';

insert into people_accounts (person_id, system, external_id) values
  ('p-mledesma', 'identity', 'demo:p-mledesma'),
  ('p-mledesma', 'siu', '20101'),
  ('p-mledesma', 'moodle', '301'),
  ('p-gferreyra', 'identity', 'demo:p-gferreyra'),
  ('p-gferreyra', 'siu', '20102'),
  ('p-gferreyra', 'moodle', '302'),
  ('p-cbustos', 'identity', 'demo:p-cbustos'),
  ('p-cbustos', 'siu', '20103'),
  ('p-cbustos', 'moodle', '303'),
  ('p-darrieta', 'identity', 'demo:p-darrieta'),
  ('p-darrieta', 'siu', '20104'),
  ('p-darrieta', 'moodle', '304'),
  ('p-srosales', 'identity', 'demo:p-srosales'),
  ('p-srosales', 'siu', '20105'),
  ('p-srosales', 'moodle', '305'),
  ('p-taguirre', 'identity', 'demo:p-taguirre'),
  ('p-taguirre', 'siu', '30101'),
  ('p-taguirre', 'moodle', '401'),
  ('p-lbenitez', 'identity', 'demo:p-lbenitez'),
  ('p-lbenitez', 'siu', '30102'),
  ('p-lbenitez', 'moodle', '402'),
  ('p-mcabrera', 'identity', 'demo:p-mcabrera'),
  ('p-mcabrera', 'siu', '30103'),
  ('p-mcabrera', 'moodle', '403'),
  ('p-sdominguez', 'identity', 'demo:p-sdominguez'),
  ('p-sdominguez', 'siu', '30104'),
  ('p-sdominguez', 'moodle', '404'),
  ('p-jescobar', 'identity', 'demo:p-jescobar'),
  ('p-jescobar', 'siu', '30105'),
  ('p-jescobar', 'moodle', '405'),
  ('p-vfunes', 'identity', 'demo:p-vfunes'),
  ('p-vfunes', 'siu', '30106'),
  ('p-vfunes', 'moodle', '406'),
  ('p-agimenez', 'identity', 'demo:p-agimenez'),
  ('p-agimenez', 'siu', '30107'),
  ('p-agimenez', 'moodle', '407'),
  ('p-nherrera', 'identity', 'demo:p-nherrera'),
  ('p-nherrera', 'siu', '30108'),
  ('p-nherrera', 'moodle', '408'),
  ('p-cibarra', 'identity', 'demo:p-cibarra'),
  ('p-cibarra', 'siu', '30109'),
  ('p-cibarra', 'moodle', '409'),
  ('p-fjuarez', 'identity', 'demo:p-fjuarez'),
  ('p-fjuarez', 'siu', '30110'),
  ('p-fjuarez', 'moodle', '410')
on conflict (person_id, system) do update set external_id = excluded.external_id;

insert into people_accounts (person_id, system, external_id) values
  ('p-mledesma', 'discord', '1290000000000000001'),
  ('p-gferreyra', 'discord', '1290000000000000002'),
  ('p-taguirre', 'discord', '1290000000000000011'),
  ('p-lbenitez', 'discord', '1290000000000000012')
on conflict do nothing;

commit;
