using KwantDesk.Core.Aggregation;
using KwantDesk.Core.Collections;
using KwantDesk.Core.Models;
using KwantDesk.MarketData.Gateway;
using KwantDesk.MarketData.Rithmic;

namespace KwantDesk.MarketData.Sessions;

/// <summary>
/// Owns one upstream execution subscription and one bounded candle series.
/// Multiple chart views read this shared state; they never create their own
/// vendor/VPS subscriptions.
/// </summary>
public sealed class MarketDataSession : IAsyncDisposable
{
    private readonly RithmicTradeStreamClient _client;
    private readonly TimeCandleAggregator _aggregator;
    private readonly CancellationTokenSource _shutdown = new();
    private CancellationTokenSource? _runCancellation;
    private Task? _worker;
    private int _started;
    private long _lastTickAtUnixMs;

    public MarketDataSession(
        RithmicTradeStreamClient client,
        string exchange,
        string contractSymbol,
        TimeSpan candleInterval,
        int candleCapacity = 20_000)
    {
        _client = client;
        Exchange = exchange;
        ContractSymbol = contractSymbol;
        _aggregator = new TimeCandleAggregator(candleInterval);
        Candles = new BoundedSeries<Candle>(candleCapacity);
    }

    public string Exchange { get; }
    public string ContractSymbol { get; }
    public BoundedSeries<Candle> Candles { get; }
    public string Status { get; private set; } = "OFFLINE";
    public string? LastError { get; private set; }
    public long LastTickAtUnixMs => Interlocked.Read(ref _lastTickAtUnixMs);
    public event EventHandler? StatusChanged;

    public Task StartAsync(CancellationToken cancellationToken = default)
    {
        if (Interlocked.Exchange(ref _started, 1) != 0) return Task.CompletedTask;
        _runCancellation = CancellationTokenSource.CreateLinkedTokenSource(_shutdown.Token, cancellationToken);
        _worker = Task.Run(() => RunAsync(_runCancellation.Token), CancellationToken.None);
        return Task.CompletedTask;
    }

    private async Task RunAsync(CancellationToken cancellationToken)
    {
        var delay = TimeSpan.FromMilliseconds(250);
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                SetStatus("CONNECTING", null);
                await foreach (var frame in _client.StreamAsync(Exchange, ContractSymbol, cancellationToken).ConfigureAwait(false))
                {
                    var update = frame.SeedCandle is { } seed
                        ? _aggregator.Apply(seed)
                        : _aggregator.Apply(frame.Trade ?? throw new InvalidDataException("Empty market-data frame."));
                    Apply(update);

                    var sourceTimestamp = frame.SeedCandle?.OpenTimeUnixMs ?? frame.Trade!.Value.TimestampUnixMs;
                    Interlocked.Exchange(ref _lastTickAtUnixMs, sourceTimestamp);
                    if (Status != "LIVE") SetStatus("LIVE", null);
                    delay = TimeSpan.FromMilliseconds(250);
                }

                throw new EndOfStreamException("The VPS execution stream ended.");
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                break;
            }
            catch (GatewayAuthenticationException exception)
            {
                SetStatus("AUTH REQUIRED", exception.Message);
                break;
            }
            catch (Exception exception)
            {
                SetStatus("RECONNECTING", exception.Message);
                await Task.Delay(delay, cancellationToken).ConfigureAwait(false);
                delay = TimeSpan.FromMilliseconds(Math.Min(delay.TotalMilliseconds * 2, 5_000));
            }
        }

        if (Status != "AUTH REQUIRED") SetStatus("OFFLINE", LastError);
    }

    private void Apply(CandleUpdate update)
    {
        if (update.Completed is not null)
        {
            if (!Candles.ReplaceLast(update.Completed.Value)) Candles.Add(update.Completed.Value);
            Candles.Add(update.Current);
        }
        else if (!Candles.ReplaceLast(update.Current))
        {
            Candles.Add(update.Current);
        }
    }

    private void SetStatus(string status, string? error)
    {
        Status = status;
        LastError = error;
        StatusChanged?.Invoke(this, EventArgs.Empty);
    }

    public async ValueTask DisposeAsync()
    {
        _shutdown.Cancel();
        if (_worker is not null)
        {
            try { await _worker.ConfigureAwait(false); }
            catch (OperationCanceledException) { }
        }

        _runCancellation?.Dispose();
        Candles.Dispose();
        _shutdown.Dispose();
    }
}
