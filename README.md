# 森田浩文 活動サイト

佐賀県議会議員選挙（2027年4月2日告示／4月11日投票）に向けた、森田浩文さんの活動報告・政策・SNS をまとめたサイトと、メールマガジンの仕組みです。

## 画面は2つ

| 画面 | 使う人 | 置き場所 |
|---|---|---|
| **公開サイト**（`index.html`） | 一般の方 | GitHub Pages（無料） |
| **管理画面**（`gas/Admin.html`） | 運営チーム | Google Apps Script（無料） |

```
 一般の方 ──▶ 公開サイト ──(内容を取得 / メルマガ登録)──▶ Apps Script ──▶ スプレッドシート
                                                              ▲              （読者・記事・設定）
 運営チーム ──▶ 管理画面（Googleログイン必須）────────────────┘
                     └─ 活動報告を書く → サイト掲載 → 読者へメール配信（Gmail）
```

### 公開サイトの内容
- トップ（キャッチコピー・写真・選挙区）
- プロフィール
- 目指すこと（政策）
- これまでの活動（年表）
- 活動報告（管理画面から投稿したものが新しい順に並ぶ）
- SNS（各SNSへのリンク＋Instagram 投稿の埋め込み）
- メルマガ登録フォーム（同意チェック・確認メール付き）

### 管理画面でできること
- 活動報告の作成・編集・公開／下書き、写真アップロード
- 自分へのテスト送信、読者への一斉配信（送信上限を超えた分は自動で順次送信）
- 読者一覧・検索・配信停止・CSV ダウンロード、紙の申込書からの手入力追加
- サイトの文章・政策・年表・SNS・Instagram 埋め込みの編集
- 選挙日程に合わせた注意表示（告示前の投票依頼表現の警告、選挙期間中のメール表示義務の自動挿入、投票日当日の更新・配信停止）

## はじめかた
1. [docs/SETUP.md](docs/SETUP.md) の手順で、スプレッドシート・Apps Script・GitHub Pages を設定
2. [docs/ELECTION_LAW_NOTES.md](docs/ELECTION_LAW_NOTES.md) を運営メンバー全員で確認

## ローカルでの見た目確認
```bash
python3 -m http.server 8000
```
- 公開サイト：http://localhost:8000/
- 管理画面（デモデータで動作）：http://localhost:8000/gas/Admin.html

## ファイル構成
```
index.html              公開サイト
config.js               Apps Script の URL を設定する
assets/css/style.css    デザイン（色は先頭の :root で変更可）
assets/js/main.js       表示・メルマガ登録の処理
assets/img/             画像
data/site.json          予備データ（API 未設定時に表示）
gas/Code.gs             Apps Script 本体（API・メール配信）
gas/Admin.html          管理画面
gas/appsscript.json     Apps Script の設定
docs/                   手順書・注意事項
```

## サイトだけにある追加の項目（管理画面にはありません）
次の項目は `data/site.json` に直接書いてあります。管理画面（API）を使うようになっても、この部分は `data/site.json` から読み込まれます。なくてもサイトは動きます。

| 項目 | 内容 |
|---|---|
| `settings.candidate_title` | 名前の下に出る肩書き |
| `message` | ごあいさつの「なぜ、県政へ。」（見出しと本文） |
| `slogans` | 流れる文字の帯に出す合言葉 |
| `highlights` | 「数字で見る、これまで。」の数字 |
| `farm` | 「農園とお店」の欄 |

- メルマガの表示：`config.js` の `NEWSLETTER_ENABLED` を `true` にすると戻ります。
- SNS で共有したときの画像は `assets/img/ogp.jpg` です。サイトの住所（URL）が変わったら、`index.html` の先頭にある `canonical`・`og:url`・`og:image` の URL も直してください。

## メモ
- 現在の文章は **【サンプル】** です。ご本人の確認を経た原稿に差し替えてから公開してください。
- ふりがな（もりた ひろふみ）は仮入力です。正しい読みを確認してください。
