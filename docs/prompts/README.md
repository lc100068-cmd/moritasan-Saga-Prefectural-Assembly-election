# Sonnet 用の作業指示書

モデルを切り替えてから、下の「貼り付ける文」をそのまま送ってください。

```
/model sonnet
```

## 実行する順番

| 順番 | ファイル | 内容 | 貼り付ける文 |
|---|---|---|---|
| 1 | `01-design-research.md` | デザイン性の高い政治家サイトのリサーチ | `docs/prompts/01-design-research.md を読んで、その指示どおりに実行してください。` |
| 2 | `02-morita-research.md` | 森田浩文さんの公開情報リサーチ | `docs/prompts/02-morita-research.md を読んで、その指示どおりに実行してください。` |
| 2b | `02b-morita-facebook-chrome.md` | Facebook を Claude in Chrome で調べる（2のあとに。Chrome とログインが必要） | `docs/prompts/02b-morita-facebook-chrome.md を読んで、その指示どおりに実行してください。` |
| 3 | `03-redesign.md` | サイトのリニューアル（1・2の結果を見てから） | `docs/prompts/03-redesign.md を読んで、その指示どおりに実行してください。デザインの方向性は「（A/B/C のどれか）」でお願いします。` |
| 3F | `03-redesign-fable.md` | **Claude Fable 用**：サイトのリニューアル（方向性A・誠実系で確定済み）。実際のサイト制作はこちら | 先に `/model claude-fable-5-2` で切り替え、`docs/prompts/03-redesign-fable.md を読んで、その指示どおりに実行してください。` |

- 1 と 2 は、どちらを先にやっても大丈夫です。
- 3 は、1・2 の結果（`docs/research/` に保存されます）を読んで、デザインの方向性を決めてから実行してください。
- メルマガ機能は 3 で「非表示」になるだけで、消えません。`config.js` の `NEWSLETTER_ENABLED` を `true` にすると戻ります。
