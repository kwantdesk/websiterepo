namespace KwantDesk.Core.Models;

public enum AggressorSide
{
    Unknown = 0,
    Buy = 1,
    Sell = 2,
}

public readonly record struct TradeTick(
    long TimestampUnixMs,
    double Price,
    long Size,
    AggressorSide Aggressor,
    long Sequence = 0);
