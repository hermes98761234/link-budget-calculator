import type { Inputs } from './budget'

export const DEFAULTS: Inputs = {
  freq: 5.8, freqUnit: 'GHz',
  dist: 10, distUnit: 'km',
  model: 'fspl', env: 'suburban', hTx: 30, hRx: 1.5,
  txPower: 27, txPowerUnit: 'dBm',
  txCable: 1, txConn: 0.5, txGain: 23,
  rxGain: 23, rxCable: 1, rxConn: 0.5,
  polLoss: 0.5, atmLoss: 0.2, obstLoss: 0,
  rainRate: 25, pol: 'H',
  bw: 20, bwUnit: 'MHz', nf: 6, snr: 18,
  sensMode: 'computed', sensManual: -90,
  fadeMargin: 15,
}

export interface Preset {
  id: string
  name: string // English, translated in the UI
  patch: Partial<Inputs>
}

export const PRESETS: Preset[] = [
  { id: 'ptp58', name: '5.8 GHz point-to-point (10 km)', patch: {} },
  {
    id: 'lora', name: 'LoRa 868 MHz sensor, SF12',
    patch: {
      freq: 868, freqUnit: 'MHz', dist: 5, distUnit: 'km', model: 'hata', env: 'suburban', hTx: 30, hRx: 2,
      txPower: 14, txPowerUnit: 'dBm', txCable: 0.5, txConn: 0.3, txGain: 2, rxGain: 5, rxCable: 1, rxConn: 0.3,
      polLoss: 0, atmLoss: 0, obstLoss: 0, rainRate: 0, bw: 125, bwUnit: 'kHz', nf: 6, snr: -20, fadeMargin: 10,
    },
  },
  {
    id: 'wifi', name: 'Wi-Fi 2.4 GHz outdoor bridge',
    patch: {
      freq: 2.4, freqUnit: 'GHz', dist: 2, distUnit: 'km', model: 'fspl',
      txPower: 20, txPowerUnit: 'dBm', txCable: 0.5, txConn: 0.5, txGain: 15, rxGain: 15, rxCable: 0.5, rxConn: 0.5,
      polLoss: 0, atmLoss: 0, obstLoss: 0, rainRate: 0, bw: 20, bwUnit: 'MHz', nf: 8, snr: 10, fadeMargin: 12,
    },
  },
  {
    id: 'gsm', name: 'GSM 900 macro cell, urban (Hata)',
    patch: {
      freq: 900, freqUnit: 'MHz', dist: 3, distUnit: 'km', model: 'hata', env: 'urban', hTx: 40, hRx: 1.5,
      txPower: 43, txPowerUnit: 'dBm', txCable: 2, txConn: 0.5, txGain: 15, rxGain: 0, rxCable: 0, rxConn: 0,
      polLoss: 0, atmLoss: 0, obstLoss: 0, rainRate: 0, bw: 200, bwUnit: 'kHz', nf: 8, snr: 9, fadeMargin: 8,
    },
  },
  {
    id: 'lte', name: 'LTE 1800 macro cell, metro (COST-231)',
    patch: {
      freq: 1800, freqUnit: 'MHz', dist: 2, distUnit: 'km', model: 'cost231', env: 'metro', hTx: 35, hRx: 1.5,
      txPower: 46, txPowerUnit: 'dBm', txCable: 2, txConn: 0.5, txGain: 17, rxGain: 0, rxCable: 0, rxConn: 0,
      polLoss: 0, atmLoss: 0, obstLoss: 0, rainRate: 0, bw: 10, bwUnit: 'MHz', nf: 7, snr: 0, fadeMargin: 10,
    },
  },
  {
    id: 'vhf', name: 'VHF 146 MHz handheld, two-ray',
    patch: {
      freq: 146, freqUnit: 'MHz', dist: 5, distUnit: 'km', model: 'tworay', hTx: 15, hRx: 1.5,
      txPower: 5, txPowerUnit: 'W', txCable: 0, txConn: 0.2, txGain: 0, rxGain: 3, rxCable: 1, rxConn: 0.2,
      polLoss: 0, atmLoss: 0, obstLoss: 3, rainRate: 0, bw: 12.5, bwUnit: 'kHz', nf: 6, snr: 12, fadeMargin: 10,
    },
  },
  {
    id: 'ku', name: '12 GHz microwave hop in heavy rain',
    patch: {
      freq: 12, freqUnit: 'GHz', dist: 15, distUnit: 'km', model: 'fspl',
      txPower: 24, txPowerUnit: 'dBm', txCable: 0.5, txConn: 0.5, txGain: 38, rxGain: 38, rxCable: 0.5, rxConn: 0.5,
      polLoss: 0.3, atmLoss: 0.5, obstLoss: 0, rainRate: 50, pol: 'V', bw: 40, bwUnit: 'MHz', nf: 5, snr: 22, fadeMargin: 20,
    },
  },
]
