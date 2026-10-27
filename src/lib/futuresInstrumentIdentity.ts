/** Contract identity belongs to the selected product, including its micro root. */
export function futuresInstrumentRoot(symbol: string | null | undefined): string {
  const raw=String(symbol??'').trim().toUpperCase().replace(/\.[VNC]\.\d+$/,'');
  return raw.replace(/([FGHJKMNQUVXZ])\d{1,2}$/,'');
}
export function scopedFuturesContract(symbol: string, candidate: string | null | undefined): string | null {
  const contract=String(candidate??'').trim().toUpperCase();
  if(!/^[A-Z0-9]+[FGHJKMNQUVXZ]\d{1,2}$/.test(contract))return null;
  return futuresInstrumentRoot(symbol)===futuresInstrumentRoot(contract)?contract:null;
}
