using KwantDesk.Core.Aggregation;
using KwantDesk.Core.Models;

namespace KwantDesk.Core.Tests;

public sealed class TimeCandleAggregatorTests
{
    [Fact]
    public void Apply_WithinBucket_UpdatesOhlcvAndAggressorVolumes()
    {
        var aggregator = new TimeCandleAggregator(TimeSpan.FromMinutes(1));
        aggregator.Apply(new TradeTick(60_010, 100, 4, AggressorSide.Buy));
        var result = aggregator.Apply(new TradeTick(60_500, 99.75, 3, AggressorSide.Sell));

        Assert.Null(result.Completed);
        Assert.Equal(100, result.Current.Open);
        Assert.Equal(100, result.Current.High);
        Assert.Equal(99.75, result.Current.Low);
        Assert.Equal(99.75, result.Current.Close);
        Assert.Equal(7, result.Current.Volume);
        Assert.Equal(4, result.Current.AskVolume);
        Assert.Equal(3, result.Current.BidVolume);
        Assert.Equal(1, result.Current.Delta);
    }

    [Fact]
    public void AppliesCompactSeedCandlesWithoutLosingOhlcOrOrderFlowTotals()
    {
        var aggregator = new TimeCandleAggregator(TimeSpan.FromMinutes(1));
        var first = new Candle(120_000, 100, 104, 99, 102, 12, 3, 5, 7, true);
        var second = new Candle(121_000, 102, 106, 101, 105, 20, 4, 8, 12, true);

        _ = aggregator.Apply(first);
        var update = aggregator.Apply(second);

        Assert.Null(update.Completed);
        Assert.Equal(120_000, update.Current.OpenTimeUnixMs);
        Assert.Equal(100, update.Current.Open);
        Assert.Equal(106, update.Current.High);
        Assert.Equal(99, update.Current.Low);
        Assert.Equal(105, update.Current.Close);
        Assert.Equal(32, update.Current.Volume);
        Assert.Equal(7, update.Current.TradeCount);
        Assert.Equal(13, update.Current.BidVolume);
        Assert.Equal(19, update.Current.AskVolume);
    }

    [Fact]
    public void CompletesSeedBucketBeforeStartingNextMinute()
    {
        var aggregator = new TimeCandleAggregator(TimeSpan.FromMinutes(1));
        var first = new Candle(120_000, 100, 101, 99, 100, 10, 2, 6, 4, true);
        var next = new Candle(180_000, 105, 106, 104, 105, 8, 1, 2, 6, true);

        _ = aggregator.Apply(first);
        var update = aggregator.Apply(next);

        Assert.True(update.StartedNewBucket);
        Assert.NotNull(update.Completed);
        Assert.True(update.Completed!.Value.IsClosed);
        Assert.Equal(120_000, update.Completed.Value.OpenTimeUnixMs);
        Assert.Equal(180_000, update.Current.OpenTimeUnixMs);
    }

    [Fact]
    public void Apply_NextBucket_ClosesPriorWithoutFabricatingGapBars()
    {
        var aggregator = new TimeCandleAggregator(TimeSpan.FromMinutes(1));
        aggregator.Apply(new TradeTick(1, 100, 1, AggressorSide.Buy));
        var result = aggregator.Apply(new TradeTick(180_001, 102, 2, AggressorSide.Buy));

        Assert.NotNull(result.Completed);
        Assert.True(result.Completed.Value.IsClosed);
        Assert.Equal(0, result.Completed.Value.OpenTimeUnixMs);
        Assert.Equal(180_000, result.Current.OpenTimeUnixMs);
        Assert.True(result.StartedNewBucket);
    }

    [Fact]
    public void Apply_StaleTick_DoesNotCorruptActiveCandle()
    {
        var aggregator = new TimeCandleAggregator(TimeSpan.FromMinutes(1));
        aggregator.Apply(new TradeTick(120_000, 100, 1, AggressorSide.Buy));
        var result = aggregator.Apply(new TradeTick(60_000, 1, 100, AggressorSide.Sell));

        Assert.Equal(100, result.Current.Close);
        Assert.Equal(1, result.Current.Volume);
    }
}
