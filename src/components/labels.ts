import type { Element } from '../lib/network'
import type { T } from '../i18n'

export function elementLabel(el: Element, t: T): string {
  if (el.type === 'line') return t('Series line')
  if (el.type === 'stub') {
    if (el.mount === 'shunt') return el.open ? t('Shunt open stub') : t('Shunt short stub')
    return el.open ? t('Series open stub') : t('Series short stub')
  }
  const s = el.mount === 'series' ? t('Series') : t('Shunt')
  return `${s} ${el.type}`
}
