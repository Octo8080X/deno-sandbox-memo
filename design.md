# 実装方針

## 概要

このサービスはメモアプリです。
ユーザーはテキストメモを作成、編集することができます。
gitでバージョン管理され、履歴の確認や復元が可能です。

## ページ構成

- `/` : メモの一覧、新規のファイル作成の動線がある。
- `/new` : 新規メモ作成画面
- `/storage/:name` : メモ詳細・編集画面、commit履歴も表示する
- `/storage/:name/diff/:commit` : 特定commitのdiff表示画面

## API設計

- `/api/storage`
  - POST : 新規メモ作成

- `/api/storage/:name`
  - GET : メモ内容取得
  - PUT : メモ更新

- `/api/storage/:name/commits`
  - GET : メモのcommit履歴取得

- `/api/storage/:name/diff/:commit`
  - GET : 特定commitのdiff取得

- `/api/storage/:name/snapshot/:commit`
  - GET : 特定commit時点のファイル内容取得（before/after）

- `/api/storage/:name/restore/:commit`
  - POST : 特定commitへの復元
