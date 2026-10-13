(async () => {
  const navigation = document.getElementById('main-nav');
  const API_URL = window.TOPTRUMP_API_URL;
  if (!navigation) return;

  try {
    const response = await window.apiFetch(`${API_URL}?route=current_player`);
    if (response.ok) {
      const player = await response.json();
      navigation.hidden = !player.authenticated;
    }
  } catch (error) {
    navigation.hidden = true;
  }
})();
