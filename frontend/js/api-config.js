window.TOPTRUMP_API_URL = window.TOPTRUMP_API_URL || '../backend/api/index.php';

window.apiFetch = (url, options = {}) => fetch(url, {
  ...options,
  credentials: 'include',
});
