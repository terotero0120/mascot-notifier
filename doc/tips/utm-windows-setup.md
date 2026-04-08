# UTM で Windows 11 (ARM64) 環境を構築する

macOS (Apple Silicon) 上で UTM を使って Windows 11 のテスト環境を構築する手順。

## 必要なもの

- [UTM](https://mac.getutm.app) — App Store またはサイトからダウンロード
- Windows 11 ARM64 ISO — [https://www.microsoft.com/ja-jp/software-download/windows11arm64](https://www.microsoft.com/ja-jp/software-download/windows11arm64) からダウンロード（日本語を選択）

> Intel Mac の場合は [x64版](https://www.microsoft.com/ja-jp/software-download/windows11) を使用する

## VM の作成

1. UTM を起動 → 「+」→ **「仮想化」** を選択
2. OS に **「Windows」** を選択
3. ISO イメージをインポート
4. メモリ: **8GB 以上**、ストレージ: **64GB 以上** を設定（16GB ではインストール不可）
5. 保存

## 起動時に UEFI Shell が表示された場合

自動ブートに失敗すると以下のような画面になる：

```
UEFI Interactive Shell v2.2
...
Shell> _
```

### 手動で起動する手順

```
FS0:
```
でEnterを押してISOドライブに移動してから、

```
cd EFI
cd BOOT
BOOTAA64.EFI
```

と1行ずつ入力してEnter。これでWindowsインストーラーが起動する。

### キーボードのズレについて

UEFI Shell は **USキーボード配列** で動作するため、日本語キーボードと一部キーがズレる。

| 入力したい文字 | 押すキー |
|--------------|--------|
| `:` (コロン) | `Shift + ;`（Lキーの右隣） |
| `\` (バックスラッシュ) | `¥` キー（反応しない場合は上記の `cd` を使う方法で回避） |

## Windows インストール

UEFI Shell からインストーラーを起動後、以下のメッセージが表示されたら **何かキーを押す**：

```
Press any key to boot from CD or DVD...
```

このプロンプトは数秒で消えるので、表示されたらすぐにキーを押す。押さないと再び UEFI Shell に戻ってしまう。

キーを押すと Windows セットアップ画面が起動するので、通常の手順で進める。

## インストール後の設定

- **SPICE ゲストツール** をインストールすると解像度調整・クリップボード共有が有効になる
- **スナップショット** を活用するとテスト前後で状態を保存・復元できる
  - UTM でVM を選択 → 右クリック → 「スナップショット」
- **共有フォルダ** で macOS とファイルを共有可能
  - VM設定 → 「共有」タブでディレクトリを指定
