# Google Apps Script 小網站設定說明

## 你現在有的檔案

- `Code.gs`：後端程式、資料存取、路由
- `Index.html`：前台頁面（活動列表）
- `Admin.html`：後台管理頁（新增活動 + 列表）

## 後台欄位

- 活動名稱（name）
- 上架時間（publishAt）
- 網址（url）

## 前台顯示

- 顯示「活動名稱 + 上架時間(M/d)」
- 點擊活動後，開新分頁前往活動網址
- 只會顯示「上架時間 <= 目前時間」的活動

## 如何貼到 Apps Script

1. 建立一個 Google 試算表（拿來當資料庫）
2. 在試算表點「擴充功能 > Apps Script」
3. 新增 3 個檔案：
   - `Code.gs`
   - `Index`
   - `Admin`
4. 把這個資料夾對應檔案內容，分別貼進去並儲存

## 部署

1. Apps Script 右上角按「部署 > 新增部署作業」
2. 類型選「網頁應用程式」
3. 執行身分：你自己
4. 存取權限：
   - 若要公開給任何人看前台，選「任何人」
   - 若只內部，選「僅限網域內使用者」或「僅自己」
5. 按部署，複製 Web App URL

## 使用網址

- 前台：`你的 Web App URL`
- 後台：`你的 Web App URL?page=admin`

## （建議）設定後台金鑰保護

1. 在 Apps Script 專案中，點「專案設定」
2. 到「Script properties」新增：
   - Key: `APP_ADMIN_KEY`
   - Value: 你自訂的長字串（例如 `psj-admin-2026-xxx`）
3. 後台網址改成：
   - `你的 Web App URL?page=admin&key=你的APP_ADMIN_KEY`

說明：

- 若未設定 `APP_ADMIN_KEY`，後台不驗證（任何知道後台網址的人都可操作）
- 設定後，後台新增/讀取都需要正確 key

## 資料表

程式第一次執行會自動建立 `Activities` 工作表，欄位如下：

- id
- name
- publishAt
- url
- createdAt

另會自動建立後台帳號表 `AdminUsers`：

- username
- password
- enabled
- createdAt

預設帳密：

- 帳號：`admin`
- 密碼：`admin123456`

你可以直接在 `AdminUsers` 改密碼或新增帳號（`enabled` 設 `TRUE` 才可登入）。

## 常見問題

- 新增活動出現「網址必須以 http:// 或 https:// 開頭」：
  - 請補上完整網址協定
- 前台看不到剛新增的活動：
  - 檢查上架時間是否還沒到
  - 檢查部署版本是否為最新（改程式後要重新部署新版本）
