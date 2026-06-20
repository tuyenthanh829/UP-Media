const fs = require('fs');
const path = require('path');

function getGoogleAccounts(profilePath) {
  try {
    const prefPath = path.join(profilePath, 'Preferences');
    if (!fs.existsSync(prefPath)) return [];
    const prefs = JSON.parse(fs.readFileSync(prefPath, 'utf8'));
    const info = prefs.account_info || [];
    return info
      .filter(a => a.email)
      .map(a => ({
        email: a.email || '',
        fullName: a.full_name || a.email || '',
        accountId: a.account_id || '',
        pictureUrl: a.picture_url || '',
      }));
  } catch {
    return [];
  }
}

module.exports = { getGoogleAccounts };
