-- Sorteos sin carreras. Idempotente.
-- - Una sola «Primera ronda» por curso (ensureRound concurrente).
-- - Una persona no puede salir dos veces en la misma ronda salvo que la
--   primera haya sido «ausente» (vuelve a la ronda). Si el botón y el agente
--   sortean a la vez y eligen a la misma persona, el segundo insert choca
--   (23505) y drawStudent vuelve a sortear sin ella.
create unique index if not exists cold_call_rounds_first_uq on cold_call_rounds (course_id) where reason = 'Primera ronda';
create unique index if not exists cold_call_draws_round_person_uq on cold_call_draws (round_id, person_id) where outcome <> 'ausente';
