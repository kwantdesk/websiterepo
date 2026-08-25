namespace KwantDesk.Core.Models;

public readonly record struct Candle(
    long OpenTimeUnixMs,
    double Open,
    double High,
    double Low,
    double Close,
    long Volume,
    long TradeCount,
    long BidVolume,
    long AskVolume,
    bool IsClosed)
{
    public long Delta => AskVolume - BidVolume;
}
