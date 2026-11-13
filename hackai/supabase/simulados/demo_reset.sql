-- Vaciado de la demo: borra lo que dejan los ensayos en las tablas propias de
-- Espacios (supabase/migrations/0002_spaces.sql): los espacios, sus canales,
-- los mensajes, el material y hasta dónde leyó cada persona. Los espacios y
-- sus canales por defecto se vuelven a crear la primera vez que alguien abre
-- la materia, y lo de Moodle se trae de nuevo al abrirla.
--
-- Lo corre `npm run demo:preparar` después de las migraciones y antes de los
-- seeds (hackai/README.md, «Base de la demo»). Los archivos del bucket no se
-- pueden borrar por SQL: el mismo comando los borra por la API de Storage.
--
-- Es de la demo, por eso va con lo simulado: en producción no se aplica.
-- No toca los vínculos de Personas (people_accounts): de eso se encarga
-- people_seed.sql, que no pisa los de Discord. Los vínculos de los canales con
-- Discord viven en space_channels y se borran con los espacios.
-- Idempotente: correrlo de nuevo deja lo mismo. Con `restart identity` los
-- contadores `seq` vuelven a empezar, así cada ensayo arranca igual.

begin;

truncate table space_reads, space_messages, space_material, space_channels, spaces restart identity cascade;

-- A: asistencia. Las listas que se tomaron en un ensayo y las faltas que pasaron al SIU simulado.
truncate table section_classes;
delete from siu_absences where id like 'ia-%';

-- A4: los enlaces de Zoom que se cargaron en un ensayo.
truncate table section_zoom_links;

commit;

-- Que PostgREST relea el esquema, por si las migraciones de recién sumaron algo.
notify pgrst, 'reload schema';
