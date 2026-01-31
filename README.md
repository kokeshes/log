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


## PWA
- manifest.json / sw.js を同梱
- GitHub Pages の /log/ に合わせて start_url と scope を設定
- iOS: 追加後にアイコンが出る（apple-touch-iconあり）
