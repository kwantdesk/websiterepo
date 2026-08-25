using KwantDesk.Core.Models;

namespace KwantDesk.Core.Aggregation;

/// <summary>
/// Deterministic trade-to-time-candle aggregation. It never fabricates candles
/// for exchange pauses and ignores stale ticks outside the active bucket.
/// </summary>
public sealed class TimeCandleAggregator
{
    private readonly long _intervalMs;
    private Candle? _current;

    public TimeCandleAggregator(TimeSpan interval)
    {
        _intervalMs = checked((long)interval.TotalMilliseconds);
        ArgumentOutOfRangeException.ThrowIfLessThan(_intervalMs, 1);
    }

    public Candle? Current => _current;

    public CandleUpdate Apply(TradeTick tick)
    {
        if (tick.TimestampUnixMs < 0) throw new ArgumentOutOfRangeException(nameof(tick));
        if (!double.IsFinite(tick.Price) || tick.Price <= 0) throw new ArgumentOutOfRangeException(nameof(tick));
        if (tick.Size < 0) throw new ArgumentOutOfRangeException(nameof(tick));

        var bucket = tick.TimestampUnixMs - (tick.TimestampUnixMs % _intervalMs);
        if (_current is null)
        {
            var created = Create(bucket, tick);
            _current = created;
            return new CandleUpdate(null, created, true);
        }

        var current = _current.Value;
        if (bucket < current.OpenTimeUnixMs)
        {
            return new CandleUpdate(null, current, false);
        }

        if (bucket > current.OpenTimeUnixMs)
        {
            var completed = current with { IsClosed = true };
            var created = Create(bucket, tick);
            _current = created;
            return new CandleUpdate(completed, created, true);
        }

        var askVolume = tick.Aggressor == AggressorSide.Buy ? tick.Size : 0;
        var bidVolume = tick.Aggressor == AggressorSide.Sell ? tick.Size : 0;
        var updated = current with
        {
            High = Math.Max(current.High, tick.Price),
            Low = Math.Min(current.Low, tick.Price),
            Close = tick.Price,
            Volume = checked(current.Volume + tick.Size),
            TradeCount = checked(current.TradeCount + 1),
            BidVolume = checked(current.BidVolume + bidVolume),
            AskVolume = checked(current.AskVolume + askVolume),
        };
        _current = updated;
        return new CandleUpdate(null, updated, false);
    }

    /// <summary>
    /// Applies an already aggregated source candle to this aggregator. The VPS
    /// sends compact one-second seed candles before the live execution stream;
    /// folding those candles avoids allocating and replaying tens of thousands
    /// of JSON trade objects on the UI machine while preserving exact OHLC and
    /// bid/ask volume totals.
    /// </summary>
    public CandleUpdate Apply(Candle source)
    {
        if (source.OpenTimeUnixMs < 0) throw new ArgumentOutOfRangeException(nameof(source));
        if (!double.IsFinite(source.Open) || source.Open <= 0
            || !double.IsFinite(source.High) || source.High <= 0
            || !double.IsFinite(source.Low) || source.Low <= 0
            || !double.IsFinite(source.Close) || source.Close <= 0
            || source.High < source.Low
            || source.Volume < 0
            || source.TradeCount < 0
            || source.BidVolume < 0
            || source.AskVolume < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(source));
        }

        var bucket = source.OpenTimeUnixMs - (source.OpenTimeUnixMs % _intervalMs);
        if (_current is null)
        {
            var created = Normalize(bucket, source);
            _current = created;
            return new CandleUpdate(null, created, true);
        }

        var current = _current.Value;
        if (bucket < current.OpenTimeUnixMs)
        {
            return new CandleUpdate(null, current, false);
        }

        if (bucket > current.OpenTimeUnixMs)
        {
            var completed = current with { IsClosed = true };
            var created = Normalize(bucket, source);
            _current = created;
            return new CandleUpdate(completed, created, true);
        }

        var updated = current with
        {
            High = Math.Max(current.High, source.High),
            Low = Math.Min(current.Low, source.Low),
            Close = source.Close,
            Volume = checked(current.Volume + source.Volume),
            TradeCount = checked(current.TradeCount + source.TradeCount),
            BidVolume = checked(current.BidVolume + source.BidVolume),
            AskVolume = checked(current.AskVolume + source.AskVolume),
        };
        _current = updated;
        return new CandleUpdate(null, updated, false);
    }

    private static Candle Create(long bucket, TradeTick tick)
    {
        var askVolume = tick.Aggressor == AggressorSide.Buy ? tick.Size : 0;
        var bidVolume = tick.Aggressor == AggressorSide.Sell ? tick.Size : 0;
        return new Candle(
            bucket,
            tick.Price,
            tick.Price,
            tick.Price,
            tick.Price,
            tick.Size,
            1,
            bidVolume,
            askVolume,
            false);
    }

    private static Candle Normalize(long bucket, Candle source) => source with
    {
        OpenTimeUnixMs = bucket,
        IsClosed = false,
    };
}

public readonly record struct CandleUpdate(Candle? Completed, Candle Current, bool StartedNewBucket);
