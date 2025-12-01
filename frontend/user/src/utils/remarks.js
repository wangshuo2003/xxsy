const KEY = 'contact_remarks'

function loadMap() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) || {} : {}
  } catch (e) {
    return {}
  }
}

function saveMap(map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch (e) {
    console.warn('保存备注失败', e)
  }
}

export function getRemarks() {
  return loadMap()
}

export function getRemark(id) {
  if (!id) return ''
  const map = loadMap()
  return map[id] || ''
}

export function setRemark(id, remark) {
  if (!id) return
  const map = loadMap()
  if (!remark) {
    delete map[id]
  } else {
    map[id] = remark
  }
  saveMap(map)
  window.dispatchEvent(new CustomEvent('remark-updated', { detail: { id, remark } }))
}
