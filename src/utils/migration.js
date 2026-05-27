const KEY_MAP = {
  jiayan_songs: 'jianying_songs',
  jiayan_favorites: 'jianying_favorites',
  jiayan_recent: 'jianying_recent',
  jiayan_custom_backgrounds: 'jianying_custom_backgrounds',
  jiayan_playlists: 'jianying_playlists',
  jiayan_projects: 'jianying_projects',
  jiayan_deleted_default_backgrounds: 'jianying_deleted_default_backgrounds',
};

const OLD_IMPORT_PREFIX = 'jiayan_imported_';
const NEW_IMPORT_PREFIX = 'jianying_imported_';

export function migrateLocalStorage() {
  const migratedFlag = localStorage.getItem('jianying_migrated_from_jiayan');
  if (migratedFlag) return;

  // Migrate fixed keys
  for (const [oldKey, newKey] of Object.entries(KEY_MAP)) {
    const value = localStorage.getItem(oldKey);
    if (value !== null && !localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, value);
    }
  }

  // Migrate dynamic imported data pack keys
  const keysToMigrate = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(OLD_IMPORT_PREFIX)) {
      keysToMigrate.push(key);
    }
  }
  for (const oldKey of keysToMigrate) {
    const newKey = NEW_IMPORT_PREFIX + oldKey.slice(OLD_IMPORT_PREFIX.length);
    if (!localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, localStorage.getItem(oldKey));
    }
  }

  localStorage.setItem('jianying_migrated_from_jiayan', '1');
}
