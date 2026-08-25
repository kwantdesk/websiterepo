namespace KwantDesk.MarketData.Sessions;

public readonly record struct MarketDataSubscriptionKey
{
    public MarketDataSubscriptionKey(string exchange, string contractSymbol, TimeSpan candleInterval)
    {
        if (string.IsNullOrWhiteSpace(exchange)) throw new ArgumentException("Exchange is required.", nameof(exchange));
        if (string.IsNullOrWhiteSpace(contractSymbol)) throw new ArgumentException("Contract symbol is required.", nameof(contractSymbol));
        if (candleInterval <= TimeSpan.Zero) throw new ArgumentOutOfRangeException(nameof(candleInterval));

        Exchange = exchange.Trim().ToUpperInvariant();
        ContractSymbol = contractSymbol.Trim().ToUpperInvariant();
        CandleInterval = candleInterval;
    }

    public string Exchange { get; }
    public string ContractSymbol { get; }
    public TimeSpan CandleInterval { get; }
}
