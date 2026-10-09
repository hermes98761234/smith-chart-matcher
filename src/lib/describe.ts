import { SPEED_OF_LIGHT } from './rf'

/** Physical length (m) of `deg` electrical degrees at f0 on a line with velocity factor vf. */
export const physicalLength = (deg: number, f0: number, vf: number): number => (deg / 360) * ((SPEED_OF_LIGHT * vf) / f0)

export const wavelengthOf = (deg: number): number => deg / 360
