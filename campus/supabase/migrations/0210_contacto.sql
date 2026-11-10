-- Datos de contacto que cada uno elige mostrar en la cohorte (el email de ingreso sigue privado).
-- Idempotente.
alter table people add column if not exists contact_email text;
alter table people add column if not exists whatsapp text;
