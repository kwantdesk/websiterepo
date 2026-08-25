using System.Runtime.CompilerServices;
using System.Text.Json;
using KwantDesk.Core.Models;
using KwantDesk.MarketData.Gateway;

namespace KwantDesk.MarketData.Rithmic;

public sealed class RithmicTradeStreamClient(
    GatewayConnectionOptions options,
    SseClient sseClient)
{
    public async IAsyncEnumerable<TradeStreamFrame> StreamAsync(
        string exchange,
        string contractSymbol,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var query = $"v1/market-data/trades?exchange={Uri.EscapeDataString(exchange)}&contractSymbol={Uri.EscapeDataString(contractSymbol)}";
        var uri = new Uri(options.BaseUri, query);

        await foreach (var message in sseClient.ConnectAsync(uri, cancellationToken).ConfigureAwait(false))
        {
            if (message.Event is not ("seed" or "trades")) continue;
            using var document = JsonDocument.Parse(message.Data);

            // Seed candles are the compact, lossless restoration path. Do not
            // also parse the seed's raw records or the same executions would be
            // counted twice.
            if (message.Event == "seed"
                && document.RootElement.TryGetProperty("candles", out var candles)
                && candles.ValueKind == JsonValueKind.Array)
            {
                foreach (var element in candles.EnumerateArray())
                {
                    if (!TryParseCandle(element, out var candle)) continue;
                    yield return TradeStreamFrame.FromSeedCandle(candle);
                }

                continue;
            }

            if (!document.RootElement.TryGetProperty("records", out var records)
                || records.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var record in records.EnumerateArray())
            {
                if (!TryParseTrade(record, out var trade)) continue;
                yield return TradeStreamFrame.FromTrade(trade, message.Event == "seed");
            }
        }
    }

    private static bool TryParseCandle(JsonElement element, out Candle candle)
    {
        candle = default;
        if (!TryInt64(element, "timestamp", out var timestamp)
            || !TryDouble(element, "open", out var open)
            || !TryDouble(element, "high", out var high)
            || !TryDouble(element, "low", out var low)
            || !TryDouble(element, "close", out var close)
            || !TryInt64(element, "volume", out var volume)
            || !TryInt64(element, "trades", out var trades)
            || !TryInt64(element, "bidVolume", out var bidVolume)
            || !TryInt64(element, "askVolume", out var askVolume)
            || timestamp <= 0
            || open <= 0
            || high < low
            || low <= 0
            || close <= 0
            || volume < 0
            || trades < 0
            || bidVolume < 0
            || askVolume < 0)
        {
            return false;
        }

        candle = new Candle(timestamp, open, high, low, close, volume, trades, bidVolume, askVolume, false);
        return true;
    }

    private static bool TryParseTrade(JsonElement record, out TradeTick trade)
    {
        trade = default;
        if (!TryInt64(record, "timestamp", out var timestamp)
            || !TryDouble(record, "close", out var price)
            || !TryInt64(record, "volume", out var size)
            || timestamp <= 0
            || price <= 0
            || size < 0)
        {
            return false;
        }

        var aggressor = record.TryGetProperty("aggressor", out var aggressorElement)
            ? aggressorElement.GetString() switch
            {
                "BUY" => AggressorSide.Buy,
                "SELL" => AggressorSide.Sell,
                _ => AggressorSide.Unknown,
            }
            : AggressorSide.Unknown;
        _ = TryInt64(record, "recordIndex", out var sequence);
        trade = new TradeTick(timestamp, price, size, aggressor, sequence);
        return true;
    }

    private static bool TryDouble(JsonElement element, string property, out double value)
    {
        value = 0;
        return element.TryGetProperty(property, out var child)
            && child.ValueKind == JsonValueKind.Number
            && child.TryGetDouble(out value)
            && double.IsFinite(value);
    }

    private static bool TryInt64(JsonElement element, string property, out long value)
    {
        value = 0;
        if (!element.TryGetProperty(property, out var child) || child.ValueKind != JsonValueKind.Number)
        {
            return false;
        }

        if (child.TryGetInt64(out value)) return true;
        if (!child.TryGetDouble(out var numeric) || !double.IsFinite(numeric)) return false;
        value = checked((long)numeric);
        return true;
    }
}

public readonly record struct TradeStreamFrame(Candle? SeedCandle, TradeTick? Trade, bool IsSeed)
{
    public static TradeStreamFrame FromSeedCandle(Candle candle) => new(candle, null, true);
    public static TradeStreamFrame FromTrade(TradeTick trade, bool isSeed) => new(null, trade, isSeed);
}
