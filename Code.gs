const SHEET_NAME = "Activities";
const ADMIN_USERS_SHEET = "AdminUsers";
const TZ = Session.getScriptTimeZone() || "Asia/Taipei";

function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) || "front";
  if (page === "api") {
    return handleApiGet_(e);
  }
  return ContentService.createTextOutput(
    "This endpoint is API-only. Use ?page=api&action=frontList",
  ).setMimeType(ContentService.MimeType.TEXT);
}

function handleApiGet_(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = (p.action || "").trim();
    let data;

    if (action === "frontList") {
      data = listActivitiesForFront();
    } else if (action === "adminLogin") {
      data = adminLogin({
        username: p.username || "",
        password: p.password || "",
      });
    } else if (action === "adminList") {
      data = listActivitiesForAdmin(p.adminToken || "", p.adminKey || "");
    } else if (action === "adminSave") {
      data = saveActivity(
        {
          name: p.name || "",
          publishAt: p.publishAt || "",
          unpublishAt: p.unpublishAt || "",
          url: p.url || "",
        },
        p.adminToken || "",
        p.adminKey || "",
      );
    } else if (action === "adminDelete") {
      data = deleteActivity(
        p.activityId || "",
        p.adminToken || "",
        p.adminKey || "",
      );
    } else if (action === "adminLogout") {
      data = logoutAdmin(p.adminToken || "");
    } else {
      throw new Error("未知 API action");
    }

    return jsonpResponse_(p.callback, { ok: true, data: data });
  } catch (err) {
    return jsonpResponse_((e && e.parameter && e.parameter.callback) || "", {
      ok: false,
      message: err && err.message ? err.message : "系統錯誤",
    });
  }
}

function jsonpResponse_(callback, payload) {
  const json = JSON.stringify(payload);
  const cb = String(callback || "").trim();
  if (cb && /^[a-zA-Z_$][0-9a-zA-Z_$\.]*$/.test(cb)) {
    return ContentService.createTextOutput(cb + "(" + json + ");").setMimeType(
      ContentService.MimeType.JAVASCRIPT,
    );
  }
  return ContentService.createTextOutput(json).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function getWebAppUrl_() {
  const url = ScriptApp.getService().getUrl() || "";
  return url.split("?")[0];
}

function ensureSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet
      .getRange(1, 1, 1, 6)
      .setValues([
        ["id", "name", "publishAt", "unpublishAt", "url", "createdAt"],
      ]);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastColumn() < 6) {
    sheet.insertColumnAfter(3);
    sheet.getRange(1, 4).setValue("unpublishAt");
    sheet.getRange(1, 5).setValue("url");
    sheet.getRange(1, 6).setValue("createdAt");
  }
  return sheet;
}

function ensureAdminUsersSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ADMIN_USERS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(ADMIN_USERS_SHEET);
    sheet
      .getRange(1, 1, 1, 4)
      .setValues([["username", "password", "enabled", "createdAt"]]);
    sheet.setFrozenRows(1);
    sheet.appendRow(["admin", "admin123456", true, new Date()]);
  }
  return sheet;
}

function adminLogin(payload) {
  const username = (payload.username || "").trim();
  const password = (payload.password || "").trim();
  if (!username || !password) throw new Error("帳號或密碼不可為空");

  const sheet = ensureAdminUsersSheet_();
  const values = sheet.getDataRange().getValues();
  const found = values.slice(1).find((row) => {
    const enabled = String(row[2]).toLowerCase() !== "false";
    return (
      enabled &&
      String(row[0]).trim() === username &&
      String(row[1]).trim() === password
    );
  });
  if (!found) throw new Error("帳號或密碼錯誤");

  const token = Utilities.getUuid();
  CacheService.getScriptCache().put("adminToken:" + token, username, 21600);
  return { token: token, username: username };
}

function logoutAdmin(adminToken) {
  if (adminToken) {
    CacheService.getScriptCache().remove("adminToken:" + adminToken);
  }
  return { ok: true };
}

function requireAdmin_(adminToken, adminKey) {
  const configuredKey = (
    PropertiesService.getScriptProperties().getProperty("APP_ADMIN_KEY") || ""
  ).trim();
  if (configuredKey && (adminKey || "").trim() === configuredKey) {
    return;
  }

  if (adminToken) {
    const username = CacheService.getScriptCache().get(
      "adminToken:" + adminToken,
    );
    if (username) return;
  }
  throw new Error("尚未登入，請先輸入帳號密碼");
}

