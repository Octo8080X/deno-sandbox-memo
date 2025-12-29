# 実装方針

## 概要

このサービスはメモアプリです。
ユーザーはテキストメモを作成、編集、削除することができます。

- / : メモの一覧、新規のファイル作成の動線がある。
- /new : 新規メモ作成画面
- /:id : メモ詳細画面、commit履歴も表示する
- /:id/edit : メモ編集画面

## API設計

- /api/notes
  - GET : メモ一覧取得
  - POST : 新規メモ作成
  -
- /api/notes/:id
  - GET : メモ詳細取得
  - PUT : メモ更新
  - DELETE : メモ削除
- /api/notes/:id/commits
  - GET : メモのcommit履歴取得
- /api/notes/:id/commits/:commit_id
  - GET : 特定commitの内容取得
  - POST : 特定commitへの復元
