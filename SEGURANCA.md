# Correção de segurança: login e acesso restrito

Antes, a tabela `subscription_plans` (nome de cliente e valores) aceitava leitura, escrita e exclusão
por qualquer pessoa que tivesse a URL e a chave pública do Supabase, que estão no repositório.
Agora o app exige login e o banco só responde a usuários autorizados.

## Ordem para aplicar (importante)
1. **Publicar o app com a tela de login** (merge deste branch; o Lovable publica sozinho).
2. **Supabase > Authentication > Sign In / Providers > Email**: desligue **"Allow new users to sign up"**.
   Sem isso, qualquer pessoa poderia criar uma conta e entrar.
3. **Supabase > Authentication > Users > Add user**: crie o seu usuário (e-mail e senha), marcando "Auto Confirm User".
4. **Supabase > SQL Editor**: cole e execute `supabase/migrations/20251113000000_secure_subscription_plans.sql`.
5. No SQL Editor, autorize o seu e-mail (troque pelo e-mail do passo 3):
   ```sql
   insert into public.allowed_users (email) values ('seu-email@exemplo.com');
   ```
6. Abra o app, entre com e-mail e senha e confira que os planos aparecem.

## Conferir que fechou
Sem login, esta consulta deve devolver `[]` ou erro de permissão (use a URL e a chave `anon` do projeto):
```sh
curl "$SUPABASE_URL/rest/v1/subscription_plans?select=id&limit=1" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
```

## Depois
- Enquanto o repositório esteve público, os dados ficaram acessíveis. Em `Table Editor > subscription_plans`, procure linhas que você não reconhece e exporte um backup (Export to CSV).
- A chave `anon`/publishable é pública por natureza (aparece em qualquer app web). A proteção está nas políticas acima, então não é preciso trocá-la.
- Novas tabelas do Supabase devem nascer com RLS ligada e política que use `public.is_allowed_user()`.
