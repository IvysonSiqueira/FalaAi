-- Executar somente em projeto descartável/de teste com destino confirmado,
-- após aplicar a migração inicial. Requer SQL Editor/postgres. NÃO é migração.
-- Se qualquer asserção falhar, executar ROLLBACK; não persistir as fixtures.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1111111-1111-4111-8111-111111111111', 'falaai-rls-a@example.test', '{"name":"Teste A"}'),
  ('b2222222-2222-4222-8222-222222222222', 'falaai-rls-b@example.test', '{"name":"Teste B"}');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}';
do $$
begin
  if (select count(*) from public.profiles where id in
    ('a1111111-1111-4111-8111-111111111111', 'b2222222-2222-4222-8222-222222222222')) <> 1 then
    raise exception 'Perfil de outro usuário visível';
  end if;
  update public.profiles set display_name = 'Teste A atualizado' where id = auth.uid();
  if not found then raise exception 'Atualização do próprio perfil falhou'; end if;

  insert into public.occurrences (category_id, description, location)
  values ('buraco', 'Descrição sintética de teste RLS com mais de vinte caracteres.', 'Endereço sintético de teste');
  if not exists (select 1 from public.occurrences where author_id = auth.uid() and status = 'Aberta') then
    raise exception 'Criação pelo proprietário falhou';
  end if;
  begin
    insert into public.occurrences (author_id, category_id, description, location)
    values ('b2222222-2222-4222-8222-222222222222', 'buraco', 'Descrição sintética com proprietário forjado.', 'Teste');
    raise exception 'Proprietário forjado foi aceito';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.occurrences (category_id, description, latitude, longitude)
    values ('buraco', 'Descrição sintética para coordenadas inválidas.', 91, 10);
    raise exception 'Latitude inválida foi aceita';
  exception when check_violation then null;
  end;
  begin
    insert into public.occurrences (category_id, description)
    values ('buraco', 'Descrição sintética sem endereço ou coordenadas.');
    raise exception 'Ocorrência sem localização foi aceita';
  exception when check_violation then null;
  end;
end;
$$;

set local request.jwt.claims = '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}';
do $$
begin
  if (select count(*) from public.occurrences where author_id = 'a1111111-1111-4111-8111-111111111111') <> 1 then
    raise exception 'Leitura comunitária falhou';
  end if;
  update public.occurrences set description = 'Tentativa de modificar ocorrência de outro usuário.'
    where author_id = 'a1111111-1111-4111-8111-111111111111';
  if found then raise exception 'B alterou ocorrência de A'; end if;
  delete from public.occurrences where author_id = 'a1111111-1111-4111-8111-111111111111';
  if found then raise exception 'B excluiu ocorrência de A'; end if;
  update public.profiles set display_name = 'Nome adulterado' where id = 'a1111111-1111-4111-8111-111111111111';
  if found then raise exception 'B alterou perfil de A'; end if;
  begin
    update public.profiles set id = 'a1111111-1111-4111-8111-111111111111' where id = auth.uid();
    raise exception 'Troca de identidade foi aceita';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}';
do $$
begin
  update public.occurrences set description = 'Descrição atualizada pelo verdadeiro proprietário.' where author_id = auth.uid();
  if not found then raise exception 'Proprietário não conseguiu atualizar'; end if;
  delete from public.occurrences where author_id = auth.uid();
  if not found then raise exception 'Proprietário não conseguiu excluir'; end if;
end;
$$;

reset role;
set local role anon;
set local request.jwt.claims = '{}';
do $$
begin
  begin
    perform 1 from public.occurrences;
    raise exception 'Leitura anônima foi aceita';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.profiles;
    raise exception 'Perfil acessível anonimamente';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
rollback;
