export interface OptionContractChoices {
  coverage: 'observed chain' | 'observed chain and open interest' | 'observed open interest';
  expirationDates: string[];
  strikePricesByExpiration: Record<string, number[]>;
  strikePrices: number[];
  limitations: string;
}
export function buildOptionContractChoicesRequest(input?: {ticker: string; sessionDate?: string | null}): {filter: {ticker: string}; sessionDate?: string};
export function parseOptionContractChoices(payload: unknown): OptionContractChoices;
export function buildOptionStrikeChoicesRequest(input?: {ticker: string; sessionDate?: string | null; expirationDate?: string}): {filter: {ticker: string; expirationDate?: string}; sessionDate?: string};
export function parseOpenInterestStrikeChoices(payload: unknown): {coverage: 'observed open interest'; strikePrices: number[]; limitations: string};
export function mergeOptionContractChoices(chainChoices: OptionContractChoices, expirationDate: string, openInterestPayload: unknown): OptionContractChoices;
export function buildOptionExpirationChoicesRequest(input?: {ticker: string; sessionDate?: string | null}): {filter: {ticker: string}; sessionDate?: string};
export function parseOpenInterestExpirationChoices(payload: unknown): OptionContractChoices;
