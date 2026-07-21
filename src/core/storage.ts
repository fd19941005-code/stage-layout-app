// 後方互換用の入口。Web固有の自動保存実装はservices/webへ移している。
export {
  AUTOSAVE_RECORD_KEY,
  LEGACY_AUTOSAVE_KEY,
  STORAGE_DB_NAME,
  STORAGE_DB_VERSION,
  STORAGE_STORE_NAME,
  loadAutosavedProject,
  saveAutosavedProject,
} from "../services/web/indexedDbStorage";
