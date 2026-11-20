// Ochilish ekrani (index.html dagi #boot): ilova tayyor bo'lgach yumshoq yo'qoladi
export function hideBoot() {
  const el = document.getElementById('boot')
  if (!el || el.classList.contains('out')) return
  el.classList.add('out')
  setTimeout(() => el.remove(), 700)
}