function saveActivity(payload, adminToken, adminKey) {
  requireAdmin_(adminToken, adminKey);
  const sheet = ensureSheet_();
  const name = (payload.name || "").trim();
  const rawUrl = (payload.url || "").trim();
  const publishAtInput = payload.publishAt || "";
  const unpublishAtInput = payload.unpublishAt || "";

  if (!name) throw new Error("活動名稱不可為空");
  if (!rawUrl) throw new Error("網址不可為空");
  const url = normalizeUrl_(rawUrl);

  const publishAt = new Date(publishAtInput);
  if (isNaN(publishAt.getTime())) throw new Error("上架時間格式錯誤");
  const unpublishAt = new Date(unpublishAtInput);
  if (isNaN(unpublishAt.getTime())) throw new Error("下架時間格式錯誤");
  if (unpublishAt.getTime() <= publishAt.getTime()) {
    throw new Error("下架時間必須晚於上架時間");
  }

  const id = Utilities.getUuid();
  const createdAt = new Date();
  sheet.appendRow([id, name, publishAt, unpublishAt, url, createdAt]);
  CacheService.getScriptCache().remove("frontActivities");
  return { ok: true, id: id };
}

function deleteActivity(activityId, adminToken, adminKey) {
  requireAdmin_(adminToken, adminKey);
  const id = String(activityId || "").trim();
  if (!id) throw new Error("缺少活動 id");

  const sheet = ensureSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) throw new Error("找不到要刪除的活動");

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === id) {
      sheet.deleteRow(i + 1);
      CacheService.getScriptCache().remove("frontActivities");
      return { ok: true };
    }
  }

  throw new Error("找不到要刪除的活動");
}

function normalizeUrl_(inputUrl) {
  let url = (inputUrl || "").trim();
  if (!url) throw new Error("網址不可為空");
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }
  // Apps Script 端做輕量驗證：只檢查協定與「至少一個點的網域」。
  if (!/^https?:\/\/[^\s]+\.[^\s]+/i.test(url)) {
    throw new Error(
      "網址格式錯誤，請輸入像 example.com 或 https://example.com",
    );
  }
  return url;
}

function listActivitiesForAdmin(adminToken, adminKey) {
  requireAdmin_(adminToken, adminKey);
  const sheet = ensureSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  return values
    .slice(1)
    .filter((row) => row[0] && row[1] && row[2] && row[4])
    .map((row) => ({
      id: String(row[0]),
      name: String(row[1]),
      publishAt: formatDateTime_(row[2]),
      unpublishAt: formatDateTime_(row[3]),
      url: String(row[4]),
      createdAt: formatDateTime_(row[5]),
    }))
    .sort((a, b) => (a.publishAt < b.publishAt ? 1 : -1));
}

function listActivitiesForFront() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("frontActivities");
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (err) {
      // 快取壞掉就忽略，直接重算
    }
    cache.remove("frontActivities");
  }

  const now = new Date();
  const result = listActivitiesRaw_()
    .filter(
      (item) =>
        item.publishAtDate.getTime() <= now.getTime() &&
        item.unpublishAtDate.getTime() > now.getTime(),
    )
    .sort((a, b) => b.publishAtDate.getTime() - a.publishAtDate.getTime())
    .map((item) => ({
      name: item.name,
      publishAt: formatDate_(item.publishAtDate),
      url: item.url,
    }));
  cache.put("frontActivities", JSON.stringify(result), 60);
  return result;
}

function listActivitiesRaw_() {
  const sheet = ensureSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  return values
    .slice(1)
    .filter((row) => row[1] && row[2] && row[3] && row[4])
    .map((row) => ({
      name: String(row[1]),
      publishAtDate: new Date(row[2]),
      unpublishAtDate: new Date(row[3]),
      url: String(row[4]),
    }))
    .filter(
      (item) =>
        !isNaN(item.publishAtDate.getTime()) &&
        !isNaN(item.unpublishAtDate.getTime()) &&
        item.unpublishAtDate.getTime() > item.publishAtDate.getTime(),
    );
}

function formatDateTime_(dateValue) {
  if (!dateValue) return "";
  return Utilities.formatDate(new Date(dateValue), TZ, "yyyy/MM/dd HH:mm");
}

function formatDate_(dateValue) {
  return Utilities.formatDate(new Date(dateValue), TZ, "M/d");
}
