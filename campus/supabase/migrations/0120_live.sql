-- Clase en vivo: insertar una slide en un deck corriendo posiciones en una
-- sola transacción (la PK (deck_id, position) no deja hacer el corrimiento
-- con updates sueltos). Sin cambios a tablas.

create or replace function live_insert_deck_slide(p_deck text, p_after int, p_slide uuid)
returns int
language plpgsql
as $$
declare
  v_pos int;
  v_max int;
begin
  select coalesce(max(position), -1) into v_max from deck_slides where deck_id = p_deck;
  v_pos := least(greatest(p_after + 1, 0), v_max + 1);
  -- dos pasos para no chocar con la PK: primero a negativos, después a su lugar
  update deck_slides set position = -position - 1000000
    where deck_id = p_deck and position >= v_pos;
  update deck_slides set position = -position - 1000000 + 1
    where deck_id = p_deck and position < 0;
  insert into deck_slides (deck_id, position, slide_id) values (p_deck, v_pos, p_slide);
  update decks set updated_at = now() where id = p_deck;
  return v_pos;
end;
$$;
