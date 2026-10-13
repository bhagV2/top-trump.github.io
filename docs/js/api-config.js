window.TOPTRUMP_API_URL = 'https://YOUR-PHP-HOST.example/backend/api/index.php';

window.apiFetch = (url, options = {}) => fetch(url, {
  ...options,
  credentials: 'include',
});
