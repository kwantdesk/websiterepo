namespace KwantDesk.Core.Models;

public readonly record struct QuoteTick(
    string Instrument,
    string ContractSymbol,
    long TimestampUnixMs,
    double Bid,
    double Ask,
    double Last,
    long LastSize,
    long TradeCount,
    long Delta,
    bool IsTrade);
