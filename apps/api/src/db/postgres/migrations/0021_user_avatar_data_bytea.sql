-- Avatares são bytes binários. O tipo text rejeita NUL e sequências que não
-- sejam UTF-8 quando o adapter pg grava imagens reais.
ALTER TABLE user_avatars
  ALTER COLUMN data TYPE bytea USING convert_to(data, 'UTF8');
