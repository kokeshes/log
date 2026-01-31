# WIRED LOG (GitHub Pages + Supabase)

## 1) Supabase設定
- Project URL / anon public key を `docs/supabase.js` に貼る
- SQL Editorで `schema.sql` の内容を実行（テーブル + RLS）

## 2) GitHub Pages
- Settings -> Pages
- Source: Deploy from a branch
- Branch: main /docs

## 3) 注意
このテンプレは静的フロントです。SupabaseのRLSで「自分のログだけ」を守ります。
