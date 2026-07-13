# Firebase 前後台 + Google 試算表資料庫

## 架構

- 前台：`website/index.html`（Firebase Hosting）
- 後台：`website/admin.html`（Firebase Hosting）
- 資料庫與商業邏輯：Google Apps Script + Google 試算表

## 你要先改的地方

在這兩個檔案，把 `APPS_SCRIPT_EXEC_URL` 改成你自己的 `/exec`：

- `website/index.html`
- `website/admin.html`

目前是這個位置：

```js
const APPS_SCRIPT_EXEC_URL = "https://script.google.com/macros/s/你的ID/exec";
```

## Apps Script 端

`Code.gs` 已內建 API（JSONP）：

- `?page=api&action=frontList`
- `?page=api&action=adminLogin&username=...&password=...`
- `?page=api&action=adminList&adminToken=...`
- `?page=api&action=adminSave&adminToken=...&name=...&publishAt=...&unpublishAt=...&url=...`
- `?page=api&action=adminDelete&adminToken=...&activityId=...`
- `?page=api&action=adminLogout&adminToken=...`

部署 Apps Script 時，Web App 權限要能讓 Firebase 網頁可讀（通常設「任何人」）。

## Firebase 端部署

你目前 `firebase.json` 已是：

- public: `website`

所以直接部署：

```bash
firebase deploy --only hosting
```

## 使用網址

- 前台：`https://你的專案.web.app/index.html`
- 後台：`https://你的專案.web.app/admin.html`

## 注意

- 後台登入目前走 JSONP（為了跨網域），帳密會出現在請求網址。  
  這是為了快速上線的做法；若要更安全，下一步建議改成 Cloud Functions 代理或同網域 API。
