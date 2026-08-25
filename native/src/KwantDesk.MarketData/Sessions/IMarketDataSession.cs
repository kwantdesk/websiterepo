using KwantDesk.Core.Collections;
using KwantDesk.Core.Models;

namespace KwantDesk.MarketData.Sessions;

public interface IMarketDataSession : IAsyncDisposable
{
    string Exchange { get; }
    string ContractSymbol { get; }
    BoundedSeries<Candle> Candles { get; }
    string Status { get; }
    string? LastError { get; }
    long LastTickAtUnixMs { get; }
    event EventHandler? StatusChanged;
    Task StartAsync(CancellationToken cancellationToken = default);
}
