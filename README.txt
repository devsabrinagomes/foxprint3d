FOX PRINT 3D — SITE CATÁLOGO

Arquivos:
- index.html
- styles.css
- script.js

ANTES DE PUBLICAR:
1. WhatsApp configurado: (88) 99640-3012
2. E-mail configurado: foxprint3d.contato@gmail.com
3. Ajuste preços e produtos no index.html caso necessário.

PUBLICAÇÃO GRÁTIS:
- Vercel
- Netlify
- GitHub Pages

O site é estático e não precisa de banco de dados.

PAINEL ADMINISTRATIVO COM SUPABASE:
1. Crie um projeto gratuito em https://supabase.com
2. Abra o SQL Editor e execute todo o arquivo supabase-setup.sql.
3. Em Authentication > Users, crie o usuário administrador.
4. Em Project Settings > API, copie a Project URL e a publishable/anon key.
5. Cole os dois valores no arquivo supabase-config.js.
6. Acesse /admin.html para entrar e cadastrar produtos e fotos.

ATUALIZAÇÃO DE VENDAS E FILA DE IMPRESSÃO:
Se o SQL inicial já foi executado antes, execute também supabase-operations.sql
no SQL Editor. Ele cria as tabelas usadas pelas telas Vendas e Fila de impressão.

LISTA DE CLIENTES:
Execute supabase-customers.sql no SQL Editor para salvar automaticamente nome,
contato e autorização de promoções ao registrar uma venda.

Importante: nunca coloque a service_role key no site. Use somente a chave
publishable/anon. As regras do arquivo SQL deixam alterações restritas a usuários
autenticados e permitem ao público visualizar somente produtos ativos.
