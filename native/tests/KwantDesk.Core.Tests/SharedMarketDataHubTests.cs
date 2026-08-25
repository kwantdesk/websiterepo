using KwantDesk.Core.Collections;
using KwantDesk.Core.Models;
using KwantDesk.MarketData.Sessions;

namespace KwantDesk.Core.Tests;

public sealed class SharedMarketDataHubTests
{
    [Fact]
    public async Task SameNormalizedKeySharesOneSessionUntilFinalLeaseCloses()
    {
        var created = new List<FakeSession>();
        await using var hub = new SharedMarketDataHub(key =>
        {
            var session = new FakeSession(key.Exchange, key.ContractSymbol);
            created.Add(session);
            return session;
        });

        var first = await hub.AcquireAsync(new MarketDataSubscriptionKey("cme", " nq ", TimeSpan.FromMinutes(1)));
        var second = await hub.AcquireAsync(new MarketDataSubscriptionKey("CME", "NQ", TimeSpan.FromMinutes(1)));

        Assert.Single(created);
        Assert.Same(first.Session, second.Session);
        Assert.Equal(1, created[0].StartCount);

        await first.DisposeAsync();
        Assert.Equal(0, created[0].DisposeCount);
        await second.DisposeAsync();
        Assert.Equal(1, created[0].DisposeCount);
    }

    [Fact]
    public async Task DifferentIntervalsOwnDifferentSessions()
    {
        var created = 0;
        await using var hub = new SharedMarketDataHub(key =>
        {
            created++;
            return new FakeSession(key.Exchange, key.ContractSymbol);
        });

        await using var oneMinute = await hub.AcquireAsync(
            new MarketDataSubscriptionKey("CME", "NQ", TimeSpan.FromMinutes(1)));
        await using var fiveMinute = await hub.AcquireAsync(
            new MarketDataSubscriptionKey("CME", "NQ", TimeSpan.FromMinutes(5)));

        Assert.Equal(2, created);
        Assert.NotSame(oneMinute.Session, fiveMinute.Session);
    }

    private sealed class FakeSession(string exchange, string contractSymbol) : IMarketDataSession
    {
        public string Exchange { get; } = exchange;
        public string ContractSymbol { get; } = contractSymbol;
        public BoundedSeries<Candle> Candles { get; } = new(16);
        public string Status => "LIVE";
        public string? LastError => null;
        public long LastTickAtUnixMs => 0;
        public int StartCount { get; private set; }
        public int DisposeCount { get; private set; }
        public event EventHandler? StatusChanged;

        public Task StartAsync(CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            StartCount++;
            StatusChanged?.Invoke(this, EventArgs.Empty);
            return Task.CompletedTask;
        }

        public ValueTask DisposeAsync()
        {
            DisposeCount++;
            Candles.Dispose();
            return ValueTask.CompletedTask;
        }
    }
}
